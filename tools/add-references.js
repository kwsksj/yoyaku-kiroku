import fs from 'fs';
import path from 'path';

const targetDir = 'src/frontend';
const referenceTag = '/// <reference path="../../types/index.d.ts" />\n';

/**
 * 指定されたディレクトリ内のすべての.jsファイルを取得します。
 * @param {string} dir - 検索するディレクトリ
 * @returns {string[]} ファイルパスの配列
 */
function getJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getJsFiles(filePath));
    } else if (path.extname(filePath) === '.js') {
      results.push(filePath);
    }
  });
  return results;
}

const files = getJsFiles(targetDir);
let updatedCount = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    // 既に参照タグが存在しない場合のみ追加
    if (!content.startsWith(referenceTag)) {
      content = referenceTag + content;
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✅ Added reference to: ${file}`);
      updatedCount++;
    }
  } catch (error) {
    console.error(`❌ Failed to process file: ${file}`, error);
  }
});

console.log(`\n✨ Process complete. Updated ${updatedCount} files.`);
