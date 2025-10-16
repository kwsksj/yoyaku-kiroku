#!/usr/bin/env node

/**
 * =================================================================
 * 【ファイル名】: tools/create-global-bridge.js
 * 【役割】: 自動生成された型定義をグローバルスコープで利用可能にするブリッジファイルを生成
 * 【目的】: export const や export namespace を `declare global` でラップする
 * =================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定
const TARGET_DIRS = [
  path.join(__dirname, '../types/generated-backend-globals'),
  path.join(__dirname, '../types/generated-frontend-globals'),
  path.join(__dirname, '../types/generated-shared-globals'),
];

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

/**
 * BOMを除去したテキストを取得
 * @param {string} filePath
 * @returns {string}
 */
function readFileWithoutBom(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  return content;
}

/**
 * ノードがexport修飾子を持つか判定
 * @param {ts.Node} node
 * @returns {boolean}
 */
function hasExportModifier(node) {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return Boolean(
    modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
}

/**
 * 名前空間をオブジェクト型リテラルへ変換
 * @param {ts.ModuleDeclaration} moduleDecl
 * @param {ts.SourceFile} sourceFile
 * @param {number} indentLevel
 * @returns {string}
 */
function buildNamespaceType(moduleDecl, sourceFile, indentLevel = 1) {
  if (!moduleDecl.body) {
    return '{}';
  }

  if (ts.isModuleDeclaration(moduleDecl.body)) {
    return buildNamespaceType(moduleDecl.body, sourceFile, indentLevel);
  }

  if (!ts.isModuleBlock(moduleDecl.body)) {
    return '{}';
  }

  const definitions = new Map();
  const pendingAliases = [];
  let order = 0;

  const addDefinition = (name, type) => {
    definitions.set(name, {
      originalName: name,
      type,
      order: order++,
      skipOriginal: false,
      aliases: [],
    });
  };

  const tryAttachAlias = (sourceName, aliasName, aliasOrder) => {
    const def = definitions.get(sourceName);
    if (!def) {
      pendingAliases.push({ sourceName, aliasName, order: aliasOrder });
      return;
    }
    if (sourceName !== aliasName) {
      def.skipOriginal = true;
    }
    def.aliases.push({ name: aliasName, order: aliasOrder });
  };

  for (const statement of moduleDecl.body.statements) {
    if (ts.isModuleDeclaration(statement)) {
      const nestedType = buildNamespaceType(
        statement,
        sourceFile,
        indentLevel + 1,
      );
      addDefinition(statement.name.getText(sourceFile), nestedType);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }

        const typeText = declaration.type
          ? printer
              .printNode(
                ts.EmitHint.Unspecified,
                declaration.type,
                sourceFile,
              )
              .trim()
          : 'any';

        addDefinition(declaration.name.getText(sourceFile), typeText);
      }
      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const aliasName = element.name.getText(sourceFile);
        const sourceName = element.propertyName
          ? element.propertyName.getText(sourceFile)
          : aliasName;
        tryAttachAlias(sourceName, aliasName, order++);
      }
    }
  }

  // 未解決のエイリアスを処理
  for (const alias of pendingAliases) {
    const def = definitions.get(alias.sourceName);
    if (!def) {
      continue;
    }
    if (alias.sourceName !== alias.aliasName) {
      def.skipOriginal = true;
    }
    def.aliases.push({ name: alias.aliasName, order: alias.order });
  }

  const collected = [];
  for (const def of definitions.values()) {
    if (!def.skipOriginal) {
      collected.push({
        name: def.originalName,
        type: def.type,
        order: def.order,
      });
    }
    for (const alias of def.aliases) {
      if (!def.skipOriginal && alias.name === def.originalName) {
        continue;
      }
      collected.push({
        name: alias.name,
        type: def.type,
        order: alias.order,
      });
    }
  }

  collected.sort((a, b) => a.order - b.order);

  const indent = '  '.repeat(indentLevel);
  const propertyIndent = '  '.repeat(indentLevel + 1);

  if (collected.length === 0) {
    return `{\n${indent}}`;
  }

  const lines = collected.map(entry => {
    const typeText = entry.type;
    return `${propertyIndent}readonly ${entry.name}: ${typeText};`;
  });

  return `{\n${lines.join('\n')}\n${indent}}`;
}

/**
 * .d.tsファイルからexport宣言を抽出
 * @param {string} filePath - 型定義ファイルのパス
 * @returns {Array<{name: string, kind: 'namespace' | 'other', type?: string}>}
 */
function extractExports(filePath) {
  const content = readFileWithoutBom(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  /** @type {Array<{name: string, kind: 'namespace' | 'other', type?: string}>} */
  const exports = [];

  sourceFile.forEachChild(node => {
    if (ts.isModuleDeclaration(node) && hasExportModifier(node)) {
      const name = node.name.getText(sourceFile);
      const type = buildNamespaceType(node, sourceFile, 1);
      exports.push({ name, kind: 'namespace', type });
      return;
    }

    if (
      (ts.isClassDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isVariableStatement(node)) &&
      hasExportModifier(node)
    ) {
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            exports.push({
              name: declaration.name.getText(sourceFile),
              kind: 'other',
            });
          }
        }
      } else if ('name' in node && node.name) {
        exports.push({ name: node.name.getText(sourceFile), kind: 'other' });
      }
    }
  });

  return exports;
}

/**
 * ブリッジ型定義ファイルを生成
 */
function generateBridgeFiles() {
  console.log(
    '🔍 Scanning generated type definitions to create global bridges...',
  );

  for (const dir of TARGET_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`- Skipping non-existent directory: ${path.basename(dir)}`);
      continue;
    }

    const files = fs
      .readdirSync(dir)
      .filter(
        f => f.endsWith('.d.ts') && f !== 'index.d.ts' && f !== '_globals.d.ts',
      );

    if (files.length === 0) {
      console.log(`- No .d.ts files to process in: ${path.basename(dir)}`);
      continue;
    }

    const allExports = [];
    for (const file of files) {
      const filePath = path.join(dir, file);
      const exports = extractExports(filePath);
      if (exports.length > 0) {
        allExports.push(...exports);
      }
    }

    if (allExports.length === 0) {
      console.log(`- No exports found in: ${path.basename(dir)}`);
      continue;
    }

    const globalDeclarations = allExports
      .map(exp => {
        if (exp.kind === 'namespace' && exp.type) {
          return `  const ${exp.name}: ${exp.type};`;
        }
        return `  const ${exp.name}: typeof import('.').${exp.name};`;
      })
      .join('\n');

    const content = `/**
 * @file This file is auto-generated by tools/create-global-bridge.js.
 * Do not edit this file manually.
 */

declare global {
${globalDeclarations}
}

export {};
`;

    const outputFile = path.join(dir, '_globals.d.ts');
    fs.writeFileSync(outputFile, content, 'utf8');
    console.log(
      `✅ Created _globals.d.ts for '${path.basename(dir)}' with ${allExports.length} declarations.`,
    );
  }

  console.log('\n✨ Global bridge file generation complete.');
}

// メイン処理
try {
  generateBridgeFiles();
} catch (error) {
  console.error('❌ Error generating bridge files:', error.message);
  process.exit(1);
}
