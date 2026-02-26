import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const projectRoot = process.cwd();
const reviewDumpDir = path.join(projectRoot, '.tmp');
const fetchCommentsScript =
  '/Users/kawasakiseiji/.codex/skills/gh-address-comments/scripts/fetch_comments.py';

/**
 * @param {string} command
 * @param {{ allowFailure?: boolean; capture?: boolean }} [options]
 * @returns {string}
 */
function run(command, options = {}) {
  const { allowFailure = false, capture = true } = options;
  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    if (!capture) {
      return '';
    }
    return output.trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    throw error;
  }
}

/**
 * @param {string} message
 */
function info(message) {
  console.log(`[INFO] ${message}`);
}

/**
 * @param {string} message
 */
function success(message) {
  console.log(`[OK] ${message}`);
}

/**
 * @param {string} message
 */
function warn(message) {
  console.log(`[WARN] ${message}`);
}

/**
 * @param {string} message
 */
function fail(message) {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
}

function ensureGhAuthenticated() {
  try {
    run('gh auth status', { capture: false });
  } catch {
    fail('GitHub CLI が未認証です。`gh auth login` 後に再実行してください。');
  }
}

function ensureCleanWorkingTree() {
  const status = run('git status --porcelain', { allowFailure: true });
  if (!status) {
    return;
  }

  const changed = status
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 10);
  const summary = changed.join(', ');
  fail(
    `未コミット差分があります。先に commit / stash してください。対象: ${summary}`,
  );
}

/**
 * @param {string} branch
 * @returns {{
 *   number: number;
 *   url: string;
 *   state: string;
 *   reviewDecision: string | null;
 *   mergeStateStatus: string;
 *   isDraft: boolean;
 *   title: string;
 * }}
 */
function ensurePullRequest(branch) {
  const existingJson = run(
    `gh pr list --head "${branch}" --state open --json number,url,state,reviewDecision,mergeStateStatus,isDraft,title`,
    { allowFailure: true },
  );

  if (existingJson) {
    const existing = JSON.parse(existingJson);
    if (Array.isArray(existing) && existing.length > 0) {
      return existing[0];
    }
  }

  info(`ブランチ "${branch}" のPRがないため作成します。`);
  const createdUrl = run('gh pr create --fill');
  if (!createdUrl) {
    fail('PRの作成に失敗しました。');
  }

  const viewJson = run(
    'gh pr view --json number,url,state,reviewDecision,mergeStateStatus,isDraft,title',
  );
  return JSON.parse(viewJson);
}

/**
 * @param {number} prNumber
 */
function tryEnableAutoMerge(prNumber) {
  const command = `gh pr merge ${prNumber} --auto --squash --delete-branch`;
  try {
    run(command, { capture: false });
    success('auto-merge（squash + delete-branch）を設定しました。');
  } catch {
    warn(
      'auto-merge設定は未完了です（権限/保護ルール/状態を確認してください）。',
    );
  }
}

/**
 * @param {number} prNumber
 */
function fetchUnresolvedThreads(prNumber) {
  if (!fs.existsSync(fetchCommentsScript)) {
    warn(
      `レビュー取得スクリプトが見つからないためスキップします: ${fetchCommentsScript}`,
    );
    return [];
  }

  const payloadRaw = run(`python3 "${fetchCommentsScript}"`, {
    allowFailure: true,
  });
  if (!payloadRaw) {
    warn('レビューコメントの取得に失敗したためスキップします。');
    return [];
  }

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    warn('レビューコメントJSONの解析に失敗したためスキップします。');
    return [];
  }

  const threads = Array.isArray(payload.review_threads)
    ? payload.review_threads
    : [];
  const unresolved = threads.filter(thread => !thread.isResolved);

  fs.mkdirSync(reviewDumpDir, { recursive: true });
  const dumpPath = path.join(
    reviewDumpDir,
    `pr-${prNumber}-review-threads.json`,
  );
  fs.writeFileSync(dumpPath, JSON.stringify(payload, null, 2), 'utf8');
  info(`レビュー情報を保存しました: ${dumpPath}`);

  return unresolved;
}

function main() {
  ensureGhAuthenticated();

  const branch = run('git rev-parse --abbrev-ref HEAD');
  if (!branch || branch === 'main') {
    info('現在 main ブランチです。PR作成フローを実行しないため終了します。');
    return;
  }

  ensureCleanWorkingTree();
  info(`現在ブランチ: ${branch}`);
  run(`git push -u origin "${branch}"`, { capture: false });

  const pr = ensurePullRequest(branch);
  info(`PR: #${pr.number} ${pr.url}`);

  tryEnableAutoMerge(pr.number);

  const prStateRaw = run(
    `gh pr view ${pr.number} --json number,url,state,reviewDecision,mergeStateStatus,isDraft,title`,
  );
  const prState = JSON.parse(prStateRaw);

  info(
    `状態: state=${prState.state}, reviewDecision=${prState.reviewDecision || 'NONE'}, mergeState=${prState.mergeStateStatus}`,
  );

  if (prState.state === 'MERGED') {
    success('PRは既にマージ済みです。ローカルブランチ整理を行います。');
    run('git checkout main', { capture: false });
    run('git pull --ff-only origin main', { capture: false });
    run(`git branch -d "${branch}"`, { capture: false });
    success('ローカルブランチを整理しました。');
    return;
  }

  const unresolved = fetchUnresolvedThreads(pr.number);
  if (prState.reviewDecision === 'CHANGES_REQUESTED' || unresolved.length > 0) {
    warn(
      `未解決レビューがあります（reviewDecision=${prState.reviewDecision || 'NONE'}, unresolvedThreads=${unresolved.length}）。`,
    );
    console.log(
      '次アクション: コメント修正を実施し、再度 `npm run pr:auto` を実行してください。',
    );
    return;
  }

  info(
    'レビュー待ち、またはCI待ちです。条件が揃えばGitHubが自動マージします。',
  );
}

main();
