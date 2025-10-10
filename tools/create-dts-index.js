import fs from 'fs';
import path from 'path';

const targetDirs = [
  './types/generated-backend-globals',
  './types/generated-frontend-globals',
  './types/generated-shared-globals',
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
    } else if (filePath.endsWith('.d.ts') && !filePath.endsWith('index.d.ts') && !filePath.endsWith('_globals.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

targetDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const dtsFiles = findDtsFiles(dir);
  const references = dtsFiles.map(file => {
    const relativePath = path.relative(dir, file).replace(/\\/g, '/');
    return `/// <reference path="./${relativePath}" />`;
  });

  // _globals.d.ts が存在すれば、それも参照に追加する
  const globalsPath = path.join(dir, '_globals.d.ts');
  if (fs.existsSync(globalsPath)) {
    references.unshift('/// <reference path="./_globals.d.ts" />');
  }

  if (references.length === 0) {
    console.log(`- No .d.ts files found to create an index for: ${path.basename(dir)}`);
    // 空でもindex.d.tsは作成する（後続の処理でエラーにならないように）
    fs.writeFileSync(path.join(dir, 'index.d.ts'), '', 'utf8');
    return;
  }

  const indexContent = references.join('\n');
  fs.writeFileSync(path.join(dir, 'index.d.ts'), indexContent, 'utf8');
  console.log(`✅ Created index.d.ts for '${path.basename(dir)}' with ${references.length} references.`);
});

console.log('\n✨ Index file generation complete.');