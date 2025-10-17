/**
 * @file コアデータ構造の型定義集約ファイル
 * @description
 * このディレクトリ内のすべての型定義を ES Modules 形式で再エクスポートします。
 * これにより、他のファイルからこの `index.d.ts` を参照するだけで、
 * `core` ディレクトリ配下のすべての型が利用可能になります。
 *
 * @see ../backend-index.d.ts
 * @see ../frontend-index.d.ts
 */

export * from './common';
export * from './lesson';
export * from './reservation';
export * from './user';
export * from './accounting';

export {};
