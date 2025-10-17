/**
 * @file フロントエンドコード用の型定義エントリーポイント
 * @description
 * このファイルは、フロントエンドのコンパイルに必要なすべての型定義を ES Modules 形式で再エクスポートします。
 * `tsconfig.check.frontend.json` の `include` パスにこのファイルを含めることで、
 * 関連するすべての型がグローバルに解決されます。
 *
 * @see tsconfig.check.frontend.json
 */

export * from './generated-frontend-globals';
export * from './core';
export * from './view';
export * from './gas-custom';
export * from './generated-shared-globals';

export {};
