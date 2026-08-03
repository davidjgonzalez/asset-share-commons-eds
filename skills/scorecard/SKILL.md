---
name: scorecard
description: Generate a self-contained HTML solution-fit scorecard scoring ASC against an external requirements pack (RFP, BR workbook, competitor disposition sheet)
instructions: Read a requirements document (or set of documents), identify each distinct source/company it covers, and produce one self-contained HTML scorecard per source scoring how well Asset Share Commons (ASC + its AEM/EDS platform) covers each requirement theme — grounded in actual codebase evidence, with concrete gap-closing recommendations.
related: asc-development
category: Solution Assessment
---

# Scorecard — ASC Solution-Fit Assessment

Turn a pile of customer/RFP requirements into a self-contained HTML scorecard that says, per
theme: does ASC cover this, what layer of the stack actually owns it, and — where it doesn't —
concretely how you'd close the gap.

## When to use

- A customer or prospect hands over a requirements workbook (BR doc, RFP, competitor
  fit-gap analysis) and asks "does ASC cover this?"
- You need a shareable, standalone artifact (no server, no build step) that a non-technical
  stakeholder can open and filter.
- You're comparing ASC against a named competitor/alternative (e.g. AEM Content Hub) and want
  the comparison to be explicit and honest, not just a list of ASC's own features.

## Hard rule: one company/source per HTML file

**Never combine two different requirement sources into a single scorecard file.** If the input
covers multiple companies or workbooks (e.g. a 3M-specific disposition sheet *and* a generic
Content Hub BR workbook), produce one HTML file per source, each fully self-contained. They can
share a template/CSS skeleton and cross-link to each other in their footers, but a reader must be
able to hand a single file to a single stakeholder without the other company's material in it.

## Inputs

- A requirements document — ideally row-level (CSV/XLSX with one row per requirement), but a
  consolidated theme-level summary (like a markdown digest of the CSVs) is workable too. **State
  which one you got** in the output's methodology callout — a thematic pass over a summary is a
  faster, less precise read than a row-by-row pass over the real CSV, and the reader needs to know
  which one they're holding.
- Read access to the ASC codebase being scored (this repo).

## Method

1. **Identify the distinct sources.** Split multi-company input packs before doing anything else.
   Shared cross-cutting material (open questions, known-limitations lists) usually belongs to
   *one* source, not all of them — check explicitly rather than assuming it applies everywhere
   (the BR/Content Hub workbook's "known limitations" list, for instance, is about Content Hub,
   not about the customer generally, and doesn't apply to a different customer's workbook in the
   same pack).

2. **Ground every score in code, not requirement wording.** For each requirement theme, actually
   check the ASC codebase before scoring it:
   - `scripts/asc/core/services/` — what services exist (search providers, collections, downloads,
     users/IMS, analytics, action-pages, properties, renditions) and what they actually do.
   - `blocks/*/` — what's rendered, what's config-driven, what's hardcoded.
   - `docs/` — especially `AGENTS.md`, `ANALYTICS.md`, `THEMING_README.md`, `UI_KIT.md` for
     capability claims that are already documented.
   - Grep for the literal capability keyword (`watermark`, `favorite`, `saved.search`, `i18n`,
     `audit`, etc.) before declaring something absent — confirm a true negative, don't assume one.
   - If you've verified something live in a browser during the same session (e.g. saw Adobe Smart
     Tags rendered in a details modal), that's *stronger* evidence than a grep match — cite it.

