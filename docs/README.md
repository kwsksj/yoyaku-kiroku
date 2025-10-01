# ドキュメントガイド

このディレクトリには「きぼりの よやく・きろく」システムの技術ドキュメントが含まれています。

## 📚 コアドキュメント（必読）

現在のシステム（v3.2.0）を理解するために必須のドキュメント：

| ファイル名 | 内容 | 対象 |
|-----------|------|------|
| **[DATA_MODEL.md](DATA_MODEL.md)** | データモデル設計仕様書 | 全開発者 |
| **[JS_TO_HTML_ARCHITECTURE.md](JS_TO_HTML_ARCHITECTURE.md)** | JavaScript分離開発アーキテクチャ | 全開発者 |
| **[MIGRATION_TO_JS_DEV.md](MIGRATION_TO_JS_DEV.md)** | JavaScript分離開発への移行手順 | 新規開発者 |
| **[FRONTEND_ARCHITECTURE_GUIDE.md](FRONTEND_ARCHITECTURE_GUIDE.md)** | フロントエンドアーキテクチャガイド | フロントエンド開発者 |
| **[DATA_ACCESS_PRINCIPLES.md](DATA_ACCESS_PRINCIPLES.md)** | データアクセス原則 | バックエンド開発者 |

## 📖 リファレンスドキュメント

実装の詳細や開発ガイドライン：

| ファイル名 | 内容 |
|-----------|------|
| **[CONSTANTS_GUIDE.md](CONSTANTS_GUIDE.md)** | 定数システムの使い方 |
| **[CONSTANTS_DOCUMENTATION_INDEX.md](CONSTANTS_DOCUMENTATION_INDEX.md)** | 定数ドキュメント索引 |
| **[BUSINESS_LOGIC_REFERENCE.md](BUSINESS_LOGIC_REFERENCE.md)** | ビジネスロジックリファレンス |
| **[AI_INSTRUCTION_TEMPLATES.md](AI_INSTRUCTION_TEMPLATES.md)** | AI開発指示テンプレート |
| **[ONGOING_ISSUES.md](ONGOING_ISSUES.md)** | 継続的な問題・改善事項 |

## 🔮 将来機能計画

未実装の機能計画書：

| ファイル名 | 内容 | ステータス |
|-----------|------|-----------|
| **[BOOKING_CONFIRMATION_EMAIL_PLAN.md](BOOKING_CONFIRMATION_EMAIL_PLAN.md)** | 予約確認メール機能 | 計画段階 |
| **[CALENDAR_SYNC_SPECIFICATION.md](CALENDAR_SYNC_SPECIFICATION.md)** | カレンダー同期機能 | 計画段階 |

## 📦 アーカイブ

過去の計画書や完了した分析レポートは `archive/` ディレクトリに保存されています：

### archive/completed-plans/

実装完了または古くなった計画書・分析レポート（約40ファイル）：

- **データモデル移行関連** - Phase 1-2の設計書・分析レポート
- **パフォーマンス改善関連** - Phase 3-4の最適化計画書
- **型安全性プロジェクト** - フロントエンド型安全性の各種計画書（10ファイル）
- **機能実装計画** - 会計機能、プロフィール編集等の完了した計画書
- **バックエンド分析** - エラー分析、統合確認レポート
- **作業メモ** - 一時的な開発メモ・仕様メモ

## 🗺️ システム理解の推奨順序

### 新規開発者向け

1. **プロジェクト概要**: `../README.md`（ルート）
2. **開発環境セットアップ**: `../CLAUDE.md`
3. **データモデル理解**: `DATA_MODEL.md`
4. **開発ワークフロー**: `JS_TO_HTML_ARCHITECTURE.md` → `MIGRATION_TO_JS_DEV.md`
5. **フロントエンド構造**: `FRONTEND_ARCHITECTURE_GUIDE.md`
6. **バックエンド原則**: `DATA_ACCESS_PRINCIPLES.md`

### 機能追加・改修時

1. **ビジネスロジック確認**: `BUSINESS_LOGIC_REFERENCE.md`
2. **定数システム**: `CONSTANTS_GUIDE.md`
3. **既知の問題**: `ONGOING_ISSUES.md`
4. **AI開発支援**: `AI_INSTRUCTION_TEMPLATES.md`

## 📝 ドキュメント管理ルール

### 新規ドキュメント作成時

- **現在有効な仕様・ガイド**: `docs/` 直下に配置
- **完了した計画・古い分析**: `docs/archive/completed-plans/` に配置
- **一時的なメモ**: 実装完了後に archive へ移動

### 更新ルール

- 主要ドキュメント更新時は `最終更新日` と `バージョン` を明記
- 大きな機能追加時は `DATA_MODEL.md` を必ず更新
- アーキテクチャ変更時は `CLAUDE.md` と該当ドキュメントを更新

---

**最終更新**: 2025年10月2日 | **システムバージョン**: 3.2.0
