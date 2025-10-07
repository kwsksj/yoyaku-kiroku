/**
 * =================================================================
 * 統合ビルドツール
 * GAS開発用: 開発時は分離ファイル、デプロイ時は統合HTML
 * =================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 時刻フォーマット関数
const formatTime = () => {
  const now = new Date();
  return now.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

class UnifiedBuilder {
  constructor(config = {}) {
    this.srcDir = config.srcDir || 'build-output';
    this.devDir = config.devDir || 'src';
    this.backendDir = path.join(this.devDir, 'backend');
    this.frontendDir = path.join(this.devDir, 'frontend');
    this.templateDir = path.join(this.devDir, 'templates');
  }

  /**
   * 統合ビルド実行
   */
  async build() {
    console.log(`[${formatTime()}] 🚀 Starting unified build process...`);

    // build-outputディレクトリをクリーンアップして再作成
    if (fs.existsSync(this.srcDir)) {
      fs.rmSync(this.srcDir, { recursive: true, force: true });
      console.log(`[${formatTime()}] 🧹 Cleaned ${this.srcDir} directory.`);
    }
    fs.mkdirSync(this.srcDir, { recursive: true });

    try {
      // バックエンドファイルをコピー
      await this.buildBackendFiles();

      // 統合WebAppファイルを生成
      await this.buildUnifiedWebApp();

      console.log(`[${formatTime()}] ✅ Unified build completed successfully!`);
      console.log(`[${formatTime()}]    📁 Output files in: ${this.srcDir}/`);
    } catch (error) {
      console.error(`[${formatTime()}] ❌ Build failed:`, error);
      process.exit(1);
    }
  }

  /**
   * 現在の環境を判定（.clasp.jsonから）
   */
  detectEnvironment() {
    const claspJsonPath = path.join(process.cwd(), '.clasp.json');
    const claspConfigPath = path.join(process.cwd(), '.clasp.config.json');

    if (!fs.existsSync(claspJsonPath) || !fs.existsSync(claspConfigPath)) {
      console.log(
        `[${formatTime()}]    ⚠️  Environment detection failed, defaulting to test`,
      );
      return false; // デフォルトはテスト環境
    }

    const claspJson = JSON.parse(fs.readFileSync(claspJsonPath, 'utf8'));
    const claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));

    // 現在のscriptIdが本番環境のものと一致するか確認
    const isProduction = claspJson.scriptId === claspConfig.prod.scriptId;

    console.log(
      `[${formatTime()}]    🔍 Environment detected: ${isProduction ? 'PRODUCTION' : 'TEST'}`,
    );

    return isProduction;
  }

  /**
   * バックエンドJSファイルをsrcにコピー（環境判定値を注入）
   */
  async buildBackendFiles() {
    console.log(`[${formatTime()}] 🔨 Building backend files...`);

    if (!fs.existsSync(this.backendDir)) {
      console.log(
        `[${formatTime()}]    ⚠️  Backend directory not found: ${this.backendDir}`,
      );
      return;
    }

    // 環境判定
    const isProduction = this.detectEnvironment();

    const backendFiles = fs
      .readdirSync(this.backendDir)
      .filter(file => file.endsWith('.js') || file === 'appsscript.json')
      .sort();

    for (const jsFile of backendFiles) {
      const srcPath = path.join(this.backendDir, jsFile);
      const destPath = path.join(this.srcDir, jsFile);

      // 00_Constants.jsの場合は環境判定値を書き換え
      if (jsFile === '00_Constants.js') {
        let content = fs.readFileSync(srcPath, 'utf8');

        // PRODUCTION_MODE の値をビルド時の環境に応じて設定
        content = content.replace(
          /PRODUCTION_MODE:\s*[^,]+,/,
          `PRODUCTION_MODE: ${isProduction},`,
        );

        fs.writeFileSync(destPath, content);
        console.log(
          `[${formatTime()}]   ✅ ${jsFile} copied (PRODUCTION_MODE=${isProduction})`,
        );
      } else {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[${formatTime()}]   ✅ ${jsFile} copied`);
      }
    }
  }

  /**
   * 統合WebAppファイルを生成
   */
  async buildUnifiedWebApp() {
    console.log(`[${formatTime()}] 🔨 Building unified WebApp HTML...`);

    // HTMLテンプレートを読み込み
    const templatePath = path.join(this.templateDir, '10_WebApp.html');
    let htmlContent = '';

    if (fs.existsSync(templatePath)) {
      htmlContent = fs.readFileSync(templatePath, 'utf8');
      console.log(`[${formatTime()}]   📄 HTML template loaded`);
    } else {
      // デフォルトHTMLテンプレートを生成
      htmlContent = this.generateDefaultHtmlTemplate();
      console.log(`[${formatTime()}]   📄 Default HTML template generated`);
    }

    // フロントエンドJavaScriptファイルを統合
    const unifiedJs = await this.buildUnifiedJavaScript();

    // HTMLテンプレート内のincludeディレクティブを置換
    const finalHtml = this.replaceIncludeDirectives(htmlContent, unifiedJs);

    // 統合HTMLファイルを出力
    const outputPath = path.join(this.srcDir, '10_WebApp.html');
    fs.writeFileSync(outputPath, finalHtml);

    console.log(`[${formatTime()}]   ✅ Unified WebApp HTML generated`);
  }

  /**
   * フロントエンドJavaScriptファイルを統合
   */
  async buildUnifiedJavaScript() {
    console.log(`[${formatTime()}] 🔨 Unifying frontend JavaScript files...`);

    if (!fs.existsSync(this.frontendDir)) {
      console.log(
        `[${formatTime()}]    ⚠️  Frontend directory not found: ${this.frontendDir}`,
      );
      return this.generateFallbackJavaScript();
    }

    // 環境判定
    const isProduction = this.detectEnvironment();

    const frontendFiles = fs
      .readdirSync(this.frontendDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // ファイル名順で処理（GAS実行順序対応）

    let unifiedContent = '';

    // --- ▼▼▼ 定数ファイル自動注入 ▼▼▼ ---
    const constantsPath = path.join(this.backendDir, '00_Constants.js');
    if (fs.existsSync(constantsPath)) {
      let constantsContent = fs.readFileSync(constantsPath, 'utf8');

      // PRODUCTION_MODE の値をビルド時の環境に応じて設定
      constantsContent = constantsContent.replace(
        /PRODUCTION_MODE:\s*[^,]+,/,
        `PRODUCTION_MODE: ${isProduction},`,
      );

      unifiedContent += `
  // =================================================================
  // 00_Constants.js (自動注入 from backend)
  // =================================================================

`;
      unifiedContent += constantsContent + '\n';
      console.log(`[${formatTime()}]   ✅ 00_Constants.js injected`);
    }
    // --- ▲▲▲ 定数ファイル自動注入 ▲▲▲ ---

    // 統合JavaScriptヘッダー
    unifiedContent += this.generateJavaScriptHeader();

    // 各フロントエンドファイルを統合
    for (const jsFile of frontendFiles) {
      const filePath = path.join(this.frontendDir, jsFile);
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // ファイル情報コメントを追加
      unifiedContent += `\n  // =================================================================\n`;
      unifiedContent += `  // ${jsFile} (自動統合)\n`;
      unifiedContent += `  // =================================================================\n\n`;

      // ファイル内容を追加（インデント調整）
      const indentedContent = fileContent
        .split('\n')
        .map(line => (line.length > 0 ? `  ${line}` : line))
        .join('\n');

      unifiedContent += indentedContent + '\n';

      console.log(`[${formatTime()}]   ✅ ${jsFile} integrated`);
    }

    return unifiedContent;
  }

  /**
   * HTMLテンプレート内のincludeディレクティブを置換
   */
  replaceIncludeDirectives(htmlContent, unifiedJs) {
    // <?!= include('...'); ?>パターンを統合JavaScriptで置換
    const includePattern = /<\?!=\s*include\(['"]([\w_-]+)['"]\);\s*\?>/g;

    return htmlContent
      .replace(includePattern, (match, filename) => {
        // フロントエンド関連のincludeを統合JavaScriptに置換
        if (filename.match(/^1[1-4]_WebApp_/)) {
          return ''; // 後でまとめて挿入するため、個別includeは削除
        }
        return match; // その他のincludeはそのまま残す
      })
      .replace(
        // 最初のフロントエンドincludeの位置に統合JavaScriptを挿入
        /<!--\s*設定・定数\s*-->/,
        `<!-- 統合JavaScript (自動生成) -->\n<script>\n${unifiedJs}</script>`,
      );
  }

  /**
   * JavaScriptヘッダーを生成
   */
  generateJavaScriptHeader() {
    return `  // @ts-check
  /// <reference path="../html-globals.d.ts" />

  // グローバル変数宣言（VSCode TypeScript言語サーバー用）
  /* global CONSTANTS:readonly, STATUS:readonly, CLASSROOMS:readonly, ITEMS:readonly, HEADERS:readonly */
  /* global ITEM_TYPES:readonly, UNITS:readonly, PAYMENT_METHODS:readonly, UI:readonly, SESSIONS:readonly */
  /* global PAYMENT:readonly, BANK_INFO:readonly, BANK:readonly, MESSAGES:readonly, LOG_ACTIONS:readonly */
  /* global CLASSROOM_TYPES:readonly, SCHEDULE_STATUS:readonly, SHEET_NAMES:readonly, LIMITS:readonly */
  /* global DISCOUNT_OPTIONS:readonly, TIME_SETTINGS:readonly, SYSTEM:readonly, HEADERS_RESERVATIONS:readonly */
  /* global HEADERS_ROSTER:readonly, HEADERS_ACCOUNTING:readonly, HEADERS_SCHEDULE:readonly */
  /* global DesignConfig:readonly, stateManager:readonly, Components:readonly, pageTransitionManager:readonly */
  /* global escapeHTML:readonly, formatDate:readonly, showLoading:readonly, hideLoading:readonly */
  /* global showInfo:readonly, showConfirm:readonly, debugLog:readonly, getTuitionItemRule:readonly */
  /* global getTimeBasedTuitionHtml:readonly, createReservationCard:readonly, findReservationByDateAndClassroom:readonly */
  /* global isTimeBasedClassroom:readonly, getClassroomTimesFromSchedule:readonly, buildSalesChecklist:readonly */
  /* global findReservationById:readonly, google:readonly, server:readonly, MockData:readonly */
  /* global isProduction:readonly, C:readonly */

  // ESLintワンライン無効化
  /* eslint-disable no-undef */

  /**
   * =================================================================
   * 統合フロントエンドJavaScript (自動生成)
   * Generated: ${new Date().toISOString()}
   * =================================================================
   */
`;
  }

  /**
   * デフォルトHTMLテンプレートを生成
   */
  generateDefaultHtmlTemplate() {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <base target="_top">
    <title>きぼりの よやく・きろく</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body class="bg-brand-bg min-h-screen">
    <div id="app" class="container mx-auto px-4 max-w-lg">
        <!-- ローディング画面 -->
        <div id="loading" class="loading-fade fixed inset-0 flex flex-col items-center justify-center z-50">
            <div class="spinner mb-4"></div>
            <p id="loading-message" class="text-brand-text">アプリケーションを読み込み中...</p>
        </div>

        <!-- メインコンテンツ -->
        <main id="main-content" class="py-6">
            <div id="view-container"></div>
        </main>

        <!-- モーダル -->
        <div id="modal-overlay" class="modal-overlay">
            <div id="modal-content" class="modal-content">
                <div id="modal-body"></div>
            </div>
        </div>

        <footer class="text-center text-sm text-brand-muted mt-4">
            きぼりの よやく・きろく
        </footer>
    </div>

    <!-- 設定・定数 -->
    <!-- 統合JavaScriptがここに挿入されます -->

    <script>
        // 環境判定・初期化処理
        const isProduction = window.location.href.includes('/exec?') ||
                            (window.location.href.includes('/macros/s/') &&
                             !window.location.href.includes('/dev'));
        const DEBUG_ENABLED = false;

        function debugLog(message) {
            if (isProduction || !DEBUG_ENABLED) return;
            console.log('🔍 [DEBUG]', new Date().toLocaleTimeString() + ':', message);
        }

        const isGAS = typeof google !== 'undefined' && typeof google.script !== 'undefined';

        function initializeApp() {
            debugLog('initializeApp実行開始');

            const checkReady = setInterval(() => {
                if (typeof stateManager !== 'undefined' &&
                    typeof stateManager?.dispatch === 'function' &&
                    typeof hideLoading === 'function') {
                    clearInterval(checkReady);
                    debugLog('初期化条件を満たしました！');

                    window.stateManager.dispatch({
                        type: 'SET_STATE',
                        payload: { view: 'login' }
                    });
                    hideLoading();
                }
            }, 300);
        }

        if (isGAS) {
            window.addEventListener('DOMContentLoaded', () => {
                initializeApp();
            });
        }
    </script>
</body>
</html>`;
  }

  /**
   * フォールバック用JavaScript生成
   */
  generateFallbackJavaScript() {
    return `  // フォールバック: フロントエンドディレクトリが見つからない場合
  console.log('⚠️ フロントエンドファイルが見つかりません。基本機能のみ利用可能です。');

  // 最小限のstateManager
  window.stateManager = {
    state: { view: 'login' },
    dispatch: function(action) {
      console.log('Fallback stateManager:', action);
    },
    getState: function() { return this.state; }
  };

  // 最小限のユーティリティ
  window.hideLoading = function() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  };`;
  }

  /**
   * ファイル監視モード
   */
  async watch() {
    console.log(`[${formatTime()}] 👀 Starting file watcher...`);

    const chokidar = await import('chokidar');

    const watchPaths = [];
    if (fs.existsSync(this.backendDir)) watchPaths.push(this.backendDir);
    if (fs.existsSync(this.frontendDir)) watchPaths.push(this.frontendDir);
    if (fs.existsSync(this.templateDir)) watchPaths.push(this.templateDir);

    if (watchPaths.length === 0) {
      console.log(
        `[${formatTime()}] ⚠️ 監視対象ディレクトリが見つかりません。まずsrcディレクトリを作成してください。`,
      );
      return;
    }

    const watcher = chokidar.default.watch(watchPaths, {
      ignored: /(^|[\/\\])\../, // 隠しファイルを無視
      persistent: true,
    });

    watcher
      .on('change', filePath => {
        console.log(`[${formatTime()}] 📝 File changed: ${filePath}`);
        this.build();
      })
      .on('add', filePath => {
        console.log(`[${formatTime()}] ➕ File added: ${filePath}`);
        this.build();
      })
      .on('unlink', filePath => {
        console.log(`[${formatTime()}] 🗑️ File removed: ${filePath}`);
        this.build();
      });

    console.log(`[${formatTime()}]    Watching: ${watchPaths.join(', ')}`);
    console.log(`[${formatTime()}]    Press Ctrl+C to stop watching`);
  }
}

// CLI実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const builder = new UnifiedBuilder();

  const command = process.argv[2];

  switch (command) {
    case 'build':
      await builder.build();
      break;
    case 'watch':
      await builder.watch();
      break;
    default:
      console.log(
        `[${formatTime()}] Usage: node unified-build.js [build|watch]`,
      );
      break;
  }
}

export default UnifiedBuilder;