3. **Tag every theme with the layer that actually owns it.** ASC is a thin, fully-customizable
   front end. A lot of "requirements" are actually satisfied — or not — by the layers underneath
   it, and scoring those as ASC gaps is misleading. Check, in order:
   - **ASC front end** — the block/service/part code in this repo.
   - **AEM Author, Assets view** — ingestion, metadata editing, versioning, approval workflow,
     Dynamic Media processing profiles. This is where "standardized formats," "approved assets
     only," and "metadata governance" requirements actually resolve.
   - **AEM Author, Admin view** — permissions, workflow config, group/persona structure.
   - **Dynamic Media** (classic Scene7 *or* the newer OpenAPI) — rendition generation and
     delivery, watermarking, smart/AI search ranking, video encoding/streaming. ASC's own
     delivery URLs (`.../adobe/dynamicmedia/deliver/dm-aid--…`) are visible proof this is already
     in play wherever Dynamic Media is configured — don't score watermarking or smart search as
     ASC gaps without checking whether Dynamic Media already covers them.
   - **IMS / AEM admin console** — SSO, MFA, session management, bulk user provisioning,
     directory integration. Never an ASC front-end concern.
   - **Edge Delivery Services / aem.live, the platform** — distinct from "ASC the app." Concrete
     capabilities worth checking before calling something a gap: language-prefixed content trees
     for locale-aware sites, Live Search for indexing EDS-authored pages (as opposed to DAM
     assets — useful when "campaigns/programs" turn out to be authored pages, not assets), CDN/edge
     configuration (IP allow-listing, custom headers) since every EDS site runs on Fastly, and
     Sidekick/DA content self-service for business-user editing without a deploy.
   - **An external BI/analytics tool** — ASC's analytics bridge is designed to feed one, not
     replace one. "We need a dashboard" against ASC is almost always a misdirected requirement.

4. **Score each theme.** Four levels, consistently defined:
   - `strong` — fully covered today, by ASC or an inherited layer, with no material gap.
   - `partial` — real coverage exists, but with a concrete, nameable gap.
   - `gap` — not available anywhere in the stack today; would need net-new work.
   - `inherited` — correctly out of ASC's scope by design (e.g. approval workflow lives in AEM
     Author for every front end, including the competitor). Not a gap — flag it as such so it
     doesn't get miscounted as one.

5. **For every `partial` or `gap`, give a concrete closing path.** Never leave a gap unexplained.
   Categorize each recommendation into exactly one of four paths (a gap can have more than one
   recommendation, in different paths):
   - **Configuration** — a `configurations.js` toggle, a Dynamic Media processing profile, an
     existing config-driven block option. No code.
   - **Customization / extension** — new code, but within ASC's existing extension points (a new
     search provider, a new property handler, a new action-page, a block-level addition). Say
     *which* extension point it rides on, and roughly how contained the change is.
   - **EDS platform (aem.live)** — solved by adopting a platform capability (language folders,
     Live Search, edge/CDN config, a small serverless endpoint alongside the site) rather than by
     writing ASC application code.
   - **Reframe requirement** — the literal requirement as written doesn't fit, but the underlying
     business need can be met a different way that's worth proposing back (e.g. "copy a link and
     paste it into your own email client" instead of building an in-app email composer; "confirm
     this already exists in the IMS admin console" instead of building identity infrastructure a
     second time). This is a legitimate, first-class closing path — not a cop-out — as long as the
     underlying business value is genuinely still met.

   **For `config` and `extension` recommendations only**, add a runnable, concrete example behind
   an expandable disclosure (see template below) — but only if you can write one you're actually
   sure is correct:
   - Base it on code you've actually read this session, not on memory or a plausible-sounding
     guess. Cite the real file, the real method names, the real config key.
   - Check the ownership boundary before writing it: don't show an example that edits a file
     marked `// ASC Core — do not edit.` (`scripts/asc/core/services/**`, most of
     `scripts/asc/core/parts/**`). If the clean way to do something touches a Core file, redesign
     the example around Core's exposed extension point (a config key, a public method, a CSS
     custom-property hook) instead — or omit the example if there isn't one.
   - **If the requirement is too ambiguous to ground, or you can't verify the exact API/shape
     needed, omit the example entirely.** A close-path recommendation with no example is honest.
     A wrong or invented example is actively harmful — it's the one thing worse than not
     answering. When in doubt, grep/read the actual file before writing the snippet, and drop it
     if you still can't confirm it.

