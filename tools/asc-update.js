#!/usr/bin/env node
/**
 * asc-update — upgrade the ASC framework (scripts/asc/core) in a downstream project
 * from an ASC template repo, without touching user-owned code.
 *
 * ASC Core (scripts/asc/core/**) is designed to be replaced wholesale: nothing user-owned
 * lives inside it, and it may only import scripts/asc/configurations.js from outside. This
 * script pulls the latest core from a template remote, leaves everything else alone, and
 * leaves the result on a branch for you to review — it never commits.
 *
 * Usage:
 *   node tools/asc-update.js [--remote <name>] [--ref <branch/tag>] [--force] [--no-branch]
 *
 * One-time setup (point at wherever your ASC template lives):
 *   git remote add asc-upstream git@github.com:davidjgonzalez/asset-share-commons-eds.git
 *
 * What it does:
 *   1. Aborts unless the working tree is clean.
 *   2. Fetches <remote>/<ref> and compares scripts/asc/core/VERSION (local vs upstream).
 *   3. Switches to a branch asc-update/<version> (unless --no-branch).
 *   4. Replaces scripts/asc/core/** wholesale from upstream.
 *   5. Runs `npm run lint` and checks that every import in the user-owned scripts/asc.js
 *      and scripts/scripts.js still resolves to a file that exists in the new core.
 *   6. Prints a summary + next steps. Review the diff, test, then commit.
 *
 * It never touches: configurations.js, asc.js, blocks/, styles/, tools/, fstab.yaml, or any
 * other user-owned file. EDS boilerplate files (aem.js, scripts.js, head.html, …) are also
 * left alone — scripts.js carries ASC hooks marked with `// ASC-HOOK` sentinels; refresh the
 * boilerplate separately and re-apply those (see docs/PROJECT_STRUCTURE.md "Upgrading").
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync, rmSync, readFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = 'scripts/asc/core';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const REMOTE = arg('remote', 'asc-upstream');
const REF = arg('ref', 'main');
const FORCE = arg('force', false);
const NO_BRANCH = arg('no-branch', false);

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

function fail(msg) {
  process.stderr.write(`\n✗ ${msg}\n`);
  process.exit(1);
}

function tryGit(args) {
  try { return git(args); } catch { return null; }
}

// 1. Clean working tree
if (git(['status', '--porcelain'])) {
  fail('Working tree is not clean. Commit or stash your changes first.');
}

// 2. Remote present?
const remotes = git(['remote']).split('\n');
if (!remotes.includes(REMOTE)) {
  fail(`Remote "${REMOTE}" not found. Add your ASC template remote, e.g.:\n`
    + `    git remote add ${REMOTE} git@github.com:davidjgonzalez/asset-share-commons-eds.git`);
}

process.stdout.write(`Fetching ${REMOTE}/${REF}…\n`);
try { git(['fetch', REMOTE, REF]); } catch { fail(`Could not fetch ${REMOTE}/${REF}.`); }

// 3. Version delta
const localVersion = existsSync(join(ROOT, CORE, 'VERSION'))
  ? readFileSync(join(ROOT, CORE, 'VERSION'), 'utf8').trim() : '(none)';
const upstreamVersion = tryGit(['show', `${REMOTE}/${REF}:${CORE}/VERSION`])?.trim() || '(none)';

process.stdout.write(`ASC Core version: local ${localVersion} → upstream ${upstreamVersion}\n`);
if (localVersion === upstreamVersion && !FORCE) {
  process.stdout.write('Already up to date. Use --force to re-apply anyway.\n');
  process.exit(0);
}

// 4. Branch
if (!NO_BRANCH) {
  const branch = `asc-update/${upstreamVersion}`;
  const exists = tryGit(['rev-parse', '--verify', branch]) !== null;
  git(['checkout', exists ? branch : '-b', branch]);
  process.stdout.write(`On branch ${branch}\n`);
}

// 5. Replace core wholesale
process.stdout.write(`Replacing ${CORE}/ from ${REMOTE}/${REF}…\n`);
rmSync(join(ROOT, CORE), { recursive: true, force: true });
git(['checkout', `${REMOTE}/${REF}`, '--', CORE]);

// 6a. Lint
let lintOk = true;
try {
  execFileSync('npm', ['run', 'lint'], { cwd: ROOT, stdio: 'inherit' });
} catch {
  lintOk = false;
}

// 6b. Import-resolution check on the user-owned files that deep-import core.
const IMPORT_RE = /(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const USER_FILES = ['scripts/asc.js', 'scripts/scripts.js'];
const brokenImports = [];
USER_FILES.forEach((rel) => {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return;
  const src = readFileSync(abs, 'utf8');
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1] || m[2];
    if (!spec || !spec.startsWith('.')) continue;
    const target = resolve(dirname(abs), spec);
    if (!existsSync(target)) brokenImports.push(`${rel} → ${spec}`);
  }
});

// Summary
const changed = tryGit(['diff', '--stat', CORE]) || '(no changes)';
process.stdout.write('\n──────── asc-update summary ────────\n');
process.stdout.write(`${CORE} changes:\n${changed}\n\n`);
process.stdout.write(`lint: ${lintOk ? 'passed' : 'FAILED — review before committing'}\n`);
if (brokenImports.length) {
  process.stdout.write('broken imports in user files (a core export was renamed/moved):\n');
  brokenImports.forEach((b) => process.stdout.write(`  - ${b}\n`));
} else {
  process.stdout.write('imports in scripts/asc.js and scripts/scripts.js all resolve.\n');
}
process.stdout.write('\nNext: review the diff, run the app, then commit.\n');
if (!lintOk || brokenImports.length) process.exit(2);
