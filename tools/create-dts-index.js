import fs from 'fs';
import path from 'path';

const targetDirs = [
  './types/generated-backend-globals',
  './types/generated-frontend-globals',
];

/**
 * 指定されたディレクトリ内のすべての .d.ts ファイルを再帰的に検索します。
 * @param {string} dir - 検索を開始するディレクトリ。
 * @returns {string[]} .d.ts ファイルの相対パスの配列。
 */
function findDtsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findDtsFiles(filePath));
    } else if (filePath.endsWith('.d.ts') && !filePath.endsWith('index.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

targetDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    // ディレクトリが存在しない場合は作成する
    fs.mkdirSync(dir, { recursive: true });
    return;
  }

  const dtsFiles = findDtsFiles(dir);
  if (dtsFiles.length === 0) {
    console.log(`- No .d.ts files found in: ${dir}`);
    return;
  }

  const indexContent = dtsFiles
    .map(file => {
      const relativePath = path.relative(dir, file).replace(/\\/g, '/');
      return `/// <reference path="./${relativePath}" />`;
    })
    .join('\n');

  fs.writeFileSync(path.join(dir, 'index.d.ts'), indexContent, 'utf8');
  console.log(`✅ Created index.d.ts for '${dir}' with ${dtsFiles.length} references.`);
});

console.log('\n✨ Index file generation complete.');
