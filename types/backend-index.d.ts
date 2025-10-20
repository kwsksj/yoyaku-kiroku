/**
 * @file バックエンドコード用の型定義エントリーポイント
 * @description
 * このファイルは、バックエンドのコンパイルに必要なすべての型定義を ES Modules 形式で再エクスポートします。
 * `tsconfig.check.backend.json` の `include` パスにこのファイルを含めることで、
 * 関連するすべての型がグローバルに解決されます。
 *
 * @see tsconfig.check.backend.json
 */

export * from './generated-backend-globals';
export * from './core';
export * from './view';
export * from './gas-custom';
export * from './generated-shared-globals';

export {};
