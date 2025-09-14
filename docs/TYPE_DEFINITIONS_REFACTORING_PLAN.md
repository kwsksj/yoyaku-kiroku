# 型定義ファイル構成改善計画書

## 1. ドキュメント概要

- **目的**: プロジェクトの型定義に関する現状の問題点を分析し、改善計画を策定・記録する。
- **管理ステータス**: **Phase 1.5 実装完了**。当初計画を前倒しで達成し、より高度な型定義ハブを構築済み。
- **最終更新日**: 2025-09-14
- **対象バージョン**: JavaScript分離開発アーキテクチャ v3

---

## 2. 現状分析と課題

### 2.1. 改善前の問題点

- **ファイルの分散**: 型定義が5つ以上のファイルに散らばり、保守性が著しく低下していた。
- **定義の重複**: `Window` インターフェースの拡張が複数ファイルで重複し、不整合の原因となっていた。
- **技術の不整合**: JSDoc (`.js`) と TypeScript Definition (`.d.ts`) が混在し、型チェックの一貫性がなかった。
- **開発体験の悪化**: IDEの型補完が不完全で、型エラーの特定が困難だった。

### 2.2. ✅ 改善後の現状アーキテクチャ

```
project-root/
├── types/
│   ├── index.d.ts            # 🎯【最重要】プロジェクトの型定義ハブ
│   ├── constants.d.ts         # `CONSTANTS` グローバルオブジェクトの型定義
│   └── api-types.js          # (要改善) JSDocによるAPI型定義 + ランタイムコード
├── src/
│   ├── jsconfig.json         # `types/index.d.ts` を読み込むように設定済み
│   └── types.d.ts           # 開発環境・フロントエンド固有の型定義
├── gas-globals.d.ts           # GAS環境のグローバル型
└── html-globals.d.ts          # HTMLテンプレート内のグローバル型
```

---

## 3. 達成済みの改善 (Phase 1.5)

当初の計画（Phase 1）では、分散した型定義を統合するエントリポイントの作成を目指していた。しかし、実際にはそれを大幅に超え、プロジェクト全体の型安全性を支える**「型定義ハブ」**として `types/index.d.ts` を構築した。

### 3.1. 実装詳細: `types/index.d.ts` の多角的な役割

このファイルは単なる参照の集合ではなく、以下の高度な機能を提供する。

1. **複数ファイルの参照統合**: `/// <reference path="..." />` を用いて、プロジェクト内のすべての型定義ファイルを一元的に集約。
2. **グローバル型の集中管理**:
   - `Window` インターフェースを拡張し、フロントエンドのグローバル変数 (`CONSTANTS`, `stateManager` 等) を一箇所で定義。
   - `declare var` を使用し、GAS環境のグローバル変数 (`SS_MANAGER` 等) を定義。
3. **型の再エクスポート**: 各ファイルで定義された型 (`ReservationInfo`, `AppState` 等) を `export type` で再エクスポートし、モジュールとしての利用を可能に。
4. **共通ユーティリティ型の提供**:
   - `Optional<T, K>`, `Required<T, K>` といった、コード全体で利用可能なジェネリックユーティリティ型を提供。
   - `ApiResponseGeneric<T>` のような、汎用的なAPIレスポンス型を定義。
5. **ランタイム安全性の向上**: `isReservationInfo` のような型ガード関数をエクスポートし、実行時の型チェックをサポート。
6. **開発支援**: `DebugInfo`, `EnvironmentConfig` といった、開発プロセスを支援するための型を定義。

#### `types/index.d.ts` の実際のコード構造

