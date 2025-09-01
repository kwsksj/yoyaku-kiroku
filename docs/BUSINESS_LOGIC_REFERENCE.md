# ビジネスロジック・データアクセス層 実装リファレンス

## 概要

このドキュメントは、データアクセス層抽象化アーキテクチャの実装例として作成された以下のファイルの内容を保存したものです：

- `src/02-5_BusinessLogic_ReservationService.js`
- `src/03_DataAccess.js`

将来の本格的な改修時の参考資料として活用してください。

## ⚠️ 重要な注意事項（2025年9月1日追記）

注意: **データアクセス層抽象化の作業は一旦停止中**

現在のシステムは既存のアーキテクチャで安定稼働しており、IMPROVEMENT_PLAN.mdに基づく改修が優先されています。データアクセス層の完全抽象化は以下の理由で将来対応とします：

### 停止理由

1. **現状の安定性**: 既存システムが問題なく動作している
2. **改修優先度**: ユーザー体験向上の方が緊急度が高い
3. **リスク管理**: 大規模アーキテクチャ変更のリスクを回避

### 現在の状況

- `03_DataAccess.js` と `02-5_BusinessLogic_ReservationService.js` は.bakファイルにバックアップ済
- 既存のコードベースは従来の直接アクセス方式で運用継続

### 将来の対応方針

この抽象化は、以下の条件が整った際に再開を検討：

1. IMPROVEMENT_PLAN.mdの高優先度項目が完了後
2. 十分な検証期間とテストリソースが確保できる時期
3. ビジネス要件でデータソース変更が必要になった場合

## データアクセス層抽象化とは

### 目的

現在のシステムでは、ビジネスロジックが直接Google Sheetsやキャッシュにアクセスしており、以下の課題があります：

1. **密結合**: データソースの変更がビジネスロジックに直接影響
2. **テスト困難**: 実際のスプレッドシートなしではテストが困難
3. **重複コード**: 似たようなデータアクセス処理が各所に散在
4. **保守性**: データ構造変更時の影響範囲が大きい

### 抽象化の効果

データアクセス層を抽象化することで以下が実現されます：

- **Repository パターン**: データソースの詳細をビジネスロジックから隠蔽
- **Service Layer**: ビジネスルールの集約と再利用
- **依存性注入**: モックによるテストの容易化
- **統一インターフェース**: 一貫性のあるデータアクセス方法

### アーキテクチャ構成

```text
ビジネスロジック層 (Service)
         ↓
データアクセス層 (Repository)
         ↓
データストア層 (Cache + Sheets)
```

## ReservationService クラス

```javascript
class ReservationService {
  constructor(reservationRepo, scheduleMasterRepo, userRepo) {
    this.reservationRepo = reservationRepo;
    this.scheduleMasterRepo = scheduleMasterRepo;
    this.userRepo = userRepo;
  }

  /**
   * 指定日・教室の定員チェックを行う
   */
  isCapacityFull(classroom, date, startTime, endTime) {
    // 実装詳細は元ファイルを参照
  }

  /**
   * 予約可能性を包括的にチェック
   */
  validateReservationRequest(reservationRequest) {
    // 実装詳細は元ファイルを参照
  }

  /**
   * 予約を作成
   */
  createReservation(reservationData) {
    // 実装詳細は元ファイルを参照
  }

  /**
   * 予約をキャンセル
   */
  cancelReservation(reservationId, cancelReason = '') {
    // 実装詳細は元ファイルを参照
  }
}
```

## AvailableSlotsService クラス

```javascript
class AvailableSlotsService {
  constructor(reservationRepo, scheduleMasterRepo) {
    this.reservationRepo = reservationRepo;
    this.scheduleMasterRepo = scheduleMasterRepo;
  }

  /**
   * 指定教室の利用可能スロットを計算
   */
  calculateAvailableSlots(classroom, fromDate = null, toDate = null) {
    // 実装詳細は元ファイルを参照
  }
}
```

## データアクセス層リポジトリクラス

### ReservationRepository

- 予約データの統一アクセスポイント
- キャッシュとスプレッドシートへの透過的アクセス

### ScheduleMasterRepository

- 日程マスタデータの統一アクセスポイント
- 定員取得のフォールバック処理を含む

### UserRepository

- ユーザー関連データの統一アクセスポイント
- 検索機能を提供

### CacheDataAccess

- キャッシュ層への統一インターフェース
- 生データをオブジェクト配列に変換

### SheetDataAccess

- スプレッドシート層への統一インターフェース
- CRUD操作を提供

## アーキテクチャの特徴

1. **Repository パターン**: データアクセスの抽象化
2. **Service Layer**: ビジネスロジックの分離
3. **依存性注入**: テスタブルな設計
4. **キャッシュ透過性**: パフォーマンス最適化

## 備考

これらのクラスは設計の方向性を示すプロトタイプとして作成されました。本格的な実装時には、現在のシステムとの統合性やパフォーマンス要件を考慮して再設計することを推奨します。
