#!/usr/bin/env node

/**
 * ファイル監視による自動統合スクリプト
 * 11-14番のファイルが変更されたら自動的に統合します。
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');
const watchFiles = [
  '10_WebApp.html',
  '11_WebApp_Config.html',
  '12_WebApp_Core.html',
  '13_WebApp_Views.html',
  '14_WebApp_Handlers.html',
];

console.log('🔍 ファイル監視による自動統合を開始します...');
console.log('📁 監視対象:', watchFiles.join(', '));
console.log('🔄 ファイルが変更されると自動的に統合されます');
console.log('⏹️  終了するには Ctrl+C を押してください\n');

// 初回統合
console.log('🚀 初回統合を実行...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ 初回統合完了\n');
} catch (error) {
  console.error('❌ 初回統合に失敗:', error.message);
}

// ファイル監視開始
let debounceTimer = null;
const debounceDelay = 1000; // 1秒のデバウンス

watchFiles.forEach(filename => {
  const filePath = path.join(srcDir, filename);

  if (fs.existsSync(filePath)) {
    console.log(`👀 ${filename} の監視開始`);

    fs.watchFile(filePath, { interval: 500 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log(
          `\n📝 ${filename} が変更されました (${new Date().toLocaleTimeString()})`,
        );

        // デバウンス処理（複数ファイルの同時変更に対応）
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          console.log('🔄 自動統合を実行中...');
          try {
            execSync('npm run build', { stdio: 'inherit' });
            console.log('✅ 自動統合完了\n');
          } catch (error) {
            console.error('❌ 自動統合に失敗:', error.message);
          }
        }, debounceDelay);
      }
    });
  } else {
    console.warn(`⚠️  ${filename} が見つかりません`);
  }
});

// Ctrl+C でのグレースフル終了
process.on('SIGINT', () => {
  console.log('\n\n🛑 ファイル監視を終了します...');
  watchFiles.forEach(filename => {
    const filePath = path.join(srcDir, filename);
    fs.unwatchFile(filePath);
  });
  console.log('👋 また次回！');
  process.exit(0);
});
