import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const description = process.argv[2] || 'Updated deployment';

// .clasp.json を読み込む
const claspFile = path.join(__dirname, '../.clasp.json');
let claspConfig;
try {
  claspConfig = JSON.parse(fs.readFileSync(claspFile, 'utf8'));
} catch {
  console.error(`❌ ${claspFile} の読み込みに失敗しました。`);
  process.exit(1);
}

const { deploymentId } = claspConfig;

if (!deploymentId) {
  console.error('❌ .clasp.json に deploymentId が設定されていません。');
  console.error('新規デプロイを作成する場合は clasp deploy を直接実行してください。');
  process.exit(1);
}

console.log(`📦 既存デプロイを更新します: ${deploymentId}`);
console.log(`📝 説明: ${description}`);

try {
  execSync(
    `clasp deploy --deploymentId "${deploymentId}" --description "${description}"`,
    { stdio: 'inherit' },
  );
  console.log('✅ デプロイが正常に更新されました。');
} catch (error) {
  console.error('❌ デプロイの更新に失敗しました。');
  process.exit(1);
}
