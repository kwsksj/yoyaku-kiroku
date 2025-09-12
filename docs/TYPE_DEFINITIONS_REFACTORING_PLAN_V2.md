# 型定義リファクタリング計画 V2

## 1. 背景

当初の「型定義ファイル構成改善計画」に基づき、`types/index.d.ts`を統合エントリポイントとするPhase 1のリファクタリングが実施された。これにより、分散していた型定義がある程度集約され、開発体験は一定向上した。

しかし、現状のソースコードを詳細に分析した結果、いくつかの新たな課題が明らかになった。本ドキュメントは、現状を正確に反映し、次なる改善ステップを定義するための改訂版である。

---

## 2. 現状分析 (V2)

### 2.1. 達成されたこと

- ✅ **統合エントリポイントの確立**: `src/jsconfig.json`が`types/index.d.ts`を読み込むようになり、型定義の基点が確立された。
- ✅ **ディレクトリ構造の標準化**: `dev/`から`src/`への移行が完了し、一般的なWebプロジェクトの構成に近づいた。
- ✅ **基本的な型の集約**: `types/index.d.ts`内で`/// <reference path="..." />`を使用し、各型定義ファイルが参照されるようになった。

### 2.2. 新たな課題

#### a. `Window`インターフェース定義の重複と競合

最も深刻な問題として、`Window`オブジェクトの拡張定義が依然として複数のファイルに分散しており、**統合が完了していない**。

- `types/index.d.ts` (約25行の`declare global`)
- `html-globals.d.ts` (約28行の`declare interface Window`)
- `types/constants.d.ts` (約10行の`declare interface Window`)
- `src/types.d.ts` (約20行の`interface Window`)

これにより、どの定義が優先されるか予測困難であり、プロパティの追加・修正時に複数ファイルを編集する必要が生じ、バグの温床となっている。

#### b. `types/index.d.ts`の責務過多

`types/index.d.ts`が単なる「エントリポイント」に留まらず、多くの具体的な型定義を抱え込んでいる。

- **GASグローバル変数**: `SS_MANAGER`, `CONSTANTS`など
- **汎用ユーティリティ型**: `Optional<T>`, `ApiResponseGeneric<T>`など
- **型ガード関数**: `isReservationInfo`, `isApiResponse`など
- **`Window`インターフェースの拡張**

結果としてファイルが肥大化し、可読性とメンテナンス性が低下している。

---

## 3. 改善計画 (Phase 2)

Phase 2の目標は、**「責務の分離」**と**「単一責任の原則の徹底」**である。

### 3.1. Step 1: `Window`定義の完全統合

`Window`に関する全ての型定義を、責務を明確にした単一のファイルに集約する。

1. **`types/window.d.ts`を新規作成する。**
2. `types/index.d.ts`, `html-globals.d.ts`, `types/constants.d.ts`, `src/types.d.ts`から、`Window`に関連する全ての定義を`types/window.d.ts`に移動・統合する。

   ```typescript
   // types/window.d.ts
   declare global {
     interface Window {
       // CONSTANTS, C, STATUS, UI など全て
       // stateManager, server, tailwind など全て
       // google.script.run など全て
     }
   }
   export {}; // モジュールとして認識させる
   ```

3. 元の4ファイルからは、`Window`の定義を**完全に削除**する。
4. `types/index.d.ts`の先頭で`/// <reference path="./window.d.ts" />`を追記して参照する。

### 3.2. Step 2: `types`ディレクトリの構造的リファクタリング

`types/index.d.ts`から具体的な実装を分離し、役割別のファイルに分割する。

| ファイル名       | 役割                                                                                                                        |
| :--------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `index.d.ts`     | **【エントリポイント】** 他の型定義ファイルの参照(`/// <reference>`)と、主要な型の再エクスポート(`export type`)のみを行う。 |
| `api.d.ts`       | **【API関連】** `ReservationInfo`, `UserInfo`, `ApiResponse`など、クライアント・サーバー間の通信で使われるデータ構造。      |
| `app.d.ts`       | **【アプリ状態】** `AppState`, `StateManager`など、フロントエンドの状態管理に関する型。                                     |
| `gas.d.ts`       | **【GAS環境】** `SS_MANAGER`, `SpreadsheetManager`クラスなど、サーバーサイド（GAS）固有のグローバル変数とクラス。           |
| `window.d.ts`    | **【Window拡張】** Step 1で作成。フロントエンドのグローバル名前空間(`window`)の型定義。                                     |
| `utility.d.ts`   | **【汎用ユーティリティ】** `Optional<T>`, `Required<T>`, `ApiResponseGeneric<T>`など、プロジェクト全体で再利用可能な型。    |
| `constants.d.ts` | **【定数オブジェクト】** `CONSTANTS`オブジェクトの構造定義。（既存のものを維持・整理）                                      |

### 3.3. 修正後の`types/index.d.ts`のイメージ

```typescript
/**
 * =================================================================
 * 【ファイル名】: types/index.d.ts
 * 【役割】: プロジェクト全体の統合型定義エントリポイント
 * 【責務】: 型定義の参照と主要な型の再エクスポートに限定する
 * =================================================================
 */

/// <reference types="google-apps-script" />

// --- 内部型定義ファイルの参照 ---
/// <reference path="./api.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./constants.d.ts" />
/// <reference path="./gas.d.ts" />
/// <reference path="./utility.d.ts" />
/// <reference path="./window.d.ts" />

// --- 外部のグローバル定義の参照 ---
/// <reference path="../gas-globals.d.ts" />
/// <reference path="../html-globals.d.ts" />
// 注意: html-globals.d.ts から Window 拡張が削除されていることを確認

// --- 主要な型の再エクスポート ---
export type * from './api';
export type * from './app';
export type * from './constants';
export type * from './utility';

export {};
```

---

## 4. 期待される効果

- **信頼性の向上**: `Window`の定義が単一ファイルに集約されることで、予測可能で信頼性の高い型システムが構築される。
- **メンテナンス性の向上**: 型の追加や修正時に、どのファイルを編集すべきかが明確になる。
- **可読性の向上**: 各ファイルが特定の責務に集中するため、コードの見通しが良くなる。
- **AI支援の精度向上**: 構造化され、責務が分離された型定義は、AIがコードを理解し、より的確なサポートを提供する上で極めて効果的である。

---

_ドキュメントバージョン: 2.0_ _最終更新日: 2025-09-12_
