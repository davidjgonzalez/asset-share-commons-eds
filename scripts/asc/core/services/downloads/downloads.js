// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import serviceConfigurations from "../configurations.js";
import storage from "../storage/storage.js";
import aem from "../aem/aem.js";

export const Events = {
  STARTED: "asc:download:started",
  COMPLETE: "asc:download:complete",
  FAILED: "asc:download:failed",
  CHANGED: "asc:download:change",
};

export const Status = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETE: "complete",
  FAILED: "failed",
};

/**
 * Downloads service — manages async AEM bulk download jobs.
 *
 * Storage schema (stored under storage.DOWNLOAD_JOBS, user-scoped):
 * {
 *   jobs: {
 *     [localId]: {
 *       id:           string,    // crypto.randomUUID() — local job ID
 *       collectionId: string,    // source collection ID (for reference)
 *       assetPaths:   string[],  // JCR paths of assets to download
 *       renditionIds: string[],  // rendition IDs (e.g. ['original', 'web'])
 *       status:       string,    // Status.PENDING | RUNNING | COMPLETE | FAILED
 *       aemJobId:     string,    // job ID returned by AEM download framework
 *       downloadUrl:  string,    // URL to trigger when job completes
 *       error:        string,    // error message on failure
 *       createdAt:    ISO,
 *       updatedAt:    ISO,
 *       expiresAt:    ISO,
 *     }
 *   }
 * }
 *
 * AEM Download API (configurable via configurations.downloads):
 *   Initiate: POST {aem.host}{initiateUrl}
 *     Body:   path=<jcrPath>&path=...&renditions=<id>&renditions=...
 *     Response: { jobId, status }
 *
 *   Poll:     GET  {aem.host}{initiateUrl}?jobId=<aemJobId>
 *     Response: { status: 'DONE'|'RUNNING'|'FAILED', downloadUrl }
 */
class Downloads {
  constructor(config) {
    this.config = config || {};
    // AEM endpoint for initiating and polling download jobs
    this.initiateUrl = this.config.initiateUrl || "/content/dam.downloads.initiateDownload.json";
    // TTL for stored jobs (default 7 days)
    this.jobExpiryMs = this.config.jobExpiry ?? 7 * 24 * 60 * 60 * 1000;
    // How long to fast-poll before giving up (default 15s)
    this.quickPollTimeoutMs = this.config.quickPollTimeout ?? 15_000;
    // Interval between polls (default 2s)
    this.pollIntervalMs = this.config.pollInterval ?? 2_000;

    this._cleanup();
  }

  // ── Storage helpers ───────────────────────────────────────────────────────

  _getData() {
    return storage.get(storage.DOWNLOAD_JOBS) || { jobs: {} };
  }

  _setData(data) {
    storage.set(storage.DOWNLOAD_JOBS, data);
  }

