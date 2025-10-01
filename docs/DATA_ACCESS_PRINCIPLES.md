# データアクセス設計原則（v3.2対応）

**最終更新**: 2025年10月2日
**対象バージョン**: v3.2.0
**ステータス**: 現行有効

## 概要

このドキュメントは、予約管理システムにおけるデータアクセスの統一的なルールを定義します。本原則に従うことで、パフォーマンス、保守性、信頼性を最大化します。

## 基本アーキテクチャ

```text
【データフロー】
┌─────────────────┐
│ Google Sheets   │ ← マスターデータ（原本）
│ - 統合予約      │
│ - 生徒名簿      │
│ - 日程マスタ    │
│ - 会計マスタ    │
└────┬────────────┘
     │ rebuild (6時間毎 + 書き込み時)
     ↓
┌─────────────────┐
│ CacheService    │ ← 高速キャッシュ（v5.5）
│ - 予約データ    │   - インクリメンタル更新対応
│ - 生徒基本情報  │   - 分割キャッシュ対応（90KB超）
│ - 日程マスタ    │   - バージョン管理
│ - 会計マスタ    │
└────┬────────────┘
     │ getCachedData()
     ↓
┌─────────────────┐
│ Application     │
│ - Backend API   │
│ - Frontend UI   │
└─────────────────┘
```

## データアクセス原則

### 原則1: 読み取りは常にキャッシュから

**ルール**: データの参照・利用は必ず `getCachedData()` を経由する

```javascript
// ✅ 正しい例
const reservations = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
const students = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);

// ❌ 間違った例
const sheet = SS_MANAGER.getSpreadsheet().getSheetByName('統合予約');
const data = sheet.getDataRange().getValues(); // 直接シート読み込みは禁止
```

**対象キャッシュキー** (`CACHE_KEYS`):
- `ALL_RESERVATIONS` - 全予約データ
- `ALL_STUDENTS_BASIC` - 生徒基本情報（8項目）
- `MASTER_SCHEDULE_DATA` - 日程マスタ
- `MASTER_ACCOUNTING_DATA` - 会計マスタ

**メリット**:
- SpreadsheetAPI呼び出しの最小化（95%削減）
- 応答速度の劇的向上（2-3秒 → 50-200ms）
- 分割キャッシュによる大容量データ対応（最大1.8MB）

### 原則2: 書き込み時はインクリメンタル更新を活用

**ルール**: データ更新時は差分更新関数を使用する

```javascript
// ✅ 正しい例 - 新規予約追加
const newReservation = createReservationData(...);
writeToSheet(newReservation); // シートに書き込み
addReservationToCache(newReservation); // 差分でキャッシュ更新

// ✅ 正しい例 - 予約更新
updateReservationInSheet(reservationId, updates);
updateReservationInCache(reservationId, updates); // 該当予約のみ更新

// ✅ 正しい例 - 予約削除
deleteFromSheet(reservationId);
deleteReservationFromCache(reservationId); // 該当予約のみ削除

// ❌ 間違った例 - 全体再構築（重い）
writeToSheet(newReservation);
rebuildAllReservationsCache(); // 2-3秒かかる（使わない）
```

**インクリメンタル更新関数**:
- `addReservationToCache(reservation)` - 新規追加（50-200ms）
- `updateReservationInCache(reservationId, updates)` - 更新（50-200ms）
- `deleteReservationFromCache(reservationId)` - 削除（50-200ms）

**自動フォールバック**: エラー時は自動的に全体再構築にフォールバック

### 原則3: キャッシュ再構築はCacheManagerが担当

**ルール**: キャッシュの全体再構築は `07_CacheManager.js` の専任

```javascript
// ✅ これらはCacheManagerのみが実行
rebuildAllReservationsCache();
rebuildAllStudentsBasicCache();
rebuildScheduleMasterDataCache();
rebuildAccountingMasterDataCache();

// 時間主導型トリガー（6時間毎）が自動実行
trigger_rebuildAllCaches();
```

**全体再構築が必要なケース**:
- 初回起動時
- キャッシュ消失時（自動検出）
- 大量データ一括更新時（バッチ処理）
- 手動メンテナンス時

## データアクセスパターン

### パターン1: データ取得（読み取り専用）