```typescript
/**
 * =================================================================
 * 【ファイル名】: types/index.d.ts
 * 【役割】: プロジェクト全体の統合型定義ハブ
 * =================================================================
 */

/// <reference types="google-apps-script" />
/// <reference path="./constants.d.ts" />
/// <reference path="./api-types.js" />
/// <reference path="../gas-globals.d.ts" />
/// <reference path="../html-globals.d.ts" />
/// <reference path="../src/types.d.ts" />

// 1. グローバル型の集中管理
declare global {
  interface Window {
    CONSTANTS: Constants;
    stateManager?: StateManager;
    google: any;
    // ... 他のフロントエンドグローバル変数
  }
}
declare var SS_MANAGER: SpreadsheetManager;
// ... 他のGASグローバル変数

// 2. 型の再エクスポート
export type { ReservationInfo, Lesson } from './api-types.js';
export type { AppState, StateManager } from '../src/types.d.ts';
export type { Constants } from './constants.d.ts';

// 3. 共通ユーティリティ型の提供
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export interface ApiResponseGeneric<T = any> {
  /* ... */
}

// 4. ランタイム安全性の向上 (型ガード)
export function isReservationInfo(obj: any): obj is ReservationInfo;
export function isLesson(obj: any): obj is Lesson;

// 5. 開発支援用型定義
export interface DebugInfo {
  /* ... */
}
export interface EnvironmentConfig {
  /* ... */
}

export {};
```

### 3.2. 達成された効果

- **開発効率の飛躍的向上**: IDEによる正確な型補完とエラー検出が実現。
- **保守性の劇的な改善**: 型の追加や修正が `types/index.d.ts` を中心に行えるようになり、影響範囲の特定が容易に。
- **コード品質の向上**: 型安全性が高まり、実行時エラーの多くを開発段階で撲滅。
- **アーキテクチャの近代化**: `src/` と `build-output/` の分離など、標準的なプロジェクト構造へ移行。

---

## 4. 次期改善計画 (Phase 2 & 3)

現在の最大の課題は、`api-types.js` に残るJSDocとランタイムコードの混在である。これを解消し、さらなる開発体験向上を目指す。

### 🎯 Phase 2: 技術的負債の解消

#### **Task 2.1: `api-types.js` の TypeScript 化 (最優先)**

- **目的**: プロジェクトからJSDocを撲滅し、型定義をTypeScriptに完全統一する。
- **具体的な手順**:
  1. **ファイル変換**: `types/api-types.js` を `types/api.ts` にリネームし、JSDocの `@typedef` を TypeScript の `interface` または `type` に書き換える。
  2. **ランタイムコード分離**: `PropertyAccessor` のようなユーティリティコードは、純粋な型定義ファイルから `src/utils/property-accessor.js` のような適切な場所に移動する。
  3. **参照更新**: `types/index.d.ts` 内の `/// <reference path="./api-types.js" />` と `export type from './api-types.js'` を、新しい `api.ts` ファイルへの参照に更新する。

#### **Task 2.2: 型定義の責任分離 (Task 2.1 完了後)**

- **目的**: `api.ts` が肥大化した場合に、関心事に応じてファイルを分割する。
- **計画**: `types/api.ts` を、以下のようにドメインごとに分割する。

  ```
  types/api/
  ├── reservation.ts  # ReservationInfo など
  ├── lesson.ts       # Lesson, LessonSchedule など
  └── user.ts         # UserInfo など
  ```

### 🚀 Phase 3: 開発体験と品質の継続的向上

#### **Task 3.1: CI/CDによる型チェックの自動化**

- **目的**: Pull Request や Push 時に型エラーを自動検出し、メインブランチの品質を維持する。
- **具体的な手順**:
  1. **npmスクリプト追加**: `package.json` に型チェックスクリプトを追加する。

     ```json
     "scripts": {
       "check-types": "tsc --noEmit"
     }
     ```

  2. **GitHub Actions設定**: `.github/workflows/type-check.yml` を作成する。

     ```yaml
     name: TypeScript Type Check
     on: [push, pull_request]
     jobs:
       build:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v3
           - uses: actions/setup-node@v3
             with:
               node-version: '18'
           - run: npm install
           - run: npm run check-types
     ```

#### **Task 3.2: 型定義ドキュメントの自動生成**

- **目的**: 型定義からドキュメントを自動生成し、メンテナンスコストを削減する。
- **具体的な手順**:
  1. **ツール導入**: `TypeDoc` を開発者依存としてインストールする。

     ```bash
     npm install --save-dev typedoc
     ```

  2. **npmスクリプト追加**: `package.json` にドキュメント生成スクリプトを追加する。

     ```json
     "scripts": {
       "build-docs": "typedoc --out docs/type-definitions types"
     }
     ```

  3. 生成されたドキュメントを `README.md` などからリンクし、開発者が常に最新の型情報を参照できるようにする。
