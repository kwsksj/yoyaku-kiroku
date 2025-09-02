# Enhanced Data Objects 仕様書

## 概要

現在のハンドラーで発生している手動データ代入処理を自動化し、ID入力だけで必要な情報が自動設定される拡張データオブジェクトシステムの仕様書です。

## 背景・課題

### 現在の問題

```javascript
// 現在の複雑な手動処理例
const editingDetails = {
  reservationId: reservation.reservationId,
  classroom: reservation.classroom,
  date: reservation.date,
  venue: reservation.venue,
  chiselRental: reservation.chiselRental || false,
  firstLecture: reservation.firstLecture || false,
  startTime: reservation.startTime || '',
  endTime: reservation.endTime || '',
  // ... 多数の手動代入
};

// さらにscheduleInfo取得とマージ
getScheduleInfoFromCache(date, classroom).then(scheduleInfo => {
  const enrichedDetails = {
    ...editingDetails,
    firstStart: scheduleInfo?.firstStart,
    firstEnd: scheduleInfo?.firstEnd,
    // ... さらに手動マージ
  };
});
```

### 目指すべき姿

```javascript
// シンプルなID入力だけで完全なデータオブジェクトを取得
const enhancedDetails = await createEnhancedEditingDetails(reservationId);
stateManager.dispatch({
  type: 'SET_STATE',
  payload: { view: 'editReservation', editingReservationDetails: enhancedDetails },
});
```

## システム設計

### アーキテクチャ概要

```text
【Enhanced Data Objects Layer】
├─ ID入力 (予約ID / 日程ID)
├─ 自動キャッシュ参照
├─ 自動データマージ
└─ 完全なUIオブジェクト生成

【Data Sources】
├─ 予約データ (findReservationById)
├─ 日程マスタ (getScheduleInfoFromCache)
├─ ユーザーデータ (currentUser)
├─ 会計キャッシュ (loadAccountingCache)
└─ 定数データ (constants)
```

## 実装仕様

### 1. 予約編集用拡張オブジェクト

#### **createEnhancedEditingDetails(reservationId)**

```javascript
/**
 * 予約IDから完全な予約編集データを自動生成
 * @param {string} reservationId - 予約ID
 * @returns {Promise<Object>} 完全な編集用データオブジェクト
 */
async function createEnhancedEditingDetails(reservationId) {
  // 1. 基本予約データ取得
  const reservation = findReservationById(reservationId);
  if (!reservation) {
    throw new Error(`予約ID ${reservationId} が見つかりません`);
  }

  // 2. 基本フィールドの自動マッピング
  const baseDetails = {
    // 基本情報
    reservationId: reservation.reservationId,
    classroom: reservation.classroom,
    date: reservation.date,
    venue: reservation.venue,

    // オプション項目（デフォルト値付き）
    chiselRental: reservation.chiselRental || false,
    firstLecture: reservation.firstLecture || false,
    startTime: reservation.startTime || '',
    endTime: reservation.endTime || '',
    workInProgress: reservation.workInProgress || '',
    order: reservation.order || '',
    messageToTeacher: reservation.message || '',
    materialInfo: reservation.materialInfo || '',
  };

  // 3. 日程マスタ情報を自動取得・マージ
  const scheduleInfo = await getScheduleInfoFromCache(reservation.date, reservation.classroom);

  // 4. 完全な拡張オブジェクトを生成
  return {
    ...baseDetails,

    // 日程マスタ情報の自動マージ
    firstStart: scheduleInfo?.firstStart,
    firstEnd: scheduleInfo?.firstEnd,
    secondStart: scheduleInfo?.secondStart,
    secondEnd: scheduleInfo?.secondEnd,
    classroomType: scheduleInfo?.classroomType,

    // メタデータ（デバッグ・トレース用）
    _sourceReservation: reservation,
    _scheduleInfo: scheduleInfo,
    _enhancedAt: new Date().toISOString(),
  };
}
```

### 2. 会計用拡張オブジェクト

#### **createEnhancedAccountingData(reservationId)**

