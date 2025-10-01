# ドキュメントガイド

このディレクトリには「きぼりの よやく・きろく」システム（v3.2.0）の技術ドキュメントが含まれています。

## 📚 コアドキュメント（必読）

現在のシステムを理解するために必須のドキュメント：

| ファイル名                                                           | 内容                               | 対象                 |
| -------------------------------------------------------------------- | ---------------------------------- | -------------------- |
| **[DATA_MODEL.md](DATA_MODEL.md)**                                   | データモデル設計仕様書（v3.2対応） | 全開発者             |
| **[DATA_ACCESS_PRINCIPLES.md](DATA_ACCESS_PRINCIPLES.md)**           | データアクセス原則（v3.2対応）     | 全開発者             |
| **[JS_TO_HTML_ARCHITECTURE.md](JS_TO_HTML_ARCHITECTURE.md)**         | JavaScript分離開発アーキテクチャ   | 全開発者             |
| **[FRONTEND_ARCHITECTURE_GUIDE.md](FRONTEND_ARCHITECTURE_GUIDE.md)** | フロントエンドアーキテクチャガイド | フロントエンド開発者 |

## 📖 リファレンスドキュメント

実装の詳細や開発ガイドライン：

| ファイル名                                                               | 内容                       | 備考             |
| ------------------------------------------------------------------------ | -------------------------- | ---------------- |
| **[CONSTANTS_GUIDE.md](CONSTANTS_GUIDE.md)**                             | 定数システムの使い方       | 定数管理の基本   |
| **[CONSTANTS_DOCUMENTATION_INDEX.md](CONSTANTS_DOCUMENTATION_INDEX.md)** | 定数ドキュメント索引       | 定数一覧         |
| **[BUSINESS_LOGIC_REFERENCE.md](BUSINESS_LOGIC_REFERENCE.md)**           | ビジネスロジックリファレンス | 主要処理フロー   |
| **[MIGRATION_TO_JS_DEV.md](MIGRATION_TO_JS_DEV.md)**                     | JavaScript分離開発移行手順 | 参考資料（移行済み） |

## 🔮 将来機能計画

未実装の機能計画書：

| ファイル名                                                       | 内容               | ステータス |
| ---------------------------------------------------------------- | ------------------ | ---------- |
| **[CALENDAR_SYNC_SPECIFICATION.md](CALENDAR_SYNC_SPECIFICATION.md)** | カレンダー同期機能 | 計画段階   |

## 📦 アーカイブ

過去の計画書や完了した分析レポートは `archive/completed-plans/` に保存されています（約46ファイル）。

### 主なアーカイブ内容

- **データモデル移行関連** - Phase 1-2の設計書・分析レポート
- **パフォーマンス改善関連** - Phase 3-4の最適化計画書
- **型安全性プロジェクト** - フロントエンド型安全性の各種計画書（11ファイル）
- **機能実装計画** - 会計機能、プロフィール編集、予約確認メール等の完了した計画書
- **バックエンド分析** - エラー分析、統合確認レポート
- **作業メモ・一時文書** - 開発中の仕様メモ・調査レポート

## 🗺️ システム理解の推奨順序

### 新規開発者向け

1. **プロジェクト概要**: `../README.md`（ルートディレクトリ）
2. **開発環境セットアップ**: `../CLAUDE.md`
3. **データモデル理解**: `DATA_MODEL.md` ⭐ 最重要
4. **データアクセス原則**: `DATA_ACCESS_PRINCIPLES.md` ⭐ 最重要
5. **開発ワークフロー**: `JS_TO_HTML_ARCHITECTURE.md`
6. **フロントエンド構造**: `FRONTEND_ARCHITECTURE_GUIDE.md`

### 機能追加・改修時

1. **データアクセス確認**: `DATA_ACCESS_PRINCIPLES.md` - キャッシュ戦略の理解
2. **ビジネスロジック確認**: `BUSINESS_LOGIC_REFERENCE.md` - 処理フローの把握
3. **定数システム**: `CONSTANTS_GUIDE.md` - 定数の追加・変更方法

## 📝 重要な技術的ポイント

### v3.2.0の主要機能

1. **インクリメンタルキャッシュ更新（v5.0）**
   - 予約データの差分更新により95%以上高速化
   - 詳細: `DATA_ACCESS_PRINCIPLES.md` - 原則2参照

2. **分割キャッシュシステム（v5.5）**
   - 90KB超過時の自動分割（最大1.8MB対応）
   - 詳細: `DATA_ACCESS_PRINCIPLES.md` - 分割キャッシュセクション参照

3. **JavaScript分離開発アーキテクチャ**
   - VSCodeでのTypeScript支援
   - 詳細: `JS_TO_HTML_ARCHITECTURE.md`

4. **統合予約システム**
   - 教室別分散から統合シートへの移行完了
   - 詳細: `DATA_MODEL.md` - Phase 1-2参照

## 🚨 開発時の注意事項

### 必須ルール

1. **開発場所**: `src/` ディレクトリで作業（`build-output/` は編集禁止）
2. **ビルド必須**: 変更後は必ず `npm run dev:build` を実行
3. **テスト**: `npm run dev:test` で動作確認
4. **データアクセス**: 必ず `getCachedData()` を使用（直接シート読み込み禁止）
5. **キャッシュ更新**: 書き込み時は `addReservationToCache()` 等を使用

### 推奨ワークフロー

```bash
# 1. src/で編集
vim src/backend/05-2_Backend_Write.js

# 2. ビルド
npm run dev:build

# 3. テスト環境で確認
npm run dev:test

# 4. 本番デプロイ（テストOK後）
npm run dev:prod
```

## 📊 ドキュメント管理ルール

### 新規ドキュメント作成時

- **現在有効な仕様・ガイド**: `docs/` 直下に配置
- **完了した計画・古い分析**: `docs/archive/completed-plans/` に配置
- **一時的なメモ**: 実装完了後に archive へ移動

### 更新ルール

- 主要ドキュメント更新時は `最終更新日` と `対象バージョン` を明記
- 大きな機能追加時は `DATA_MODEL.md` を必ず更新
- データアクセス変更時は `DATA_ACCESS_PRINCIPLES.md` を更新
- アーキテクチャ変更時は `../CLAUDE.md` と該当ドキュメントを更新

## 🔗 関連リソース

- **ルートREADME**: `../README.md` - プロジェクト全体概要
- **Claude開発ガイド**: `../CLAUDE.md` - AI開発者向けガイド
- **プライバシーポリシー**: `../privacy_policy.md`

---

**最終更新**: 2025年10月2日 | **システムバージョン**: 3.2.0 | **ドキュメント数**: 9個（コア4 + リファレンス4 + 計画1）
