# Backend処理速度改善計画

## 調査概要

05-1_Backend_Read.js および 05-2_Backend_Write.js のパフォーマンス改善のため、キャッシュ利用の拡張とシート処理の最適化を調査しました。

## 現状分析

### キャッシュ利用状況

#### 現在キャッシュを利用している処理

- `getAccountingMasterData()` - 会計マスタデータ
- 予約データの定員チェック（一部でキャッシュ未利用）

#### キャッシュ未利用だが利用可能な処理

1. **予約作成時の定員チェック** (`checkCapacityFull` in makeReservation)
2. **ユーザー情報取得** (cancelReservation内の生徒名簿読み込み)
3. **統合予約シート直接読み込み** (複数箇所)

### シート処理最適化ポイント

#### 問題のあるシート処理パターン

1. **生徒名簿の直接読み込み** (`cancelReservation:397-423`)
   - `rosterSheet.getDataRange().getValues()` で全データを毎回読み込み
   - 既存の`CACHE_KEYS.ALL_STUDENTS_BASIC`キャッシュが利用可能

2. **統合予約シートの重複読み込み**
   - `makeReservation`で`getSheetData(integratedSheet)`実行
   - 既存の`CACHE_KEYS.ALL_RESERVATIONS`キャッシュが利用可能

3. **売上スプレッドシート書き込み** (`_logSalesForSingleReservation:928-942`)
   - 別スプレッドシートへの単発書き込み
   - バッチ処理化の検討が必要

## 改善提案

### Phase 1: 予約処理のキャッシュ化（優先度：高）

#### 1.1 定員チェックのキャッシュ利用

**対象**: `checkCapacityFull()` in makeReservation

```javascript
// 変更前: 直接シート読み込み
const { header, headerMap, dataRows: data } = getSheetData(integratedSheet);

// 変更後: キャッシュ利用
const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
const data = reservationsCache ? reservationsCache.reservations : [];
const headerMap = new Map(Object.entries(reservationsCache.headerMap));
```

**効果**:

- API応答時間 50-70% 短縮予測
- シートアクセス回数削減

#### 1.2 ユーザー情報取得のキャッシュ化

**対象**: `cancelReservation`内の生徒名簿読み込み

```javascript
// 変更前: 直接シート読み込み
const rosterAllData = rosterSheet.getDataRange().getValues();

// 変更後: キャッシュ利用
const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
const studentInfo = studentsCache?.students?.[studentId];
```

**効果**:

- 生徒情報取得処理の高速化
- メモリ効率の改善

### Phase 2: タイムゾーン処理の最適化（優先度：高）

#### 2.1 現状の問題点

**不統一なタイムゾーン取得方式**:
- **シートアクセス方式** (7箇所): `getSpreadsheetTimezone()` → APIコール発生
- **定数利用方式** (3箇所): `CONSTANTS.TIMEZONE` → 'Asia/Tokyo'固定
- **初期化コスト**: SpreadsheetManager経由でのタイムゾーン取得

#### 2.2 最適化方針

**日本時間への統一**:
- シートは日本時間設定済み
- ユーザーも基本的に日本時間
- `CONSTANTS.TIMEZONE: 'Asia/Tokyo'` への全面移行

#### 2.3 変更対象箇所

**シートアクセス方式 → 定数利用に変更**:
1. `05-1_Backend_Read.js:41` - 会計マスタ取得時
2. `05-3_Backend_AvailableSlots.js:24` - 予約枠計算時  
3. `07_CacheManager.js:402` - キャッシュ構築時
4. `02-4_BusinessLogic_ScheduleMaster.js` (3箇所) - 日程マスタ処理
5. `08_Utilities.js:123` - ユーティリティ関数

```javascript
// 変更前: シートアクセス
const timezone = getSpreadsheetTimezone();

// 変更後: 定数利用
const timezone = CONSTANTS.TIMEZONE;
```

### Phase 3: シート書き込み処理の最適化（優先度：中）

#### 3.1 売上ログ書き込みのバッチ化

**課題**: 毎回別スプレッドシートにアクセス
**解決策**:

- キューイングシステムの導入
- 定期的なバッチ処理での一括書き込み
- エラー時のリトライ機能

#### 3.2 統合予約シート書き込みの効率化

**現状**: 各処理で個別に書き込み
**改善案**:

