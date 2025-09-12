# 型定義ファイル構成改善計画

## 現状分析

### 現在の型定義ファイル構成

```
project-root/
├── gas-globals.d.ts           # GAS環境グローバル型定義
├── html-globals.d.ts          # フロントエンド DOM拡張型定義
├── types/
│   ├── constants.d.ts         # CONSTANTS オブジェクト型定義
│   └── api-types.js          # JSDoc型定義 + ランタイム型検証
└── dev/
    ├── jsconfig.json         # 型定義include設定
    └── types.d.ts           # 開発環境専用型定義（最も包括的）
```

### 問題点の詳細

#### 1. ファイル分散と役割の重複

- **型定義が5つのファイルに分散**：保守性の低下
- **Window インターフェース拡張が複数箇所で重複**：
  - `html-globals.d.ts:18-47`
  - `types/constants.d.ts:14-23`
  - `dev/types.d.ts:157-189`
- **事実上のメインファイルが不明確**：`dev/types.d.ts`が最も包括的だが、他ファイルとの関係が曖昧

#### 2. 技術的な不整合

- **JSDoc（.js）とTypeScript（.d.ts）の混在**：`api-types.js`のみJSDoc形式
- **相対パス依存**：`dev/jsconfig.json`で`../`による相対パス指定
- **命名規則の不統一**：`gas-globals.d.ts` vs `constants.d.ts` vs `api-types.js`

#### 3. 開発体験の課題

- **型追加時の複数ファイル更新**：新しい型を追加する際、どのファイルに書くべきか判断が困難
- **IDE支援の不完全性**：分散した型定義によるIntelliSense性能の低下
- **デバッグの困難さ**：型エラーの原因特定が複雑

## 改善方針

### 設計原則

1. **単一責任原則**：各ファイルが明確な役割を持つ
2. **依存関係の最小化**：相互依存を減らし、単方向の依存関係を構築
3. **開発体験の最適化**：IDE支援の向上と型エラーの分かりやすさ
4. **保守性の向上**：型定義の追加・修正が容易

### アーキテクチャ方針

#### Option A: 統合型定義構造（推奨）

```
types/
├── index.d.ts              # 🎯 メインエントリポイント（全型定義の統合）
├── api/                    # API関連型定義
│   ├── reservations.d.ts   # 予約関連型
│   ├── users.d.ts         # ユーザー関連型
│   └── common.d.ts        # 共通API型
├── constants.d.ts          # 定数型定義（既存維持）
├── gas/                    # GAS環境固有型
│   ├── globals.d.ts       # グローバル変数・関数
│   └── spreadsheet.d.ts   # SpreadsheetManager等
└── frontend/               # フロントエンド固有型
    ├── dom.d.ts           # DOM拡張
    └── state.d.ts         # StateManager等
```

#### Option B: 環境別分離構造

```
types/
├── shared/                 # 共通型定義
│   ├── api.d.ts
│   └── constants.d.ts
├── environments/           # 環境別型定義
│   ├── gas.d.ts
│   └── frontend.d.ts
└── dev/                   # 開発環境統合
    └── index.d.ts
```

## 実装計画

### Phase 1: 基盤整備（優先度：高）

#### 1.1 統合エントリポイント作成

- [ ] `types/index.d.ts` 作成
- [ ] 既存の全型定義を統合・整理
- [ ] 重複定義の排除

#### 1.2 設定ファイル更新

- [ ] `dev/jsconfig.json` のinclude設定簡素化
- [ ] `types/index.d.ts` 単一エントリポイント化

#### 1.3 検証・テスト

- [ ] VSCode IntelliSense動作確認
- [ ] TypeScript型チェック確認
- [ ] 既存コードへの影響確認

### Phase 2: 構造最適化（優先度：中）

#### 2.1 責任分離

- [ ] API型定義の分離（`types/api/`）
- [ ] GAS固有型の分離（`types/gas/`）
- [ ] フロントエンド固有型の分離（`types/frontend/`）

#### 2.2 技術統一

- [ ] `api-types.js` のTypeScript化検討
- [ ] ランタイム型検証の統合方針決定
- [ ] 命名規則の統一

### Phase 3: 開発体験向上（優先度：低）

#### 3.1 ツール統合

- [ ] ESLint TypeScript設定最適化
- [ ] ビルドプロセスとの型定義統合
- [ ] CI/CDでの型チェック自動化

#### 3.2 ドキュメント整備

- [ ] 型定義構造の文書化
- [ ] 開発ガイドライン更新
- [ ] 型定義追加手順の標準化

## 実装詳細

### 新しい `types/index.d.ts` の構造案

```typescript
// =================================================================
// 型定義メインエントリポイント
// =================================================================

/// <reference types="google-apps-script" />

// 共通型定義のインポート
/// <reference path="./constants.d.ts" />
/// <reference path="./gas/globals.d.ts" />
/// <reference path="./frontend/dom.d.ts" />
/// <reference path="./api/common.d.ts" />

// 型定義の re-export
export * from './api/common';
export * from './api/reservations';
export * from './api/users';

// グローバル型定義（統合）
declare global {
  // Window interface統合
  interface Window {
    // constants.d.tsからの継承
    CONSTANTS: Constants;
    C: Constants;
    STATUS: StatusConstants;
    // ... 他の統合定義
  }
}
```

### 移行戦略

#### 段階的移行アプローチ

1. **既存ファイルを維持しながら新構造作成**
2. **新構造での動作確認完了後、旧ファイル削除**
3. **段階的な型定義移行で影響範囲を最小化**

#### リスク軽減策

- **バックアップ作成**：既存型定義ファイルのバックアップ
- **テスト自動化**：型チェック自動化によるリグレッション防止
- **段階的ロールアウト**：開発環境 → テスト環境 → 本番環境

## 期待効果

### 開発効率向上

- **型定義の一元管理**：新しい型の追加が容易
- **IDE支援の向上**：IntelliSense性能向上、型エラー特定の高速化
- **学習コスト削減**：新規開発者の型定義理解が容易

### 保守性向上

- **依存関係の明確化**：型定義間の関係が明確
- **変更影響範囲の限定化**：特定の型変更が他に与える影響を予測しやすい
- **テスト容易性**：型定義のテストが体系的に実施可能

### コード品質向上

- **型安全性の向上**：より厳密な型チェック
- **バグ予防効果**：コンパイル時エラー検出の強化
- **リファクタリング安全性**：大規模リファクタリング時の型整合性保証

## 次のアクション

1. **この計画書のレビュー・承認**
2. **Phase 1の実装開始**
3. **実装結果の評価・フィードバック**

---

*作成日: 2025-09-12*
*対象バージョン: JavaScript分離開発アーキテクチャ v2*
