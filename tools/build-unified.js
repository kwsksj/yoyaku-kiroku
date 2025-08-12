#!/usr/bin/env node

/**
 * HTMLファイル統合スクリプト
 * 11-14番のファイルを統合してテスト環境用HTMLを生成します。
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const testDir = path.join(__dirname, '../test');
const templateFile = path.join(srcDir, '10_WebApp.html');
const outputFile = path.join(testDir, '10_WebApp_Unified_Test.html');

// 統合対象ファイル
const sourceFiles = [
  '10_WebApp_Mock.html', // テスト環境用モック機能
  '11_WebApp_Config.html',
  '12_WebApp_Core.html',
  '13_WebApp_Views.html',
  '14_WebApp_Handlers.html',
];

console.log('🔧 HTMLファイル統合を開始します...');

// テンプレートファイルを読み込み
let templateContent;
try {
  templateContent = fs.readFileSync(templateFile, 'utf-8');
  console.log('✅ テンプレートファイルを読み込みました:', templateFile);
} catch (error) {
  console.error('❌ テンプレートファイルの読み込みに失敗:', error.message);
  process.exit(1);
}

// ソースファイルの内容を統合
let integratedScripts = '';

for (const sourceFile of sourceFiles) {
  // 10_WebApp_Mock.html だけ test ディレクトリから、それ以外は src から
  const filePath =
    sourceFile === '10_WebApp_Mock.html'
      ? path.join(__dirname, '../test', sourceFile)
      : path.join(srcDir, sourceFile);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // <script>タグの中身を抽出
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      let scriptContent = scriptMatch[1];

      // 重要な変数を明示的にwindowオブジェクトに設定するように修正
      if (sourceFile === '12_WebApp_Core.html') {
        scriptContent = scriptContent.replace(/const appState = {/, 'window.appState = {');
        console.log(`🔧 ${sourceFile} - appStateをwindow.appStateに変更`);
      }

      if (sourceFile === '14_WebApp_Handlers.html') {
        scriptContent = scriptContent.replace(
          /const actionHandlers = {/,
          'window.actionHandlers = {',
        );
        console.log(`🔧 ${sourceFile} - actionHandlersをwindow.actionHandlersに変更`);
      }

      integratedScripts += `\n    // ========== ${sourceFile} ==========\n`;
      integratedScripts += scriptContent;
      integratedScripts += `\n    // ========== /${sourceFile} ==========\n`;

      console.log(`✅ ${sourceFile} を統合しました (${scriptContent.length} 文字)`);
    } else {
      console.warn(`⚠️  ${sourceFile} に<script>タグが見つかりません`);
    }
  } catch (error) {
    console.error(`❌ ${sourceFile} の読み込みに失敗:`, error.message);
    process.exit(1);
  }
}

// テンプレートの動的読み込み部分を統合コードで置換
// GASスクリプトレット（<?= ... ?>）を統合されたコードで置換
let unifiedContent = templateContent;

// frontend-test.js の内容を取得
const frontendTestPath = path.join(__dirname, 'frontend-test.js');
let frontendTestContent = '';
try {
  frontendTestContent = fs.readFileSync(frontendTestPath, 'utf-8');
  console.log('✅ frontend-test.js を読み込みました:', frontendTestPath);
} catch (error) {
  console.error('❌ frontend-test.js の読み込みに失敗:', error.message);
  // テストスクリプトがなくても続行
}

// その他の動的読み込み部分も置換
unifiedContent = unifiedContent.replace(
  /<!-- GAS環境用のJavaScriptファイル読み込み（テンプレート評価対応） -->[\s\S]*?<\/script>/,
  `<!-- 統合されたソースコード -->
    <script>
      console.log('[統合版] 統合されたソースコードを実行開始');

      ${integratedScripts}

      // 統合版初期化
      console.log('[統合版] 全ファイル統合完了、アプリケーション初期化開始');

      // テスト環境用の初期化（hideLoading/setStateを明示的に呼ぶ）
      setTimeout(() => {
        if (typeof setState === 'function') {
          setState({ view: 'login' });
        }
        if (typeof hideLoading === 'function') {
          hideLoading();
        }
        if (typeof window.onload === 'function') {
          window.onload();
        } else if (typeof render === 'function') {
          render();
        }
      }, 100);

      // ======= frontend-test.js (自動テスト) =======
      try {
        (function(){
        ${frontendTestContent.replace(/<script>|<\/script>/g, '').replace(/^[ \t]*\/\/.*$/gm, '')}
        })();
      } catch(e) {
        console.error('自動テストスクリプトの実行エラー:', e);
      }
      // ======= /frontend-test.js =======
    </script>`,
);

// 統合ファイルを出力
try {
  fs.writeFileSync(outputFile, unifiedContent, 'utf-8');
  console.log('🎉 統合ファイルを生成しました:', outputFile);
  console.log('📁 ファイルサイズ:', Math.round(unifiedContent.length / 1024), 'KB');
} catch (error) {
  console.error('❌ 統合ファイルの書き込みに失敗:', error.message);
  process.exit(1);
}

console.log(
  '\n✨ 統合完了！Live Serverで',
  path.basename(outputFile),
  'を開いてテストしてください。',
);
