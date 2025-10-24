/**
 * =================================================================
 * 統合ビルドツール
 * GAS開発用: 開発時は分離ファイル、デプロイ時は統合HTML
 * =================================================================
 */

import fs from 'fs';
import path from 'node:path';

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
    this.sharedDir = path.join(this.devDir, 'shared');
  }

  /**
   * 開発時のESM構文をGAS互換コードへ変換する
   */
  sanitizeModuleSyntax(content) {
    return this.removeExportStatements(this.removeImportStatements(content));
  }

  /**
   * 複数行の静的import宣言を除去する
   */
  removeImportStatements(content) {
    const lines = content.split('\n');
    const sanitized = [];
    let skippingImport = false;
    let braceDepth = 0;

    for (const line of lines) {
      if (!skippingImport && /^\s*import\b/.test(line)) {
        if (/^\s*import\s*(\(|\.)/.test(line)) {
          sanitized.push(line);
          continue;
        }

        skippingImport = true;
        braceDepth = this.updateBraceDepth(0, line);

        if (line.includes(';') && braceDepth <= 0) {
          skippingImport = false;
          braceDepth = 0;
        }
        continue;
      }

      if (skippingImport) {
        braceDepth = this.updateBraceDepth(braceDepth, line);

        if (line.includes(';') && braceDepth <= 0) {
          skippingImport = false;
          braceDepth = 0;
          continue;
        }

        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        if (!trimmed.startsWith('//') && braceDepth <= 0) {
          skippingImport = false;
          braceDepth = 0;
          sanitized.push(line);
          continue;
        }
        continue;
      }

      sanitized.push(line);
    }

    return sanitized.join('\n');
  }

  /**
   * import宣言内の波括弧深度を更新する
   */
  updateBraceDepth(currentDepth, line) {
    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;
    return currentDepth + open - close;
  }

  /**
   * export宣言を標準スコープ宣言へ置換する
   */
  removeExportStatements(content) {
    return content
      .replace(/^export const /gm, 'const ')
      .replace(/^export function /gm, 'function ')
      .replace(/^export class /gm, 'class ')
      .replace(/^export let /gm, 'let ')
      .replace(/^export var /gm, 'var ');
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

      // スタンドアロンHTMLダイアログファイルをコピー
      await this.buildStandaloneHtmlFiles();

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
   * バックエンドJSファイルをsrcにコピー（環境判定値を注入、export文を削除）
   */
  async buildBackendFiles() {
    console.log(`[${formatTime()}] 🔨 Building backend files...`);

    // 環境判定
    const isProduction = this.detectEnvironment();

    // 共有ファイルを先に処理
    const constantsFile = '00_Constants.js';
    const constantsSrcPath = path.join(this.sharedDir, constantsFile);
    if (fs.existsSync(constantsSrcPath)) {
      const constantsDestPath = path.join(this.srcDir, constantsFile);
      let content = fs.readFileSync(constantsSrcPath, 'utf8');

      // ESM構文をGAS互換へ変換
      content = this.sanitizeModuleSyntax(content);

      // 環境判定値を書き換え
      content = content.replace(
        /PRODUCTION_MODE:\s*[^,]+,/,
        `PRODUCTION_MODE: ${isProduction},`,
      );

      fs.writeFileSync(constantsDestPath, content);
      console.log(
        `[${formatTime()}]   ✅ ${constantsFile} (shared) processed for backend (PRODUCTION_MODE=${isProduction})`,
      );
    }

    if (!fs.existsSync(this.backendDir)) {
      console.log(
        `[${formatTime()}]    ⚠️  Backend directory not found: ${this.backendDir}`,
      );
      return;
    }

    const backendFiles = fs
      .readdirSync(this.backendDir)
      .filter(file => file.endsWith('.js') || file === 'appsscript.json')
      .sort();

    for (const jsFile of backendFiles) {
      const srcPath = path.join(this.backendDir, jsFile);
      const destPath = path.join(this.srcDir, jsFile);

      // JSファイルの場合は内容を変換
      if (jsFile.endsWith('.js')) {
        let content = fs.readFileSync(srcPath, 'utf8');

        // ESM構文をGAS互換へ変換
        content = this.sanitizeModuleSyntax(content);

        fs.writeFileSync(destPath, content);
        console.log(`[${formatTime()}]   ✅ ${jsFile} processed`);
      } else {
        // JSONファイルなどはそのままコピー
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

    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `❌ HTMLテンプレートが見つかりません: ${templatePath}\n   src/templates/10_WebApp.html を作成してください。`,
      );
    }

    const htmlContent = fs.readFileSync(templatePath, 'utf8');
    console.log(`[${formatTime()}]   📄 HTML template loaded`);

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
   * スタンドアロンHTMLダイアログファイルをコピー
   */
  async buildStandaloneHtmlFiles() {
    console.log(
      `[${formatTime()}] 🔨 Building standalone HTML dialog files...`,
    );

    if (!fs.existsSync(this.templateDir)) {
      console.log(
        `[${formatTime()}]    ⚠️  Template directory not found: ${this.templateDir}`,
      );
      return;
    }

    const htmlFiles = fs
      .readdirSync(this.templateDir)
      .filter(file => file.endsWith('.html') && file !== '10_WebApp.html');

    if (htmlFiles.length === 0) {
      console.log(`[${formatTime()}]    ℹ️  No standalone HTML files found`);
      return;
    }

    for (const htmlFile of htmlFiles) {
      const srcPath = path.join(this.templateDir, htmlFile);
      const destPath = path.join(this.srcDir, htmlFile);

      fs.copyFileSync(srcPath, destPath);
      console.log(`[${formatTime()}]   ✅ ${htmlFile} copied`);
    }
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
    const constantsPath = path.join(this.sharedDir, '00_Constants.js');
    if (fs.existsSync(constantsPath)) {
      let constantsContent = fs.readFileSync(constantsPath, 'utf8');

      // ESM構文をGAS互換へ変換
      constantsContent = this.sanitizeModuleSyntax(constantsContent);

      // PRODUCTION_MODE の値をビルド時の環境に応じて設定
      constantsContent = constantsContent.replace(
        /PRODUCTION_MODE:\s*[^,]+,/g,
        `PRODUCTION_MODE: ${isProduction},`,
      );

      unifiedContent += `
  // =================================================================
  // 00_Constants.js (自動注入 from shared)
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
      let fileContent = fs.readFileSync(filePath, 'utf8');

      // ESM構文をGAS互換へ変換
      fileContent = this.sanitizeModuleSyntax(fileContent);

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
   * HTMLテンプレート内のマーカーを統合JavaScriptに置換
   */
  replaceIncludeDirectives(htmlContent, unifiedJs) {
    // 統合JavaScript挿入ポイントを置換
    return htmlContent.replace(
      /<!--\s*__UNIFIED_JAVASCRIPT_INJECTION_POINT__\s*-->/,
      `<!-- 統合JavaScript (ビルド時自動生成) -->\n    <script>\n${unifiedJs}\n    </script>`,
    );
  }

  /**
   * JavaScriptヘッダーを生成
   */
  generateJavaScriptHeader() {
    return `  /**
   * =================================================================
   * 統合フロントエンドJavaScript (ビルド時自動生成)
   * Generated: ${new Date().toISOString()}
   * =================================================================
   */

`;
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
  };
`;
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
    if (fs.existsSync(this.sharedDir)) watchPaths.push(this.sharedDir);

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
