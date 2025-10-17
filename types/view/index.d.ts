/**
 * @file ビュー関連の型定義集約ファイル
 * @description
 * このディレクトリ内のすべての型定義を ES Modules 形式で再エクスポートします。
 * これにより、他のファイルからこの `index.d.ts` を参照するだけで、
 * `view` ディレクトリ配下のすべての型が利用可能になります。
 *
 * @see ../backend-index.d.ts
 * @see ../frontend-index.d.ts
 */

export * from './state';
export * from './window';
export * from './components';
export * from './dom';
export * from './handlers';
export * from './design-system';

export {};
