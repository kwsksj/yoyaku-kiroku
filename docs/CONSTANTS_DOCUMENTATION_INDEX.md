# 定数システム ドキュメント目次

**最終更新**: 2025年9月5日  
**ステータス**: 2段階定数構造 運用開始

## 📚 メインドキュメント

### **📖 完全ガイド（必読）**

- **[CONSTANTS_GUIDE.md](CONSTANTS_GUIDE.md)**
  - **オールインワン**: アーキテクチャ・実装方法・使用ガイドライン
  - **最重要資料**: 開発時はこのファイルを参照

### **🔧 ツール・分析**

- **[TOOLS_EVALUATION.md](TOOLS_EVALUATION.md)**
  - `tools/analyze-frontend-properties.js`の有用性評価
  - 移行期間中のツール運用方針

## 🗂️ 実装ファイル

### **バックエンド**

- `src/00_Constants.js` - 2段階定数構造実装
- `types/constants.d.ts` - TypeScript型定義

### **フロントエンド**

- `frontend-constants-template.html` - HTML用テンプレート
- 各HTMLファイル内 `<script>` タグで実装

### **検証ファイル**

- `archive/constants-experimentation/test-final-verification.html` - 型チェック動作確認

## 📈 移行状況

✅ **完了**: 2段階定数構造設計・実装・ドキュメント整備  
🔄 **進行中**: 既存コードの段階的移行・後方互換性定数の整理  
📋 **今後**: ESLintルール追加・CI/CDでの定数整合性検証

## 🎯 クイックスタート

**新規開発**: `CONSTANTS_GUIDE.md` → バックエンドは `src/00_Constants.js` パターン → フロントエンドは `frontend-constants-template.html` をコピー  
**既存修正**: `CONSTANTS_GUIDE.md` で推奨パターン確認 → VSCodeで型エラー検出しながら修正  
**AI支援**: 「`CONSTANTS.STATUS.CONFIRMED`を使って...」で指示（完全参照推奨）

---

**💡 質問・問題・改善提案があれば、このドキュメント群を更新してください**