- トランザクション内でのまとめ書き込み
- 不要な`flush()`呼び出しの削減

### Phase 4: セッション判定ロジックの統一化（優先度：高）

#### 4.1 現在の不整合状態

**AvailableSlots (05-3)**: 日程マスタベース（最新）
```javascript
// 1部判定: 開始時刻が1部終了時刻以前
if (startTime <= timeCache.firstEndTime) { morningCount++; }
// 2部判定: 終了時刻が2部開始時刻以降  
if (endTime >= timeCache.secondStartTime) { afternoonCount++; }
```

**checkCapacityFull (05-2)**: 固定13時区切り（旧式）
```javascript  
// 固定13時で午前午後を判定
if (rStartHour < CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR) morningCount++;
if (rEndHour >= CONSTANTS.LIMITS.TSUKUBA_MORNING_SESSION_END_HOUR) afternoonCount++;
```

#### 4.2 統一ロジックの実装

**checkCapacityFullをAvailableSlotsと同じロジックに統一**:

```javascript
// 統一後: 日程マスタベースの動的判定
const scheduleData = getCachedScheduleData(classroom, date);
const firstEndTime = new Date(`1900-01-01T${scheduleData.firstEnd}`);
const secondStartTime = new Date(`1900-01-01T${scheduleData.secondStart}`);

// AvailableSlotsと同じ判定ロジック
if (startTime <= firstEndTime) morningCount++;
if (endTime >= secondStartTime) afternoonCount++;
```

### Phase 5: 共通処理の統一化（優先度：中）

#### 5.1 キャッシュデータ取得の共通化

```javascript
// 新規共通関数
function getCachedReservationsForCapacityCheck(classroom, date) {
  const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
  // フィルタリング + 変換処理を統一
}
```

#### 5.2 ユーザー情報取得の共通化

```javascript
// 新規共通関数  
function getCachedStudentInfo(studentId) {
  const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
  return studentsCache?.students?.[studentId];
}
```

### Phase 6: マスタデータ統合による重複排除（優先度：中）

#### 4.1 現状の問題点

**マスタデータの重複管理**:

- **会計マスタ**: 授業時間設定 (`CLASS_START/END`, `BREAK_START/END`) を管理
- **日程マスタ**: 同等の時間設定 (`FIRST_START/END`, `SECOND_START/END`) を管理
- **定数管理**: 固定定員を `CONSTANTS.CLASSROOM_CAPACITIES` で管理
- **データ不整合リスク**: 複数箇所での同一情報管理によるメンテナンスコスト

#### 4.2 統合方針

**日程マスタを教室情報のSingle Source of Truth**として活用:

```javascript
// 【変更1】定員情報の統合
// 変更前: 固定定数から取得
const capacity = CONSTANTS.CLASSROOM_CAPACITIES[classroom] || 8;

// 変更後: 日程マスタから動的取得
const scheduleData = getCachedScheduleData(classroom, date);
const capacity = scheduleData?.totalCapacity || 8;

// 【変更2】授業時間設定の統合
// 変更前: 会計マスタから取得
const tokyoRule = masterData.find(item => 
  item['項目名'] === CONSTANTS.ITEMS.MAIN_LECTURE);
const startTime = tokyoRule[CONSTANTS.HEADERS.CLASS_START];

// 変更後: 日程マスタから取得
const scheduleData = getCachedScheduleData(classroom, date);
const startTime = scheduleData?.firstStart;
```

#### 4.3 統合対象項目

**会計マスタ → 日程マスタに移行**:

1. **授業時間設定**:
   - `CLASS_START` → `FIRST_START`
   - `CLASS_END` → `FIRST_END`
   - `BREAK_START/END` → 日程マスタの時間設定で管理

2. **教室定員管理**:
   - `CLASSROOM_CAPACITIES` → `TOTAL_CAPACITY`
   - 初心者定員 → `BEGINNER_CAPACITY`

3. **教室形式判定**:
   - 会計マスタの`対象教室`フィルタ → 日程マスタの`TYPE`フィールド

#### 4.4 影響範囲

**変更対象箇所**:

1. `05-2_Backend_Write.js:40-41` - 定員チェック処理
2. `05-2_Backend_Write.js:249-257` - 東京教室の時間設定取得
3. `05-2_Backend_Write.js:128-132` - 休憩時間バリデーション
4. `05-3_Backend_AvailableSlots.js:207` - 予約枠計算
5. `06_ExternalServices.js:164` - カレンダー統合

