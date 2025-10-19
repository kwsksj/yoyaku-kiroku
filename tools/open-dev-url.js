import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.argv[2];
const urlType = process.argv[3] || 'dev'; // dev, exec, spreadsheet, script

if (!env) {
  console.error('❌ 環境を指定してください (prod または test)');
  console.error('使用例: npm run dev:open:test [dev|exec|spreadsheet|script]');
  process.exit(1);
}

const claspConfigFile = path.join(__dirname, '../.clasp.config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(claspConfigFile, 'utf8'));
} catch {
  console.error(`❌ ${claspConfigFile} の読み込みに失敗しました。`);
  process.exit(1);
}

const { deploymentId, scriptId, spreadsheetId } = config[env] || {};

let url;
let urlName;

switch (urlType) {
  case 'dev':
    if (!deploymentId) {
      console.error(
        `❌ ${env} の deploymentId が clasp.config.json に設定されていません。`,
      );
      process.exit(1);
    }
    url = `https://script.google.com/macros/s/${deploymentId}/dev`;
    urlName = '開発用URL (Head Deployment)';
    break;

  case 'exec':
    if (!deploymentId) {
      console.error(
        `❌ ${env} の deploymentId が clasp.config.json に設定されていません。`,
      );
      process.exit(1);
    }
    url = `https://script.google.com/macros/s/${deploymentId}/exec`;
    urlName = '公開URL (Published Deployment)';
    break;

  case 'spreadsheet':
    if (!spreadsheetId) {
      console.error(
        `❌ ${env} の spreadsheetId が clasp.config.json に設定されていません。`,
      );
      process.exit(1);
    }
    url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    urlName = 'スプレッドシート';
    break;

  case 'script':
    if (!scriptId) {
      console.error(
        `❌ ${env} の scriptId が clasp.config.json に設定されていません。`,
      );
      process.exit(1);
    }
    url = `https://script.google.com/home/projects/${scriptId}/edit`;
    urlName = 'スクリプトエディタ';
    break;

  default:
    console.error(`❌ 不正なURLタイプ: ${urlType}`);
    console.error('使用可能: dev, exec, spreadsheet, script');
    process.exit(1);
}

console.log(`✅ ${urlName}を生成しました:`);
console.log(url);

let openCommand;
switch (process.platform) {
  case 'darwin': // macOS
    openCommand = 'open';
    break;
  case 'win32': // Windows
    openCommand = 'start';
    break;
  default: // Linux, etc.
    openCommand = 'xdg-open';
    break;
}

console.log(`🔄 ブラウザで開いています...`);
exec(`${openCommand} "${url}"`, error => {
  if (error) {
    console.error(
      `❌ ブラウザを自動で開けませんでした。上記URLをコピーして手動で開いてください。`,
    );
    console.error(error);
  }
});