6. **Be honest about parity and losses, not just wins.** If ASC shares a limitation with whatever
   it's being compared against (e.g. neither has offline access, neither has saved-search
   history), say so plainly. A scorecard that only ever finds wins reads as a sales pitch and loses
   credibility on the wins that are real. When comparing against a named competitor's documented
   limitations, use that comparison as its own section (see template) — and still call out the
   competitor's genuine advantages where they exist (e.g. Content Hub's Adobe Express edit/remix
   integration, which ASC doesn't have).

## Output

One self-contained HTML file per source, saved to `reports/scorecards/<descriptive-slug>.html` in
this repo (create the directory if it doesn't exist). No external CSS/JS dependencies — everything
inline, so the file works when opened directly from disk or emailed as an attachment.

### Template structure

Copy the structure of the two reference files this skill produced —
`reports/scorecards/asc-solution-fit-br-contenthub.html` and
`reports/scorecards/asc-solution-fit-3m-cmas.html` — as the starting skeleton. Each file has:

1. **Header** — title, one-paragraph description naming the source workbook and its requirement
   count, a methodology callout (state thematic-vs-row-level basis, name the layers considered
   per step 3 above, and note the platform/EDS angle explicitly), a stat-grid summarizing counts
   per fit level, and two legends (fit levels; close-path categories).
2. **Theme-by-theme scorecard** — a filterable table (vanilla JS, no framework) with columns
   Theme / Owning layer / Fit (badge + notes + "How to close it" chips). Filter buttons toggle row
   visibility by fit level. Each `config`/`extension` chip that has a verified example renders a
   native `<details><summary>Show example</summary><pre><code>…</code></pre></details>` disclosure
   under it — zero extra JS needed beyond escaping the snippet text before inserting it (`&`, `<`,
   `>`), and it degrades fine when printed (both open and closed states are visible on paper).
3. **Open questions** (if the source has an explicit open-questions list) — answered from ASC's
   side where it's a genuine capability question; flagged not-applicable where it's a bug report
   or business/strategy question a scorecard can't settle.
4. **Known limitations of the thing being compared against** (if applicable) — restated as a
   direct comparison table, including honest parity/loss entries.
5. **Footer** — cross-link to sibling scorecard file(s) from the same pack, and a note that
   row-level CSVs (if not what was used) would sharpen the assessment further.

### Data-driven rendering

Keep theme/question/limitation content in a plain JS array of objects at the bottom of the file,
rendered into the DOM by a small script — this is what makes the file easy to regenerate: swap the
data array, keep the template. Shape:

```js
const THEMES = [
  {
    name: "Theme name",
    layer: "Which layer(s) own this — be specific (e.g. 'AEM Author Assets view', not just 'AEM')",
    level: "strong" | "partial" | "gap" | "inherited",
    notes: "Grounded assessment, citing actual code/services/docs.",
    close: [ // omit for pure 'strong'/'inherited' rows with nothing to close
      {
        path: "config" | "extension" | "eds" | "reframe",
        text: "Concrete, specific recommendation.",
        // Optional, config/extension only — omit the key entirely rather than
        // guess. See "verified example" rule in step 3 above.
        example: "// real, runnable code or config, grounded in a file you actually read",
      },
    ],
  },
];
```

## Verifying the output

Before handing off a generated scorecard:

- Open it in a browser (a local `file://` URL is fine) and confirm it renders with no console
  errors — `evaluate_script` a quick DOM check (`row count`, `h1 count`) is more reliable than
  trusting a full-page screenshot, which can visually tile/stitch oddly on very tall pages.
- Click through the filter buttons and confirm rows actually hide/show.
- Click open at least one `<details class="example-toggle">` and confirm the code renders legibly
  (no un-escaped `<`/`>` breaking the layout) — a quick `document.querySelectorAll('.example-toggle').length`
  check confirms the count matches how many examples you actually wrote.
- Re-read every `gap`/`partial` row and confirm it has at least one `close` entry — an unexplained
  gap is the one thing this format should never ship.