```javascript
/**
 * 予約IDから完全な会計データを自動生成
 * @param {string} reservationId - 予約ID
 * @returns {Promise<Object>} 完全な会計用データオブジェクト
 */
async function createEnhancedAccountingData(reservationId) {
  // 1. 基本予約データ取得
  const reservation = findReservationById(reservationId);
  if (!reservation) {
    throw new Error(`予約ID ${reservationId} が見つかりません`);
  }

  // 2. 既存キャッシュデータ読み込み
  const cachedData = loadAccountingCache(reservationId);

  // 3. 基本会計データ構築
  const baseDetails = {
    firstLecture: reservation.firstLecture || false,
    chiselRental: reservation.chiselRental || false,
    startTime: reservation.startTime || null,
    endTime: reservation.endTime || null,
  };

  const reservationDetails = { ...baseDetails, ...cachedData };

  // 4. 日程マスタ情報を自動取得
  const scheduleInfo = await getScheduleInfoFromCache(reservation.date, reservation.classroom);

  // 5. 完全な会計オブジェクトを生成
  return {
    // 会計画面で必要な構造化データ
    reservationDetails,
    scheduleInfo,
    reservation: {
      reservationId: reservation.reservationId,
      classroom: reservation.classroom,
      date: reservation.date,
      venue: reservation.venue,
      studentId: reservation.studentId,
      status: reservation.status,
    },

    // メタデータ
    _sourceReservation: reservation,
    _cachedData: cachedData,
    _enhancedAt: new Date().toISOString(),
  };
}
```

### 3. 新規予約用拡張オブジェクト

#### **createEnhancedNewReservationData(scheduleId)**

```javascript
/**
 * 日程IDから完全な新規予約データを自動生成
 * @param {string} scheduleId - 日程ID（将来実装）
 * @returns {Promise<Object>} 完全な新規予約用データオブジェクト
 */
async function createEnhancedNewReservationData(scheduleId) {
  // 1. 日程マスタから基本情報取得
  const scheduleInfo = await getScheduleInfoById(scheduleId);
  if (!scheduleInfo) {
    throw new Error(`日程ID ${scheduleId} が見つかりません`);
  }

  // 2. 空き状況を自動取得
  const availabilityInfo = await getSlotAvailability(scheduleInfo.date, scheduleInfo.classroom);

  // 3. ユーザー情報を自動設定
  const currentUser = stateManager.getState().currentUser;

  // 4. 完全な新規予約オブジェクトを生成
  return {
    // 基本日程情報
    scheduleId,
    date: scheduleInfo.date,
    classroom: scheduleInfo.classroom,
    venue: scheduleInfo.venue,

    // 日程マスタ詳細
    classroomType: scheduleInfo.classroomType,
    firstStart: scheduleInfo.firstStart,
    firstEnd: scheduleInfo.firstEnd,
    secondStart: scheduleInfo.secondStart,
    secondEnd: scheduleInfo.secondEnd,

    // 空き状況
    availableSlots: availabilityInfo.availableSlots,
    morningSlots: availabilityInfo.morningSlots,
    afternoonSlots: availabilityInfo.afternoonSlots,
    isFull: availabilityInfo.isFull,

    // ユーザー情報
    user: currentUser,
    studentId: currentUser?.studentId,
    isFirstTimeBooking: await checkFirstTimeBooking(currentUser?.studentId),

    // メタデータ
    _scheduleInfo: scheduleInfo,
    _availabilityInfo: availabilityInfo,
    _enhancedAt: new Date().toISOString(),
  };
}
```

## ハンドラーでの使用例

### Before (現在の複雑な処理)

