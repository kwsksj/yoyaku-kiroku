import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.argv[2];
if (!env) {
  console.error('❌ 環境を指定してください (prod または test)');
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

const deploymentId = config[env]?.deploymentId;

if (!deploymentId) {
  console.error(`❌ ${env} の deploymentId が clasp.config.json に設定されていません。`);
  console.error(
    '👉 GASエディタの「デプロイ」>「デプロイをテスト」からヘッドデプロイIDを取得して設定してください。',
  );
  process.exit(1);
}

const devUrl = `https://script.google.com/macros/s/${deploymentId}/dev`;

console.log(`✅ 開発用URLを生成しました:`);
console.log(devUrl);

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

console.log(`
🔄 ブラウザで開いています...`);
exec(`${openCommand} "${devUrl}"`, error => {
  if (error) {
    console.error(`❌ ブラウザを自動で開けませんでした。上記URLをコピーして手動で開いてください。`);
    console.error(error);
  }
});
