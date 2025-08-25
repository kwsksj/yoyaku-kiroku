import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const claspConfigFile = path.join(__dirname, '../.clasp.config.json');
const claspFile = path.join(__dirname, '../.clasp.json');

const env = process.argv[2];

if (!env) {
  console.error('❌ 環境を指定してください (prod または test)');
  process.exit(1);
}

console.log(`🔧 [${env}] 環境に切り替えています...`);

// 設定ファイルを読み込む
let config;
try {
  config = JSON.parse(fs.readFileSync(claspConfigFile, 'utf8'));
} catch (error) {
  console.error(`❌ ${claspConfigFile} の読み込みに失敗しました。`);
  process.exit(1);
}

if (!config[env]) {
  console.error(`❌ ${claspConfigFile} に ${env} の設定が見つかりません。`);
  process.exit(1);
}

const { scriptId, deploymentId } = config[env];

// .clasp.json を読み込む
let claspConfig;
try {
  claspConfig = JSON.parse(fs.readFileSync(claspFile, 'utf8'));
} catch (error) {
  console.error(`❌ ${claspFile} の読み込みに失敗しました。`);
  process.exit(1);
}

// scriptIdは常に必須
if (!scriptId) {
  console.error(`❌ ${env} の scriptId が設定されていません。`);
  process.exit(1);
}
claspConfig.scriptId = scriptId;

// 環境ごとのロジック
if (env === 'prod') {
  // 本番環境ではdeploymentIdは必須
  if (!deploymentId) {
    console.error('❌ 本番環境(prod)では deploymentId が必須です。');
    console.error('👉 .clasp.config.json を確認してください。');
    process.exit(1);
  }
  claspConfig.deploymentId = deploymentId;
  console.log(`   - Deployment ID: ${deploymentId}`);
} else if (env === 'test') {
  // テスト環境ではdeploymentIdは任意
  if (deploymentId) {
    claspConfig.deploymentId = deploymentId;
    console.log(`   - Deployment ID: ${deploymentId} (更新)`);
  } else {
    // deploymentIdがない場合は.clasp.jsonからキーを削除し、新規作成を促す
    delete claspConfig.deploymentId;
    console.log('   - Deployment ID: (なし) -> 新規デプロイを作成します。');
  }
}

// 不要になったカスタムIDを削除
delete claspConfig.prodScriptId;
delete claspConfig.testScriptId;

// .clasp.json を書き込む
try {
  fs.writeFileSync(claspFile, JSON.stringify(claspConfig, null, 2), 'utf8');
  console.log(`✅ .clasp.json を [${env}] 環境に更新しました。`);
  console.log(`   - Script ID: ${scriptId}`);
} catch (error) {
  console.error(`❌ ${claspFile} の書き込みに失敗しました。`);
  process.exit(1);
}