  _saveJob(job) {
    job.updatedAt = new Date().toISOString();
    const data = this._getData();
    data.jobs[job.id] = job;
    this._setData(data);
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { jobId: job.id, status: job.status },
      }),
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns all download jobs for the current user.
   * @returns {object[]}
   */
  getAll() {
    const { jobs } = this._getData();
    return Object.values(jobs).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }

  /**
   * Returns a single job by local ID.
   * @param {string} jobId
   * @returns {object | null}
   */
  get(jobId) {
    const { jobs } = this._getData();
    return jobs[jobId] ? { ...jobs[jobId] } : null;
  }

  /**
   * Initiates a bulk download job via the AEM download framework.
   * Returns immediately with the local job object. Polling runs asynchronously.
   *
   * If the job completes within the quickPollTimeout window, the browser download
   * is triggered automatically (unless autoDownload is false).
   *
   * @param {string[]} assetPaths  - JCR paths (e.g. '/content/dam/brand/hero.jpg')
   * @param {string[]} renditionIds - Rendition IDs (e.g. ['original'])
   * @param {object}  [opts]
   * @param {string}  [opts.collectionId]    - Source collection ID (for reference)
   * @param {boolean} [opts.autoDownload=true] - Auto-trigger download on completion
   * @returns {Promise<object>} Local job object (not yet complete)
   */
  async create(assetPaths, renditionIds, opts = {}) {
    const { collectionId = null, autoDownload = true } = opts;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const job = {
      id,
      collectionId,
      assetPaths: assetPaths || [],
      renditionIds: renditionIds || [],
      status: Status.PENDING,
      aemJobId: null,
      downloadUrl: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + this.jobExpiryMs).toISOString(),
    };
    this._saveJob(job);

    document.dispatchEvent(
      new CustomEvent(Events.STARTED, { detail: { jobId: id } }),
    );

    // Initiate + poll asynchronously — do not await
    this._initiateAndPoll(job, autoDownload);

    return { ...job };
  }

  /**
   * Resumes polling for a job that is still pending or running.
   * Useful when the quick-poll window expired and the user returns later.
   *
   * @param {string}  jobId
   * @param {boolean} [autoDownload=true]
   * @returns {Promise<object>} Updated job object
   */
  async resume(jobId, autoDownload = true) {
    const job = this.get(jobId);
    if (!job) throw new Error(`Download job "${jobId}" not found`);
    if (job.status === Status.COMPLETE || job.status === Status.FAILED) {
      return job;
    }
    await this._poll(job, autoDownload);
    return this.get(jobId);
  }

  /**
   * Triggers a browser download for a completed job.
   * @param {string} jobId
   */
  triggerDownload(jobId) {
    const job = this.get(jobId);
    if (!job || job.status !== Status.COMPLETE || !job.downloadUrl) return;
    this._triggerBrowserDownload(job.downloadUrl);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  async _initiateAndPoll(job, autoDownload) {
    try {
      const headers = await aem.getHeaders();
      const body = new URLSearchParams();
      job.assetPaths.forEach((p) => body.append("path", p));
      job.renditionIds.forEach((r) => body.append("renditions", r));

      const res = await fetch(aem.getUrl(this.initiateUrl), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
        credentials: "include",
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`AEM download initiation failed: HTTP ${res.status}`);
      const data = await res.json();

      const current = this.get(job.id);
      if (!current) return;
      current.aemJobId = data.jobId || data.id || data.downloadJobId || null;
      current.status = Status.RUNNING;
      this._saveJob(current);

      await this._poll(current, autoDownload);
    } catch (err) {
      const current = this.get(job.id);
      if (current) {
        current.status = Status.FAILED;
        current.error = err.message;
        this._saveJob(current);
        document.dispatchEvent(
          new CustomEvent(Events.FAILED, {
            detail: { jobId: job.id, error: err.message },
          }),
        );
      }
    }
  }

  async _poll(job, autoDownload) {
    if (!job.aemJobId) return;

    const deadline = Date.now() + this.quickPollTimeoutMs;
    const headers = await aem.getHeaders();
    const statusUrl = `${aem.getUrl(this.initiateUrl)}?jobId=${encodeURIComponent(job.aemJobId)}`;

    while (Date.now() < deadline) {
      await this._sleep(this.pollIntervalMs);

      const current = this.get(job.id);
      if (!current) return; // job was removed

      try {
        const res = await fetch(statusUrl, { headers, credentials: "include" });
        if (!res.ok) continue;
        const data = await res.json();
        const aemStatus = (data.status || "").toUpperCase();

        if (aemStatus === "DONE" || aemStatus === "COMPLETE" || aemStatus === "COMPLETED") {
          current.status = Status.COMPLETE;
          current.downloadUrl = data.downloadUrl || data.url || null;
          this._saveJob(current);

          document.dispatchEvent(
            new CustomEvent(Events.COMPLETE, {
              detail: { jobId: job.id, downloadUrl: current.downloadUrl },
            }),
          );

          if (autoDownload && current.downloadUrl) {
            this._triggerBrowserDownload(current.downloadUrl);
          }
          return;
        }

        if (aemStatus === "FAILED" || aemStatus === "ERROR") {
          current.status = Status.FAILED;
          current.error = data.error || "Download job failed on AEM";
          this._saveJob(current);
          document.dispatchEvent(
            new CustomEvent(Events.FAILED, {
              detail: { jobId: job.id, error: current.error },
            }),
          );
          return;
        }
      } catch {
        // Network hiccup — keep trying until deadline
      }
    }

    // Quick-poll window expired — job left in RUNNING state for later resume
    const current = this.get(job.id);
    if (current && current.status === Status.RUNNING) {
      this._saveJob(current); // touch updatedAt so user knows when we last checked
    }
  }

  _sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
  }

  _triggerBrowserDownload(url) {
    const a = document.createElement("a");
    a.href = aem.getUrl(url.startsWith("http") ? url.replace(/^https?:\/\/[^/]+/, "") : url);
    a.download = "assets.zip";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Removes expired jobs from storage.  Called once at construction.
   */
  _cleanup() {
    const data = this._getData();
    const now = Date.now();
    let changed = false;
    Object.keys(data.jobs).forEach((id) => {
      if (new Date(data.jobs[id].expiresAt).getTime() < now) {
        delete data.jobs[id];
        changed = true;
      }
    });
    if (changed) this._setData(data);
  }
}

export default new Downloads(serviceConfigurations.downloads || {});
