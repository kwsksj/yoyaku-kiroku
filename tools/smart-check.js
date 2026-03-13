import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const ENTRYPOINT_FILES = new Set([
  'src/backend/01_Code.js',
  'src/backend/09_Backend_Endpoints.js',
  'src/templates/10_WebApp.html',
]);

const CODE_TRIGGER_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'eslint.config.js',
  'tsconfig.json',
  'tsconfig.check.backend.json',
  'tsconfig.check.frontend.json',
  'tsconfig.backend.dts.json',
  'tsconfig.frontend.dts.json',
  'tsconfig.shared.dts.json',
  'AI_INSTRUCTIONS.md',
]);

/**
 * @typedef {{
 *   command: string;
 *   reason: string;
 *   required: boolean;
 *   finalOnly?: boolean;
 * }} SuggestedCommand
 */

/**
 * @returns {{
 *   phase: 'quick' | 'final';
 *   run: boolean;
 *   runOptional: boolean;
 *   json: boolean;
 * }}
 */
function parseArgs() {
  const args = process.argv.slice(2);

  /** @type {'quick' | 'final'} */
  let phase = 'quick';
  let run = false;
  let runOptional = false;
  let json = false;

  args.forEach(arg => {
    if (arg === '--phase=final') phase = 'final';
    if (arg === '--phase=quick') phase = 'quick';
    if (arg === '--run') run = true;
    if (arg === '--run-optional') runOptional = true;
    if (arg === '--json') json = true;
  });

  return { phase, run, runOptional, json };
}

/**
 * @returns {string[]}
 */
function getChangedPaths() {
  const output = execSync('git status --porcelain', {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  const paths = output
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line => (line.length > 3 ? line.slice(3) : ''))
    .map(line =>
      line.includes(' -> ') ? line.split(' -> ').pop() || '' : line,
    )
    .map(line => line.trim().replace(/\\/g, '/'))
    .filter(Boolean);

  return Array.from(new Set(paths)).sort();
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isDocPath(filePath) {
  return filePath.startsWith('docs/') || filePath.endsWith('.md');
}

/**
 * @param {string[]} paths
 */
function classify(paths) {
  const docsOnly = paths.length > 0 && paths.every(isDocPath);

  const hasCodeSurface = paths.some(filePath => {
    if (
      filePath.startsWith('src/') ||
      filePath.startsWith('tools/') ||
      filePath.startsWith('.github/workflows/')
    ) {
      return true;
    }
    return CODE_TRIGGER_FILES.has(filePath);
  });

  const hasGasSurface = paths.some(filePath => {
    if (
      filePath.startsWith('src/backend/') ||
      filePath.startsWith('src/frontend/') ||
      filePath.startsWith('src/shared/') ||
      filePath.startsWith('src/templates/')
    ) {
      return true;
    }
    return (
      filePath === 'tools/gas-smoke.js' || filePath === 'tools/unified-build.js'
    );
  });

  const touchesEntrypoint = paths.some(filePath =>
    ENTRYPOINT_FILES.has(filePath),
  );

  return { docsOnly, hasCodeSurface, hasGasSurface, touchesEntrypoint };
}

/**
 * @param {SuggestedCommand[]} commands
 * @param {SuggestedCommand} candidate
 */
function pushUnique(commands, candidate) {
  if (commands.some(item => item.command === candidate.command)) {
    return;
  }
  commands.push(candidate);
}

/**
 * @param {string[]} paths
 * @param {'quick' | 'final'} phase
 * @returns {SuggestedCommand[]}
 */
function suggestCommands(paths, phase) {
  /** @type {SuggestedCommand[]} */
  const commands = [];

  if (paths.length === 0) {
    pushUnique(commands, {
      command: 'npm run test',
      reason: '差分がないため、最小の疎通確認のみ任意実行。',
      required: false,
    });
    return commands;
  }

  const flags = classify(paths);

  if (flags.docsOnly) {
    pushUnique(commands, {
      command: 'npm run format',
      reason: 'ドキュメント変更のみのため、整形チェックを実行。',
      required: true,
    });
    return commands;
  }

  pushUnique(commands, {
    command: 'npm run test:changed',
    reason: '差分影響の高速確認。',
    required: true,
  });

  if (flags.hasCodeSurface) {
    pushUnique(commands, {
      command: 'npm run validate',
      reason: 'フォーマット・Lint・型チェックを一括確認。',
      required: true,
    });
  }

  if (flags.hasGasSurface) {
    pushUnique(commands, {
      command: 'npm run smoke:gas',
      reason: 'GAS実行面の疎通を副作用なしで確認。',
      required: true,
    });
  }

  if (flags.touchesEntrypoint) {
    pushUnique(commands, {
      command: 'npm run smoke:gas:deep',
      reason: '入口変更のため追加疎通を推奨。',
      required: false,
    });
  }

  if (phase === 'final' && flags.hasCodeSurface) {
    pushUnique(commands, {
      command: 'npm run dev',
      reason: '最終提出前の必須確認（運用ルール対応）。',
      required: true,
      finalOnly: true,
    });
  }

  return commands;
}

/**
 * @param {SuggestedCommand[]} commands
 * @param {string[]} paths
 * @param {'quick' | 'final'} phase
 */
function printPlan(commands, paths, phase) {
  console.log(`Phase: ${phase}`);
  console.log(`Changed paths: ${paths.length}`);
  paths.forEach(filePath => console.log(`- ${filePath}`));

  console.log('\nSuggested commands:');
  commands.forEach((item, index) => {
    const label = item.required ? 'REQUIRED' : 'OPTIONAL';
    const finalFlag = item.finalOnly ? ' FINAL' : '';
    console.log(`${index + 1}. [${label}${finalFlag}] ${item.command}`);
    console.log(`   reason: ${item.reason}`);
  });
}

/**
 * @param {SuggestedCommand[]} commands
 * @param {boolean} runOptional
 */
function runCommands(commands, runOptional) {
  const targets = commands.filter(item => item.required || runOptional);
  if (targets.length === 0) {
    console.log('実行対象のコマンドはありません。');
    return;
  }

  targets.forEach(item => {
    console.log(`\n▶ ${item.command}`);
    execSync(item.command, {
      cwd: process.cwd(),
      stdio: 'inherit',
      encoding: 'utf8',
    });
  });
}

function main() {
  const { phase, run, runOptional, json } = parseArgs();
  const repoName = path.basename(process.cwd());
  const paths = getChangedPaths();
  const commands = suggestCommands(paths, phase);

  const payload = {
    repo: repoName,
    phase,
    changedPaths: paths,
    commands,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printPlan(commands, paths, phase);
  }

  if (run) {
    runCommands(commands, runOptional);
  }
}

main();