**メリット**:

- **データ一元化**: Single Source of Truthによる整合性確保
- **柔軟性向上**: 日程別・教室別の個別設定が可能
- **メンテナンス性**: 複数マスタ管理の複雑性を解消
- **パフォーマンス**: キャッシュ統合による高速化

## 実装計画

### Week 1: Phase 1.1 - 定員チェックキャッシュ化

- [ ] `checkCapacityFull()`のキャッシュ対応
- [ ] 単体テストの実装
- [ ] 性能測定

### Week 2: Phase 1.2 & Phase 2 - ユーザー情報キャッシュ化・タイムゾーン最適化

- [ ] `cancelReservation`のキャッシュ対応
- [ ] **タイムゾーン処理の統一化** (7箇所): `getSpreadsheetTimezone()` → `CONSTANTS.TIMEZONE`
- [ ] 既存機能の回帰テスト
- [ ] パフォーマンス検証

### Week 3: Phase 4 - セッション判定ロジックの統一化

- [ ] AvailableSlotsのセッション判定ロジックを分析・抽出  
- [ ] checkCapacityFullのロジックをAvailableSlots方式に統一
- [ ] 日程マスタから動的に1部・2部時間を取得する実装
- [ ] 固定13時区切りからの完全移行とテスト

### Week 4: Phase 3 - 書き込み処理最適化

- [ ] 売上ログ書き込みの設計見直し
- [ ] バッチ処理機能の実装
- [ ] エラーハンドリングの強化

### Week 5: Phase 5 - 共通化とリファクタリング

- [ ] セッション判定の共通関数実装
- [ ] キャッシュデータ取得の共通化
- [ ] ユーザー情報取得の共通化
- [ ] 総合的な性能測定

### Week 6: Phase 6 - マスタデータ統合

- [ ] 日程マスタキャッシュから教室情報取得する共通関数の実装
- [ ] 会計マスタ依存箇所の日程マスタへの段階的移行:
  - [ ] 定員情報の統合 (CLASSROOM_CAPACITIES → TOTAL_CAPACITY)
  - [ ] 授業時間設定の統合 (CLASS_START/END → FIRST_START/END)
  - [ ] 休憩時間設定の移行
- [ ] 教室別・日程別の柔軟設定の動作確認
- [ ] データ整合性検証とレガシー定数の段階的削除

## 期待効果

### パフォーマンス改善

- **予約作成処理**: 50-70%の高速化
- **予約キャンセル処理**: 30-50%の高速化
- **API全体のレスポンス時間**: 平均40%改善

### 保守性向上

- **コード重複削減**: 30%以上
- **キャッシュ活用の統一化**: メンテナンス性向上
- **エラーハンドリング強化**: システム安定性向上
- **マスタデータ一元化**: 日程マスタによるSingle Source of Truth実現
- **データ整合性確保**: 重複管理による不整合リスクの解消
- **柔軟な運用**: 日程別・教室別の個別設定が可能

### システム負荷軽減

- **Google Sheets API呼び出し**: 60%削減
- **メモリ使用量**: 20-30%削減
- **6分制限への余裕**: 大幅改善

## リスク評価

### 低リスク項目

- Phase 1のキャッシュ化（既存キャッシュシステム活用）
- 共通関数の実装（段階的な置換可能）

### 中リスク項目  

- 売上ログのバッチ化（データ整合性の考慮必要）
- 書き込みタイミングの変更（テスト検証重要）

### 対策

- 段階的な実装とテスト
- 機能フラグによる段階的展開
- 詳細な性能測定とモニタリング

## 次のアクション

1. **Phase 1.1の実装開始** - 定員チェックキャッシュ化
2. **テスト環境での検証** - 既存機能への影響確認  
3. **性能測定基準の設定** - Before/After比較準備
4. **段階的なデプロイ計画** - 本番環境への安全な適用
5. **教室情報統一化の準備** - 日程マスタキャッシュ活用方針の詳細検討

---

**作成日**: 2025-08-29  
**対象バージョン**: v2.1  
**関連ファイル**:

- `src/05-1_Backend_Read.js`
- `src/05-2_Backend_Write.js`
- `src/07_CacheManager.js`