```javascript
// Backend API
function getMyReservations(userId) {
  const allReservations = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  return allReservations.filter(r => r.userId === userId);
}

// Frontend
google.script.run
  .withSuccessHandler(data => {
    // キャッシュから取得したデータを表示
    displayReservations(data);
  })
  .getMyReservations(currentUserId);
```

### パターン2: データ作成（書き込み + インクリメンタル更新）

```javascript
// Backend API - 05-2_Backend_Write.js
function createReservation(reservationData) {
  try {
    // 1. シートに書き込み
    const newReservation = writeReservationToSheet(reservationData);

    // 2. インクリメンタルキャッシュ更新
    addReservationToCache(newReservation);

    // 3. バージョンインクリメント（フロントエンド通知用）
    incrementCacheVersion(CACHE_KEYS.ALL_RESERVATIONS);

    return { success: true, data: newReservation };
  } catch (error) {
    // エラー時は自動的に全体再構築にフォールバック
    Logger.log('インクリメンタル更新失敗、全体再構築実行');
    rebuildAllReservationsCache();
    throw error;
  }
}
```

### パターン3: データ更新（部分更新）

```javascript
// Backend API
function updateReservationMemo(reservationId, newMemo) {
  // 1. シート更新
  updateReservationInSheet(reservationId, { memo: newMemo });

  // 2. キャッシュ内の該当予約のみ更新
  updateReservationInCache(reservationId, { memo: newMemo });

  return { success: true };
}
```

### パターン4: バージョン管理とリアルタイム更新

```javascript
// Frontend - ポーリングによる差分検出
let cachedVersion = 0;

function checkForUpdates() {
  google.script.run
    .withSuccessHandler(serverVersion => {
      if (serverVersion > cachedVersion) {
        // 新しいデータがあれば再取得
        cachedVersion = serverVersion;
        refreshReservations();
      }
    })
    .getCacheVersion(CACHE_KEYS.ALL_RESERVATIONS);
}

// 10秒毎にチェック
setInterval(checkForUpdates, 10000);
```

## 分割キャッシュシステム（v5.5+）

### 自動分割の仕組み

データサイズが90KB以上になると、自動的にチャンク分割されます：

```javascript
// アプリケーション側は意識不要
const reservations = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
// ↓ 内部で自動判定
// - 90KB未満 → 通常キャッシュ
// - 90KB以上 → 分割キャッシュ（最大20チャンク = 1.8MB）
```

**技術詳細**:
- チャンクキー: `all_reservations_chunk_0`, `all_reservations_chunk_1`, ...
- メタデータ: `all_reservations_meta` (チャンク数・バージョン情報)
- 読み込み: 全チャンクを統合して返却（透過的）
- 書き込み: 自動分割して保存

## パフォーマンス指標

| 操作 | 従来方式 | 現行方式（v5.5） | 改善率 |
|------|----------|------------------|--------|
| データ取得 | 2-3秒 | 50-200ms | 95%+ |
| 新規作成 | 3-4秒 | 50-200ms | 95%+ |
| 更新 | 3-4秒 | 50-200ms | 95%+ |
| 削除 | 3-4秒 | 50-200ms | 95%+ |

## トラブルシューティング

### キャッシュ不整合時

```javascript
// 管理者用：手動キャッシュ再構築
trigger_rebuildAllCaches();
```

### 分割キャッシュ確認

```javascript
// 分割状態を確認
const cache = CacheService.getScriptCache();
const meta = cache.get('all_reservations_meta');
if (meta) {
  const metadata = JSON.parse(meta);
  Logger.log(`チャンク数: ${metadata.chunkCount}`);
}
```

## まとめ

| 操作種別 | 実行方法 | 担当モジュール |
|---------|---------|--------------|
| **読み取り** | `getCachedData()` | 全アプリケーション |
| **書き込み** | `writeToSheet()` + `add/update/deleteInCache()` | Backend (`05-2`) |
| **全体再構築** | `rebuild***Cache()` | CacheManager (`07`) |
| **バージョン管理** | `incrementCacheVersion()` | CacheManager (`07`) |

---

**関連ドキュメント**:
- [DATA_MODEL.md](DATA_MODEL.md) - キャッシュシステムの詳細設計
- [JS_TO_HTML_ARCHITECTURE.md](JS_TO_HTML_ARCHITECTURE.md) - 開発環境
- [FRONTEND_ARCHITECTURE_GUIDE.md](FRONTEND_ARCHITECTURE_GUIDE.md) - フロントエンド構造
