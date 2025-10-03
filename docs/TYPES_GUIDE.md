# 型定義使用ガイド

**作成日**: 2025-10-03 **バージョン**: 1.0

---

## 📋 目次

1. [概要](#概要)
2. [型システムアーキテクチャ](#型システムアーキテクチャ)
3. [Core型の使い方](#core型の使い方)
4. [DTO型の使い方](#dto型の使い方)
5. [変換関数の使い方](#変換関数の使い方)
6. [ベストプラクティス](#ベストプラクティス)
7. [よくある間違い](#よくある間違い)

---

## 概要

本プロジェクトでは、予約・ユーザー・会計データの型定義を統一し、型安全性と保守性を向上させました。

### 型定義の配置

```
types/
├── core/                  # ドメインモデル（全フィールド）
│   ├── reservation-core.d.ts
│   ├── user-core.d.ts
│   ├── accounting-core.d.ts
│   └── index.d.ts
├── dto/                   # データ転送オブジェクト（操作別）
│   ├── reservation-dto.d.ts
│   ├── user-dto.d.ts
│   ├── accounting-dto.d.ts
│   └── index.d.ts
└── api-types.d.ts         # 旧型定義（@deprecated）
```

---

## 型システムアーキテクチャ

### 3層構造

```
┌─────────────────────────┐
│   生のシートデータ      │  Row配列（Google Sheets）
│   (string|number|Date)[] │
└─────────────────────────┘
           ↓
    convertRowTo*()
           ↓
┌─────────────────────────┐
│   Core型（ドメイン）    │  全フィールドを持つ統一型
│   ReservationCore       │  - 型安全
│   UserCore              │  - バリデーション済み
│   AccountingDetailsCore │  - 正規化済み
└─────────────────────────┘
           ↓
    必要な部分のみ抽出
           ↓
┌─────────────────────────┐
│   DTO型（操作別）       │  操作に最適化された型
│   ReservationCreateDto  │  - 必要最小限のフィールド
│   UserRegistrationDto   │  - 操作の意図が明確
│   AccountingFormDto     │  - パフォーマンス向上
└─────────────────────────┘
```

### 設計原則

1. **Core型**: データの真実の源（Single Source of Truth）
2. **DTO型**: 操作ごとに最適化
3. **変換関数**: レイヤー間の橋渡し

---

## Core型の使い方

### ReservationCore

**用途**: 予約データの統一表現

```javascript
/// <reference path="../types/core/reservation-core.d.ts" />

/**
 * @param {ReservationCore} reservation
 */
function processReservation(reservation) {
  // 全フィールドに型安全にアクセス可能
  console.log(reservation.reservationId);
  console.log(reservation.studentId);
  console.log(reservation.date);

  // オプショナルフィールドはundefinedチェック
  if (reservation.venue) {
    console.log(reservation.venue);
  }
}
```

### UserCore

**用途**: ユーザーデータの統一表現

```javascript
/// <reference path="../types/core/user-core.d.ts" />

/**
 * @param {UserCore} user
 */
function sendNotification(user) {
  // 必須フィールド
  const displayName = user.displayName;

  // オプショナルフィールド
  if (user.wantsEmail && user.email) {
    // メール送信処理
  }
}
```

---

## DTO型の使い方

### 予約作成（ReservationCreateDto）

```javascript
/// <reference path="../types/dto/reservation-dto.d.ts" />

/**
 * 新規予約を作成
 * @param {ReservationCreateDto} reservationInfo
 */
function makeReservation(reservationInfo) {
  // reservationId, statusは不要（システムが自動生成）
  const { classroom, date, user, startTime, endTime } = reservationInfo;

  // 処理...
}

// 使用例
makeReservation({
  classroom: '東京教室',
  date: '2025-10-10',
  user: {
    studentId: 'S-001',
    displayName: '太郎',
    realName: '山田太郎'
  },
  startTime: '10:00',
  endTime: '12:00',
  chiselRental: true,
  firstLecture: false
});
```

### 予約キャンセル（ReservationCancelDto）

```javascript
/// <reference path="../types/dto/reservation-dto.d.ts" />

/**
 * 予約をキャンセル
 * @param {ReservationCancelDto} cancelInfo
 */
function cancelReservation(cancelInfo) {
  // 最小限の情報のみ（5フィールド）
  const { reservationId, classroom, studentId, date, cancelMessage } = cancelInfo;

  // キャンセル処理...
}
```

### ユーザー登録（UserRegistrationDto）

```javascript
/// <reference path="../types/dto/user-dto.d.ts" />

/**
 * 新規ユーザー登録
 * @param {UserRegistrationDto} userInfo
 */
function registerNewUser(userInfo) {
  // studentId, displayNameは不要（システムが生成）
  const { phone, realName, nickname } = userInfo;

  // 登録処理...
}
```

---

## 変換関数の使い方

### シートデータ → Core型

```javascript
/// <reference path="../types/core/reservation-core.d.ts" />

/**
 * Google Sheetsの行データをReservationCoreに変換
 */
const headerMap = getHeaderMap(sheet);
const rows = sheet.getDataRange().getValues();

/** @type {ReservationCore[]} */
const reservations = rows.slice(1).map(row =>
  convertRowToReservation(row, headerMap)
);
```

### Core型 → シートデータ

```javascript
/// <reference path="../types/core/reservation-core.d.ts" />

/**
 * ReservationCoreをSheets書き込み用配列に変換
 * @param {ReservationCore} reservation
 */
function saveReservation(reservation) {
  const headerMap = getHeaderMap(sheet);
  const row = convertReservationToRow(reservation, headerMap);

  sheet.appendRow(row);
}
```

---

## ベストプラクティス

### 1. 適切な型を選択する

```javascript
// ❌ 悪い例：全部Core型を使う
function createReservation(reservation) {
  // reservationIdやstatusは不要なのに受け取っている
}

// ✅ 良い例：操作に適したDTO型を使う
/**
 * @param {ReservationCreateDto} reservationInfo
 */
function createReservation(reservationInfo) {
  // 必要なフィールドだけ受け取る
}
```

### 2. 型アノテーションを必ず書く

```javascript
// ❌ 悪い例：型アノテーションなし
function processUser(user) {
  // userの型が不明
}

// ✅ 良い例：明示的な型アノテーション
/**
 * @param {UserCore} user
 */
function processUser(user) {
  // IDE補完が効く、型チェックが機能する
}
```

### 3. オプショナルフィールドのチェック

```javascript
// ❌ 悪い例：undefinedチェックなし
function getVenue(reservation) {
  return reservation.venue.toUpperCase(); // venueがundefinedだとエラー
}

// ✅ 良い例：undefinedチェック
function getVenue(reservation) {
  return reservation.venue ? reservation.venue.toUpperCase() : '未設定';
}
```

### 4. 型キャストは慎重に

```javascript
// ❌ 悪い例：直接キャスト
const reservation = /** @type {ReservationCore} */ (data);

// ✅ 良い例：変換関数を使う
const reservation = convertRowToReservation(row, headerMap);
```

---

## よくある間違い

### 間違い1: Core型とDTO型の混同

```javascript
// ❌ 間違い：予約作成にCore型を使う
/**
 * @param {ReservationCore} reservation
 */
function makeReservation(reservation) {
  // reservationIdは新規作成時に不要なのに受け取っている
}

// ✅ 正しい：ReservationCreateDtoを使う
/**
 * @param {ReservationCreateDto} reservationInfo
 */
function makeReservation(reservationInfo) {
  // 新規作成に必要なフィールドだけ
}
```

### 間違い2: 旧型定義の使用

```javascript
// ❌ 間違い：@deprecatedな旧型を使う
/**
 * @param {ReservationInfo} info  // deprecated
 */
function oldFunction(info) { }

// ✅ 正しい：新しい型を使う
/**
 * @param {ReservationCore} reservation
 */
function newFunction(reservation) { }
```

### 間違い3: Object型の使用

```javascript
// ❌ 間違い：汎用Object型
/**
 * @param {Object} data
 */
function processData(data) {
  // プロパティアクセスで型エラー
}

// ✅ 正しい：具体的な型
/**
 * @param {UserCore} user
 */
function processData(user) {
  // 型安全にアクセス可能
}
```

---

## クイックリファレンス

### よく使う型

| 操作 | 使用する型 | ファイル |
|:---|:---|:---|
| 予約新規作成 | `ReservationCreateDto` | types/dto/reservation-dto.d.ts |
| 予約更新 | `ReservationUpdateDto` | types/dto/reservation-dto.d.ts |
| 予約キャンセル | `ReservationCancelDto` | types/dto/reservation-dto.d.ts |
| 予約データ処理 | `ReservationCore` | types/core/reservation-core.d.ts |
| ユーザー登録 | `UserRegistrationDto` | types/dto/user-dto.d.ts |
| プロフィール更新 | `UserUpdateDto` | types/dto/user-dto.d.ts |
| ユーザー情報処理 | `UserCore` | types/core/user-core.d.ts |
| 会計入力 | `AccountingFormDto` | types/dto/accounting-dto.d.ts |
| 会計保存 | `AccountingSaveDto` | types/dto/accounting-dto.d.ts |

### よく使う変換関数

| 関数名 | 変換 | 定義場所 |
|:---|:---|:---|
| `convertRowToReservation()` | Row → ReservationCore | 08_Utilities.js |
| `convertReservationToRow()` | ReservationCore → Row | 08_Utilities.js |
| `convertRowToUser()` | Row → UserCore | 08_Utilities.js |
| `convertUserToRow()` | UserCore → Row | 08_Utilities.js |

---

## 関連ドキュメント

- [TYPE_SYSTEM_UNIFICATION.md](TYPE_SYSTEM_UNIFICATION.md) - 型システム統一の詳細設計
- [DATA_MODEL.md](DATA_MODEL.md) - データモデル全体の設計
- [CLAUDE.md](../CLAUDE.md) - プロジェクト全体のガイド

---

**最終更新**: 2025-10-03
