import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const claspConfigPath = path.join(projectRoot, '.clasp.config.json');

const args = process.argv.slice(2);
const envArg = args.find(arg => arg.startsWith('--env=')) || '--env=test';
const env = envArg.replace('--env=', '').trim();
const shouldDeploy = args.includes('--deploy');
const deepCheck = args.includes('--deep');

if (!['test', 'prod'].includes(env)) {
  console.error('❌ --env は test または prod を指定してください。');
  process.exit(1);
}

if (env === 'prod' && !args.includes('--allow-prod')) {
  console.error('❌ prod 環境を確認する場合は --allow-prod を付けてください。');
  process.exit(1);
}

/**
 * @param {string} command
 */
function run(command) {
  execSync(command, {
    cwd: projectRoot,
    stdio: 'inherit',
    encoding: 'utf8',
  });
}

/**
 * @param {string} message
 */
function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

/**
 * @param {string} message
 */
function pass(message) {
  console.log(`✅ ${message}`);
}

/**
 * @param {string} baseUrl
 * @param {Record<string, string>} query
 */
function buildUrl(baseUrl, query = {}) {
  const url = new URL(baseUrl);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

if (!fs.existsSync(claspConfigPath)) {
  fail(`${claspConfigPath} が見つかりません。`);
}

/** @type {Record<string, {deploymentId?: string}>} */
let claspConfig;
try {
  claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));
} catch {
  fail('.clasp.config.json の読み込みに失敗しました。');
}

const deploymentId = claspConfig[env]?.deploymentId;
if (!deploymentId) {
  fail(`.clasp.config.json の ${env} に deploymentId がありません。`);
}

const execUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;

if (shouldDeploy) {
  console.log(`🚀 ${env} 環境へ最新コードを反映します...`);
  if (env === 'test') {
    run('npm run dev');
  } else {
    run('npm run release');
  }
}

console.log(`🔎 smokeチェックを開始します (${env})`);
console.log(`🔗 ${execUrl}`);

/**
 * @param {string} url
 */
async function fetchPage(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    fail(`HTTP ${response.status} (${url})`);
  }
  return response.text();
}

const html = await fetchPage(buildUrl(execUrl, { debug: 'true' }));
if (!html.includes('[テスト]きぼりの よやく・きろく') && env === 'test') {
  fail('テスト環境タイトルが見つかりません。');
}
if (!html.includes('goog.script.init(')) {
  fail('GASクライアント初期化スクリプトが見つかりません。');
}
if (!html.includes('getCacheVersions') || !html.includes('getBatchData')) {
  fail('主要エンドポイント名がHTML内に見つかりません。');
}
pass('通常画面の疎通チェック');

if (deepCheck) {
  const perfHtml = await fetchPage(buildUrl(execUrl, { test: 'true' }));
  if (perfHtml.includes('パフォーマンス改善テスト')) {
    pass('test=true 画面の疎通チェック');
  } else if (perfHtml.includes('test_performance_webapp')) {
    console.warn(
      '⚠️ test=true は test_performance_webapp 不在のため確認をスキップしました。',
    );
  } else {
    fail('test=true の画面確認に失敗しました。');
  }
}

console.log('🎉 GAS smokeチェックが完了しました。');