```javascript
// 予約編集
editReservation: d => {
  const reservation = findReservationById(d.reservationId);
  if (reservation) {
    const editingDetails = { /* 長い手動代入処理 */ };
    stateManager.dispatch({ /* 基本情報でビュー表示 */ });
    getScheduleInfoFromCache(/* scheduleInfo取得 */).then(scheduleInfo => {
      const enrichedDetails = { /* 手動マージ */ };
      stateManager.dispatch({ /* 再描画 */ });
    });
  }
},

// 会計画面
goToAccounting: d => {
  const reservationData = findReservationById(d.reservationId);
  if (reservationData) {
    const cachedData = loadAccountingCache(d.reservationId);
    const baseDetails = { /* 手動構築 */ };
    const reservationDetails = { ...baseDetails, ...cachedData };
    stateManager.dispatch({ /* 基本情報でビュー表示 */ });
    getScheduleInfoFromCache(/* scheduleInfo取得 */).then(scheduleInfo => {
      stateManager.dispatch({ /* 再描画 */ });
    });
  }
},
```

### After (Enhanced Data Objects使用)

```javascript
// 予約編集 - シンプル！
editReservation: async d => {
  try {
    showLoading('dataFetch');
    const enhancedDetails = await createEnhancedEditingDetails(d.reservationId);
    stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'editReservation',
        editingReservationDetails: enhancedDetails,
      },
    });
    hideLoading();
  } catch (error) {
    hideLoading();
    showInfo(error.message);
  }
},

// 会計画面 - シンプル！
goToAccounting: async d => {
  try {
    showLoading('accounting');
    const accountingData = await createEnhancedAccountingData(d.reservationId);
    stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'accounting',
        accountingReservation: accountingData.reservation,
        accountingReservationDetails: accountingData.reservationDetails,
        accountingScheduleInfo: accountingData.scheduleInfo,
      },
    });
    // DOM構築後の計算処理
    setTimeout(() => calculateAccountingDetails(), 100);
    hideLoading();
  } catch (error) {
    hideLoading();
    showInfo(error.message);
  }
},

// 新規予約 - 日程ID指定だけ！
selectSchedule: async d => {
  try {
    showLoading('dataFetch');
    const newReservationData = await createEnhancedNewReservationData(d.scheduleId);
    stateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'newReservation',
        selectedSlot: newReservationData,
      },
    });
    hideLoading();
  } catch (error) {
    hideLoading();
    showInfo(error.message);
  }
},
```

## 期待される効果

### **コード品質の向上**

- **ハンドラーコード量**: 70%削減
- **重複処理の排除**: データ構築ロジックの一元化
- **保守性向上**: 変更箇所が一箇所に集約

### **パフォーマンス改善**

- **描画回数削減**: 2回描画 → 1回描画
- **DOM操作最適化**: 不要な再描画を完全排除
- **ユーザーエクスペリエンス**: 完全な情報での初回表示

### **開発効率向上**

- **新機能開発**: 既存の拡張オブジェクトを再利用
- **テスタビリティ**: 各拡張関数を単独でテスト可能
- **デバッグ改善**: メタデータによるトレース機能

### **エラーハンドリング強化**

- **統一エラー処理**: try-catch による確実なエラーキャッチ
- **ユーザーフレンドリー**: 具体的なエラーメッセージ表示
- **ログ改善**: デバッグ用メタデータの自動付与

## 実装ロードマップ

### Phase 1: 基盤実装 (優先度: 高)

- `createEnhancedEditingDetails` の実装・テスト
- `createEnhancedAccountingData` の実装・テスト
- 予約編集・会計画面での適用

### Phase 2: 新規予約対応 (優先度: 中)

- 日程ID導入（`SCHEDULE_ID` 列追加）
- `createEnhancedNewReservationData` の実装
- 新規予約画面での適用

### Phase 3: 最適化 (優先度: 低)

- キャッシュ戦略の最適化
- エラーハンドリングの精緻化
- パフォーマンス監視・メトリクス追加

## 実装場所

**ファイル**: `src/12_WebApp_Core.html`  
**セクション**: Enhanced Data Objects Functions

```javascript
// =================================================================
// --- Enhanced Data Objects System ---
// -----------------------------------------------------------------
// ID入力だけで完全なUIオブジェクトを自動生成するシステム
// ハンドラーの複雑性を大幅に削減し、保守性を向上
// =================================================================
```

---

**最終更新**: 2025-09-02  
**ステータス**: 仕様策定完了 → 実装準備中  
**担当者**: Claude Code Assistant
