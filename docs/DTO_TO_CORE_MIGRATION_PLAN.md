# DTO型廃止とCore型完全統一 - 実装計画

**作成日**: 2025-10-06
**目的**: DTO型を廃止し、Core型のみに統一することで、型システムを簡素化し、`reservation.user`活用による効率化を実現

---

## 概要

### 現状の問題

1. **型の複雑性**: Core型とDTO型の2つの型体系を維持
2. **ネスト構造**: `reservationDto.user.studentId` のような2階層アクセス
3. **重複ロジック**: ユーザー情報を別途取得する処理が散在
4. **型変換コスト**: DTO → Core への変換処理

### 目指す状態

1. **Core型のみ**: シンプルな1つの型体系
2. **フラット構造**: `reservation.studentId` の直接アクセス
3. **自動ユーザー情報**: `reservation.user` で詳細情報も利用可能
4. **コード削減**: 不要な型変換と重複ロジックの削除

---

## 改善パターン

### Before: DTO型 + 別途ユーザー取得

```javascript
/**
 * @param {ReservationCreateDto} reservationInfo
 */
function makeReservation(reservationInfo) {
  const { user, classroom, date, ... } = reservationInfo;

  // userはネストしたオブジェクト
  checkDuplicate(user.studentId, date);

  // ... 予約作成後 ...

  // ユーザー情報を再取得
  const userInfo = getCachedStudentInfo(user.studentId);
  sendEmail(userInfo.email, ...);
}
```

**問題点**:

- `user.studentId` のネストアクセス
- 不要な分解代入
- ユーザー情報の重複取得

### After: Core型のみ + reservation.user活用

```javascript
/**
 * @param {ReservationCore} reservationInfo - reservationId/statusはundefined可
 */
function makeReservation(reservationInfo) {
  // フラットな構造で直接アクセス
  checkDuplicate(reservationInfo.studentId, reservationInfo.date);

  // 完全なReservationCoreを構築
  const createdReservation = {
    ...reservationInfo,
    reservationId: generateNewReservationId(),
    status: determineStatus(...),
  };

  // シートに保存後、userが自動付与された状態で取得
  saveToSheet(createdReservation);
  const reservationWithUser = getReservationCoreById(createdReservation.reservationId);

  // reservation.userを直接利用（再取得不要）
  if (reservationWithUser.user?.wantsEmail) {
    sendEmail(reservationWithUser.user.email, ...);
  }
}
```

**改善点**:

- ✅ フラットなプロパティアクセス
- ✅ 分解代入の削減
- ✅ ユーザー情報の自動取得・活用

---

## 実装計画

### Phase 1: ReservationCore統一（優先度：高）

#### 対象ファイル

- `src/backend/05-2_Backend_Write.js` - 予約書き込み処理
- `src/backend/09_Backend_Endpoints.js` - APIエンドポイント
- `src/frontend/14_WebApp_Handlers_Reservation.js` - フロントエンド予約ハンドラ

#### 1.1 makeReservation() の改修

**変更内容**:

```javascript
// Before
/**
 * @param {ReservationCreateDto} reservationInfo
 */
function makeReservation(reservationInfo) {
  const { classroom, date, user, startTime, endTime, ... } = reservationInfo;

  checkDuplicateReservationOnSameDay(user.studentId, date);

  // ... シートに書き込み ...

  // ユーザー情報を別途取得
  const userInfo = getCachedStudentInfo(user.studentId);
  sendAdminNotification(...);
}

// After
/**
 * @param {ReservationCore} reservationInfo - reservationId/statusはundefined可
 */
function makeReservation(reservationInfo) {
  // フラットアクセス
  checkDuplicateReservationOnSameDay(reservationInfo.studentId, reservationInfo.date);

  // 完全なReservationCoreを構築
  const createdReservation = {
    ...reservationInfo,
    reservationId: Utilities.getUuid(),
    status: isFull ? CONSTANTS.STATUS.WAITLISTED : CONSTANTS.STATUS.CONFIRMED,
  };

  // ... シートに書き込み ...

  // userが自動付与された状態で取得
  const reservationWithUser = getReservationCoreById(createdReservation.reservationId);

  // reservation.userを活用
  sendAdminNotificationForReservation(reservationWithUser, 'created');

  if (reservationWithUser.user?.wantsEmail) {
    sendReservationEmailAsync(reservationWithUser, 'confirmation');
  }
}
```

**削減される処理**:

- `const { user, ... } = reservationInfo;` の分解代入
- `user.studentId` のネストアクセス
- `getCachedStudentInfo(user.studentId)` の重複取得

#### 1.2 cancelReservation() の改修

**変更内容**:

