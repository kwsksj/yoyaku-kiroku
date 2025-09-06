/**
 * =================================================================
 * JavaScript → HTML ビルドツール
 * GAS開発用: 開発時は.jsファイル、デプロイ時はHTML内<script>に自動変換
 * =================================================================
 */

const fs = require('fs');
const path = require('path');

class JSToHTMLBuilder {
  constructor(config = {}) {
    this.srcDir = config.srcDir || 'src';
    this.devDir = config.devDir || 'dev';
    this.templateDir =
      config.templateDir || path.join(this.devDir, 'templates');
    this.backendDir = path.join(this.devDir, 'backend');
    this.frontendDir = path.join(this.devDir, 'frontend');
  }

  /**
   * フロントエンドJSファイルをHTML形式に変換
   */
  async buildFrontendFiles() {
    console.log('🔨 Building frontend JS → HTML...');

    const frontendFiles = fs
      .readdirSync(this.frontendDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // ファイル名順で処理（GAS実行順序対応）

    for (const jsFile of frontendFiles) {
      const jsPath = path.join(this.frontendDir, jsFile);
      const htmlFile = jsFile.replace('.js', '.html');
      const htmlPath = path.join(this.srcDir, htmlFile);

      await this.convertJSToHTML(jsPath, htmlPath);
      console.log(`  ✅ ${jsFile} → ${htmlFile}`);
    }
  }

  /**
   * バックエンドJSファイルをsrcにコピー
   */
  async buildBackendFiles() {
    console.log('🔨 Copying backend JS files...');

    const backendFiles = fs
      .readdirSync(this.backendDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    for (const jsFile of backendFiles) {
      const srcPath = path.join(this.backendDir, jsFile);
      const destPath = path.join(this.srcDir, jsFile);

      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ ${jsFile} copied`);
    }
  }

  /**
   * JSファイルをHTML形式に変換
   */
  async convertJSToHTML(jsPath, htmlPath) {
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // JSコメントからメタ情報を抽出
    const metaInfo = this.extractMetaInfo(jsContent);

    const htmlTemplate = `<script>
  // @ts-check
  /// <reference path="../html-globals.d.ts" />

  // グローバル変数宣言（VSCode TypeScript言語サーバー用）
  /* global CONSTANTS:readonly, STATUS:readonly, CLASSROOMS:readonly, ITEMS:readonly, HEADERS:readonly, CLASSROOM_CAPACITIES:readonly */
  /* global ITEM_TYPES:readonly, UNITS:readonly, PAYMENT_METHODS:readonly, UI:readonly, SESSIONS:readonly, PAYMENT_DISPLAY:readonly */
  /* global PAYMENT:readonly, BANK_INFO:readonly, BANK:readonly, MESSAGES:readonly, LOG_ACTIONS:readonly, COLORS:readonly */
  /* global CLASSROOM_TYPES:readonly, SCHEDULE_STATUS:readonly, SHEET_NAMES:readonly, LIMITS:readonly */
  /* global DISCOUNT_OPTIONS:readonly, TIME_SETTINGS:readonly, SYSTEM:readonly, HEADERS_RESERVATIONS:readonly */
  /* global HEADERS_ROSTER:readonly, HEADERS_ACCOUNTING:readonly, HEADERS_SCHEDULE:readonly */
  /* global DesignConfig:readonly, stateManager:readonly, Components:readonly, pageTransitionManager:readonly */
  /* global escapeHTML:readonly, formatDate:readonly, showLoading:readonly, hideLoading:readonly, showInfo:readonly, showConfirm:readonly, debugLog:readonly */
  /* global getTuitionItemRule:readonly, getTimeBasedTuitionHtml:readonly, createReservationCard:readonly */
  /* global findReservationByDateAndClassroom:readonly, isTimeBasedClassroom:readonly */
  /* global getClassroomTimesFromSchedule:readonly, buildSalesChecklist:readonly, findReservationById:readonly */
  /* global google:readonly, server:readonly, MockData:readonly, isProduction:readonly, C:readonly */

  // ESLintワンライン無効化（window.escapeHTML等の既知問題回避）
  /* eslint-disable no-undef */

  // TypeScript window.property・DOM型エラー抑制（GAS環境固有の制約）
  // @ts-nocheck
  /**
   * =================================================================
   * 【ファイル名】: ${path.basename(htmlPath)}
   * 【バージョン】: ${metaInfo.version || '1.0'} (JS→HTML自動変換)
   * 【役割】: ${metaInfo.description || 'JavaScript自動変換ファイル'}
   * ${metaInfo.notes ? `* ${metaInfo.notes}` : ''}
   * =================================================================
   */

${jsContent}
</script>
`;

    fs.writeFileSync(htmlPath, htmlTemplate);
  }

  /**
   * JSファイルからメタ情報を抽出
   */
  extractMetaInfo(jsContent) {
    const metaRegex = /\/\*\*[\s\S]*?\*\//;
    const match = jsContent.match(metaRegex);

    if (!match) return {};

    const metaComment = match[0];
    const versionMatch = metaComment.match(/【バージョン】:\s*([^\n]*)/);
    const descriptionMatch = metaComment.match(/【役割】:\s*([^\n]*)/);

    return {
      version: versionMatch ? versionMatch[1].trim() : null,
      description: descriptionMatch ? descriptionMatch[1].trim() : null,
    };
  }

  /**
   * メインビルド処理
   */
  async build() {
    console.log('🚀 Starting JS → HTML build process...');

    // srcディレクトリを初期化
    if (!fs.existsSync(this.srcDir)) {
      fs.mkdirSync(this.srcDir, { recursive: true });
    }

    try {
      await this.buildBackendFiles();
      await this.buildFrontendFiles();

      console.log('✅ Build completed successfully!');
      console.log(`   📁 Source files generated in: ${this.srcDir}/`);
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  }

  /**
   * ファイル監視モード
   */
  watch() {
    console.log('👀 Starting file watcher...');

    const chokidar = require('chokidar');

    const watcher = chokidar.watch([this.backendDir, this.frontendDir], {
      ignored: /(^|[\/\\])\../, // 隠しファイルを無視
      persistent: true,
    });

    watcher
      .on('change', filePath => {
        console.log(`📝 File changed: ${filePath}`);
        this.build();
      })
      .on('add', filePath => {
        console.log(`➕ File added: ${filePath}`);
        this.build();
      })
      .on('unlink', filePath => {
        console.log(`🗑️  File removed: ${filePath}`);
        this.build();
      });

    console.log(`   Watching: ${this.devDir}/**/*.js`);
    console.log('   Press Ctrl+C to stop watching');
  }
}

// CLI実行
if (require.main === module) {
  const builder = new JSToHTMLBuilder();

  const command = process.argv[2];

  switch (command) {
    case 'build':
      builder.build();
      break;
    case 'watch':
      builder.watch();
      break;
    default:
      console.log('Usage: node js-to-html-builder.js [build|watch]');
      break;
  }
}

module.exports = JSToHTMLBuilder;