```javascript
// Before
/**
 * @param {ReservationCancelDto} cancelInfo
 */
function cancelReservation(cancelInfo) {
  const { reservationId, classroom, studentId, date, cancelMessage } = cancelInfo;

  // ... キャンセル処理 ...

  // ユーザー情報を別途取得
  const userInfo = getCachedStudentInfo(studentId);
  sendCancellationEmail(userInfo, ...);
}

// After
/**
 * @param {ReservationCore} cancelInfo - 最小限のフィールド（reservationId, cancelMessage）のみ必須
 */
function cancelReservation(cancelInfo) {
  // 予約IDから完全な予約情報を取得（user付き）
  const reservation = getReservationCoreById(cancelInfo.reservationId);

  if (!reservation) {
    throw new Error('予約が見つかりません');
  }

  // ... キャンセル処理 ...

  // reservation.userを活用
  sendAdminNotificationForReservation(reservation, 'cancelled', {
    cancelMessage: cancelInfo.cancelMessage,
  });

  if (reservation.user?.wantsEmail) {
    sendReservationEmailAsync(reservation, 'cancellation', cancelInfo.cancelMessage);
  }
}
```

**改善ポイント**:

- 引数を最小限に（`reservationId` と `cancelMessage` のみ）
- 予約情報の取得を1回に集約
- ユーザー情報の自動取得

#### 1.3 updateReservationDetails() の改修

**変更内容**:

```javascript
// Before
/**
 * @param {ReservationUpdateDto} details
 */
function updateReservationDetails(details) {
  const { reservationId, startTime, endTime, ... } = details;

  // ... 更新処理 ...
}

// After
/**
 * @param {ReservationCore} details - 更新するフィールドのみ設定
 */
function updateReservationDetails(details) {
  // 既存予約を取得
  const existingReservation = getReservationCoreById(details.reservationId);

  // 更新内容をマージ
  const updatedReservation = {
    ...existingReservation,
    ...details,
  };

  // ... 更新処理 ...
}
```

---

### Phase 2: UserCore統一（優先度：中）

#### 対象ファイル

- `src/backend/04_Backend_User.js` - ユーザー認証・管理

#### 2.1 registerNewUser() の改修

**変更内容**:

```javascript
// Before
/**
 * @param {UserRegistrationDto} userInfo
 */
function registerNewUser(userInfo) {
  const { phone, realName, nickname, email, wantsEmail } = userInfo;

  // studentIdとdisplayNameを生成
  const studentId = generateStudentId();
  const displayName = nickname || realName;

  // UserCoreを構築
  const newUser = {
    studentId,
    displayName,
    realName,
    phone,
    nickname,
    email,
    wantsEmail,
  };

  saveToSheet(newUser);
}

// After
/**
 * @param {UserCore} userInfo - studentId/displayNameはundefined可
 */
function registerNewUser(userInfo) {
  // 完全なUserCoreを構築
  const newUser = {
    ...userInfo,
    studentId: generateStudentId(),
    displayName: userInfo.nickname || userInfo.realName,
  };

  saveToSheet(newUser);
  return newUser;
}
```

---

### Phase 3: AccountingCore統一（優先度：中）

#### 対象ファイル

- `src/backend/05-2_Backend_Write.js` - 会計データ保存
- `src/frontend/12_WebApp_Core_Accounting.js` - 会計フォーム

#### 3.1 saveAccountingDetails() の改修

**変更内容**:

```javascript
// Before
/**
 * @param {AccountingSaveDto} payload
 */
function saveAccountingDetails(payload) {
  const { reservationId, items, paymentMethod, ... } = payload;

  // AccountingDetailsCoreを構築
  const accounting = {
    accountingId: generateAccountingId(),
    reservationId,
    items,
    paymentMethod,
    totalAmount: calculateTotal(items),
  };

  saveToSheet(accounting);
}

// After
/**
 * @param {AccountingDetailsCore} payload - accountingId/totalAmountはundefined可
 */
function saveAccountingDetails(payload) {
  // 完全なAccountingDetailsCoreを構築
  const accounting = {
    ...payload,
    accountingId: payload.accountingId || generateAccountingId(),
    totalAmount: payload.totalAmount || calculateTotal(payload.items),
  };

  saveToSheet(accounting);
  return accounting;
}
```

---

### Phase 4: フロントエンド修正（優先度：高）

#### 対象ファイル

- `src/frontend/14_WebApp_Handlers_Reservation.js`
- `src/frontend/12_WebApp_Core_Accounting.js`

#### 4.1 予約作成ハンドラの修正

**変更内容**:

```javascript
// Before
/**
 * @returns {ReservationCreateDto}
 */
function buildReservationDto() {
  return {
    classroom: selectedLesson.classroom,
    date: selectedLesson.date,
    user: {
      studentId: state.user.studentId,
      displayName: state.user.displayName,
      realName: state.user.realName,
    },
    startTime: selectedTime.start,
    endTime: selectedTime.end,
    // ...
  };
}

// After
/**
 * @returns {ReservationCore}
 */
function buildReservationData() {
  return {
    // reservationId, statusは未設定（バックエンドで生成）
    classroom: selectedLesson.classroom,
    date: selectedLesson.date,
    studentId: state.user.studentId,
    startTime: selectedTime.start,
    endTime: selectedTime.end,
    // ... その他のフィールド（フラット構造）
  };
}
```

**改善点**:

- `user` ネストの削除
- フラットな構造で直接設定

---

## 型定義の更新

### ReservationCore の明確化

```typescript
/**
 * 予約データの統一表現
 *
 * 新規作成時: reservationId/statusはundefinedでOK
 * 更新時: 変更するフィールドのみ設定
 * 取得時: すべてのフィールドが設定済み + userが自動付与
 */
interface ReservationCore {
  // システム生成フィールド（新規作成時はundefined）
  reservationId?: string;
  status?: string;

  // 基本フィールド（必須）
  studentId: string;
  date: string;
  classroom: string;

  // 時間フィールド（教室タイプによってオプショナル）
  startTime?: string;
  endTime?: string;

  // その他のフィールド
  venue?: string;
  chiselRental?: boolean;
  firstLecture?: boolean;
  workInProgress?: string;
  order?: string;
  messageToTeacher?: string;
  cancelMessage?: string;

  // ユーザー詳細情報（自動付与）
  user?: UserCore;
}
```

### UserCore の明確化

```typescript
/**
 * ユーザーデータの統一表現
 *
 * 新規登録時: studentId/displayNameはundefinedでOK
 * 更新時: 変更するフィールドのみ設定
 */
interface UserCore {
  // システム生成フィールド（新規登録時はundefined）
  studentId?: string;
  displayName?: string;

  // 基本フィールド（必須）
  realName: string;
  phone: string;

  // オプショナルフィールド
  nickname?: string;
  email?: string;
  wantsEmail?: boolean;
}
```

---

## 実装順序

### Week 1: Phase 1（ReservationCore統一）

1. **Day 1-2**: `makeReservation()` 改修
   - DTO型参照をCore型に変更
   - `reservation.user` 活用に切り替え
   - ユーザー情報取得の重複削除

2. **Day 3**: `cancelReservation()` 改修
   - 引数を最小限に
   - `reservation.user` 活用

3. **Day 4**: `updateReservationDetails()` 改修

4. **Day 5**: テスト・検証

### Week 2: Phase 2-3（User/Accounting統一）

5. **Day 1**: `registerNewUser()` 改修

6. **Day 2**: `saveAccountingDetails()` 改修

7. **Day 3-4**: テスト・検証

### Week 3: Phase 4（フロントエンド）

8. **Day 1-2**: 予約ハンドラ修正

9. **Day 3**: 会計フォーム修正

10. **Day 4-5**: 統合テスト

---

## 期待される効果

### コード品質

| 項目             | Before | After | 改善率 |
| ---------------- | ------ | ----- | ------ |
| 型定義ファイル   | 15個   | 5個   | 67%減  |
| 型変換処理       | 6箇所  | 0箇所 | 100%減 |
| ネストアクセス   | 多数   | なし  | 100%減 |
| ユーザー取得重複 | 8箇所  | 0箇所 | 100%減 |

### パフォーマンス

- ✅ **キャッシュアクセス削減**: ユーザー情報の重複取得をなくす
- ✅ **型変換コスト削減**: DTO → Core 変換処理が不要
- ✅ **コード実行速度向上**: 不要な分解代入・ネストアクセスの削減

### 保守性

- ✅ **型システムの簡素化**: 1つの型体系のみ
- ✅ **命名の一貫性**: すべてCore型で統一
- ✅ **コードの可読性**: フラットな構造で直感的

---

## リスクと対策

### リスク1: 既存コードとの互換性

**対策**: 段階的な移行（Phase単位で実施、各Phase完了時にテスト）

### リスク2: フロントエンドからの呼び出し変更

**対策**:

- フロントエンドの変更を最小限に
- バックエンドでの型変換を一時的に許容

### リスク3: user未設定のケース

**対策**:

- `getReservationCoreById()` で必ずuserを付与
- エラーハンドリングで適切にフォールバック

---

## 完了基準

- [ ] すべてのDTO型参照をCore型に置き換え
- [ ] `reservation.user` を活用したユーザー情報取得
- [ ] 型チェックエラーなし（`npm run check-types`）
- [ ] ビルド成功（`npm run dev:build`）
- [ ] テスト環境で動作確認
- [ ] ドキュメント更新（TYPES_GUIDE.md, TYPE_SYSTEM_REMAINING_TASKS.md）

---

**関連ドキュメント**:

- [RESERVATION_USER_REFACTORING_PLAN.md](RESERVATION_USER_REFACTORING_PLAN.md)
- [TYPES_GUIDE.md](TYPES_GUIDE.md)
- [TYPE_SYSTEM_REMAINING_TASKS.md](TYPE_SYSTEM_REMAINING_TASKS.md)
