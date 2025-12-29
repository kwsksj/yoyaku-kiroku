# 型定義使用ガイド

**作成日**: 2025-10-03 **最終更新**: 2025-10-06 **バージョン**: 2.0

---

## 📋 目次

1. [概要](#概要)
2. [型システムアーキテクチャ](#型システムアーキテクチャ)
3. [Core型の使い方](#core型の使い方)
4. [変換関数の使い方](#変換関数の使い方)
5. [ベストプラクティス](#ベストプラクティス)
6. [よくある間違い](#よくある間違い)
7. [クイックリファレンス](#クイックリファレンス)

---

## 概要

本プロジェクトでは、予約・ユーザー・レッスン・会計データの型定義を **Core型のみに統一** し、型安全性と保守性を向上させました。

### v2.0での変更点（2025-10-06）

**DTO型を廃止し、Core型に統一**しました。理由：

- DTO型とCore型の2つの型体系を維持するコストが高い
- 実際の運用ではCore型が主に使用されている
- Google Apps Scriptの関数ベースアーキテクチャとの相性を重視
- オプショナルフィールドを活用することでCore型のみで十分対応可能

### 型定義の配置

```
types/
├── core/                  # ドメインモデル（全フィールド）
│   ├── reservation.d.ts   # ReservationCore
│   ├── user.d.ts          # UserCore
│   ├── lesson.d.ts        # LessonCore
│   ├── accounting.d.ts    # AccountingDetailsCore
│   └── index.d.ts         # 統合インデックス
├── view/                  # フロントエンド専用型
│   └── state.d.ts         # StateManager関連
└── api-types.d.ts         # 旧型定義（@deprecated、段階的に削除予定）
```

---

## 型システムアーキテクチャ

### シンプルな2層構造

```
┌─────────────────────────┐
│   生のシートデータ      │  Row配列（Google Sheets）
│   (string|number|Date)[] │
└─────────────────────────┘
           ↓
    convertRawTo*Core()
           ↓
┌─────────────────────────┐
│   Core型（ドメイン）    │  統一されたドメインモデル
│   ReservationCore       │  - 型安全
│   UserCore              │  - バリデーション済み
│   LessonCore            │  - 正規化済み
│   AccountingDetailsCore │  - オプショナルフィールド活用
└─────────────────────────┘
```

### 設計原則

1. **Core型のみ**: データの真実の源（Single Source of Truth）
2. **オプショナルフィールド**: 必須・任意を明確に区別
3. **変換関数**: シートデータ ↔ Core型の橋渡し
4. **型安全性**: すべての関数で明示的な型アノテーション

---

## 型定義生成システム

このプロジェクトでは、JSDocからTypeScriptの型定義ファイル（`.d.ts`）を自動生成する仕組みを採用している。

### 生成フロー

1. **TypeScriptコンパイラによる型定義抽出** (`tsc --declaration`)
   - `src/backend/`、`src/frontend/`、`src/shared/` の全JSファイルからJSDocを解析
   - TypeScriptの宣言ファイル生成機能を使用して `.d.ts` ファイルを作成
   - `types/generated-*-globals/` ディレクトリに環境別の型定義を生成

2. **環境別インデックス統合** (`tools/create-dts-index.js`)
   - 各 `generated-*-globals/` 内の型定義を統合
   - 各ディレクトリに `index.d.ts` を生成し、すべての型をまとめてexport

3. **グローバル型ブリッジ生成** (`tools/create-global-bridge.js`)
   - export宣言をグローバル宣言（`declare global`）に変換
   - 各ディレクトリに `_globals.d.ts` を生成
   - namespace内のfunction定義も正しく処理（例: `PerformanceLog.start()`）
   - GAS環境ではモジュールシステム（import/export）が使えないため、すべての型をグローバルスコープで利用可能にする

### ディレクトリ構造

```text
types/
├── generated-backend-globals/    # 自動生成（編集禁止）
│   ├── *.d.ts                    # JSDocから生成された型定義
│   ├── index.d.ts                # 統合インデックス（自動生成）
│   └── _globals.d.ts             # グローバル型ブリッジ（自動生成）
├── generated-frontend-globals/   # 自動生成（編集禁止）
├── generated-shared-globals/     # 自動生成（編集禁止）
├── global-aliases.d.ts           # 手動管理型エイリアス（編集可能）
├── backend-index.d.ts            # 手動管理エントリーポイント（編集可能）
├── frontend-index.d.ts           # 手動管理エントリーポイント（編集可能）
├── core/                         # 手動管理型定義（編集可能）
├── view/                         # 手動管理型定義（編集可能）
└── gas-custom.d.ts               # 手動管理型定義（編集可能）
```

### 重要な注意事項

- `types/generated-*-globals/` 内のファイルは自動生成されるため、直接編集しないこと
- その他の型定義ファイル（`global-aliases.d.ts`, `*-index.d.ts`, `core/`, `view/`, `gas-custom.d.ts`）は手動管理のため、必要に応じて編集可能

---

## Core型の使い方

### ReservationCore

**用途**: 予約データの統一表現

```javascript
/// <reference path="../types/core/reservation.d.ts" />

/**
 * 予約データを処理
 * @param {ReservationCore} reservation
 */
function processReservation(reservation) {
  // 必須フィールドに型安全にアクセス
  console.log(reservation.reservationId);
  console.log(reservation.studentId);
  console.log(reservation.date);
  console.log(reservation.classroom);

  // オプショナルフィールドはundefinedチェック
  if (reservation.venue) {
    console.log(`会場: ${reservation.venue}`);
  }

  if (reservation.messageToTeacher) {
    console.log(`メッセージ: ${reservation.messageToTeacher}`);
  }
}

/**
 * 新規予約を作成（reservationIdとstatusは関数内で生成）
 * @param {ReservationCore} reservationInfo
 */
function makeReservation(reservationInfo) {
  // reservationIdとstatusはundefinedでOK（関数内で生成）
  const reservationId = generateNewReservationId();
  const status = checkCapacityFull(...)
    ? CONSTANTS.STATUS.WAITLISTED
    : CONSTANTS.STATUS.CONFIRMED;

  // 完全なReservationCoreオブジェクトを構築
  /** @type {ReservationCore} */
  const completeReservation = {
    ...reservationInfo,
    reservationId,
    status,
  };

  // シートに書き込み
  saveToSheet(completeReservation);
}
```

### UserCore

**用途**: ユーザーデータの統一表現

```javascript
/// <reference path="../types/core/user.d.ts" />

/**
 * ユーザーに通知を送信
 * @param {UserCore} user
 */
function sendNotification(user) {
  // 必須フィールド
  const displayName = user.displayName;
  const realName = user.realName;

  // オプショナルフィールド
  if (user.wantsEmail && user.email) {
    sendEmail(user.email, `${realName}様へのお知らせ`);
  }
}

/**
 * 新規ユーザー登録（studentIdとdisplayNameは関数内で生成）
 * @param {UserCore} userInfo
 */
function registerNewUser(userInfo) {
  // studentIdとdisplayNameはundefinedでOK（関数内で生成）
  const studentId = generateStudentId();
  const displayName = userInfo.nickname || userInfo.realName;

  /** @type {UserCore} */
  const completeUser = {
    ...userInfo,
    studentId,
    displayName,
  };

  saveToSheet(completeUser);
}
```

### LessonCore

**用途**: レッスン（日程）データの統一表現

```javascript
/// <reference path="../types/core/lesson.d.ts" />

/**
 * レッスンの空き状況を表示
 * @param {LessonCore} lesson
 */
function displayLessonAvailability(lesson) {
  console.log(`${lesson.date} ${lesson.classroom}`);

  // 教室タイプに応じた空き枠表示
  if (lesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
    console.log(`午前: ${lesson.firstSlots}席, 午後: ${lesson.secondSlots}席`);
  } else {
    console.log(`空き: ${lesson.firstSlots}席`);
  }

  // オプショナルフィールド
  if (lesson.venue) {
    console.log(`会場: ${lesson.venue}`);
  }

  if (lesson.beginnerSlots !== undefined && lesson.beginnerSlots !== null) {
    console.log(`初回者枠: ${lesson.beginnerSlots}席`);
  }
}
```

### AccountingDetailsCore

**用途**: 会計データの統一表現

```javascript
/// <reference path="../types/core/accounting.d.ts" />

/**
 * 会計情報を保存
 * @param {AccountingDetailsCore} accounting
 */
function saveAccountingDetails(accounting) {
  // 必須フィールド
  console.log(accounting.reservationId);
  console.log(accounting.accountingId);
  console.log(accounting.totalAmount);

  // オプショナルフィールド
  if (accounting.notes) {
    console.log(`備考: ${accounting.notes}`);
  }
}
```

---

## 変換関数の使い方

### シートデータ → Core型

```javascript
/// <reference path="../types/core/reservation.d.ts" />

/**
 * Google Sheetsの行データをReservationCoreに変換
 */
function loadReservations() {
  const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS);
  const data = getSheetData(sheet);

  /** @type {ReservationCore[]} */
  const reservations = data.rows.map(row => convertRawToReservationCore(row, data.headerMap));

  return reservations;
}
```

### Core型 → シートデータ

```javascript
/// <reference path="../types/core/reservation.d.ts" />

/**
 * ReservationCoreをSheets書き込み用配列に変換
 * @param {ReservationCore} reservation
 */
function saveReservation(reservation) {
  const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.INTEGRATED_RESERVATIONS);
  const headerMap = getHeaderMap(sheet);

  // Core型 → Row配列に変換
  const row = convertReservationCoreToRow(reservation, headerMap);

  sheet.appendRow(row);
}
```

### キャッシュデータ → Core型

```javascript
/// <reference path="../types/core/reservation.d.ts" />

/**
 * キャッシュから予約データを取得
 * @returns {ReservationCore[]}
 */
function getCachedReservations() {
  const cache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);

  if (!cache || !cache.reservations) {
    return [];
  }

  /** @type {ReservationCore[]} */
  const reservations = convertReservationsToObjects(cache.reservations, cache.headerMap);

  return reservations;
}
```

---

## ベストプラクティス

### 1. 型アノテーションを必ず書く

```javascript
// ❌ 悪い例：型アノテーションなし
function processUser(user) {
  // userの型が不明
  console.log(user.displayName); // エラーチェックなし
}

// ✅ 良い例：明示的な型アノテーション
/**
 * @param {UserCore} user
 */
function processUser(user) {
  // IDE補完が効く、型チェックが機能する
  console.log(user.displayName);
}
```

### 2. オプショナルフィールドのチェック

```javascript
// ❌ 悪い例：undefinedチェックなし
/**
 * @param {ReservationCore} reservation
 */
function getVenue(reservation) {
  return reservation.venue.toUpperCase(); // venueがundefinedだとエラー
}

// ✅ 良い例：undefinedチェック
/**
 * @param {ReservationCore} reservation
 */
function getVenue(reservation) {
  return reservation.venue ? reservation.venue.toUpperCase() : '未設定';
}
```

### 3. 新規作成時はオプショナルフィールドを活用

```javascript
// ✅ 良い例：新規予約作成
/**
 * @param {ReservationCore} reservationInfo - reservationIdとstatusはundefinedでOK
 */
function makeReservation(reservationInfo) {
  // システムが生成するフィールドを追加
  const reservationId = generateNewReservationId();
  const status = determineStatus(...);

  /** @type {ReservationCore} */
  const completeReservation = {
    ...reservationInfo,
    reservationId,
    status,
  };

  saveToSheet(completeReservation);
  return completeReservation;
}

// 呼び出し側
makeReservation({
  // reservationIdとstatusは省略（undefinedでOK）
  studentId: 'S-001',
  date: '2025-10-10',
  classroom: '東京教室',
  startTime: '10:00',
  endTime: '12:00',
  // ...その他の必須フィールド
});
```

### 4. 型キャストは変換関数を使う

```javascript
// ❌ 悪い例：直接キャスト
const reservation = /** @type {ReservationCore} */ (data);

// ✅ 良い例：変換関数を使う
const reservation = convertRawToReservationCore(row, headerMap);
```

### 5. 配列の型を明示する

```javascript
// ❌ 悪い例：配列の型が不明
function processReservations(reservations) {
  // reservationsの要素型が不明
}

// ✅ 良い例：配列要素の型を明示
/**
 * @param {ReservationCore[]} reservations
 */
function processReservations(reservations) {
  reservations.forEach(reservation => {
    // reservationの型が明確
  });
}
```

---

## よくある間違い

### 間違い1: オプショナルフィールドのチェック忘れ

```javascript
// ❌ 間違い
/**
 * @param {LessonCore} lesson
 */
function getBeginnerSlots(lesson) {
  return lesson.beginnerSlots + 1; // beginnerSlotsがundefinedの場合エラー
}

// ✅ 正しい
/**
 * @param {LessonCore} lesson
 */
function getBeginnerSlots(lesson) {
  return (lesson.beginnerSlots ?? 0) + 1;
}
```

### 間違い2: 旧型定義の使用

```javascript
// ❌ 間違い：@deprecatedな旧型を使う
/**
 * @param {ReservationInfo} info  // deprecated
 */
function oldFunction(info) {}

// ✅ 正しい：新しいCore型を使う
/**
 * @param {ReservationCore} reservation
 */
function newFunction(reservation) {}
```

### 間違い3: Object型や any の使用

```javascript
// ❌ 間違い：汎用Object型
/**
 * @param {Object} data
 */
function processData(data) {
  // プロパティアクセスで型エラー
}

// ❌ 間違い：any型
/**
 * @param {any} data
 */
function processData(data) {
  // 型チェックが無効化される
}

// ✅ 正しい：具体的なCore型
/**
 * @param {UserCore} user
 */
function processData(user) {
  // 型安全にアクセス可能
}
```

### 間違い4: 拡張構造の使用（廃止済み）

```javascript
// ❌ 間違い：廃止されたSessionCore拡張構造
/**
 * @param {{schedule: ScheduleMasterData, status: AvailableSlots}} session
 */
function processSession(session) {
  console.log(session.schedule.classroom); // 複雑な階層
  console.log(session.status.firstSlots);
}

// ✅ 正しい：フラットなLessonCore
/**
 * @param {LessonCore} lesson
 */
function processLesson(lesson) {
  console.log(lesson.classroom); // シンプル
  console.log(lesson.firstSlots);
}
```

---

## クイックリファレンス

### Core型一覧

| 型名                    | 用途                     | ファイル                    |
| :---------------------- | :----------------------- | :-------------------------- |
| `ReservationCore`       | 予約データの統一表現     | types/core/reservation.d.ts |
| `UserCore`              | ユーザーデータの統一表現 | types/core/user.d.ts        |
| `LessonCore`            | レッスンデータの統一表現 | types/core/lesson.d.ts      |
| `AccountingDetailsCore` | 会計データの統一表現     | types/core/accounting.d.ts  |

### よく使う変換関数

| 関数名                           | 変換                           | 定義場所        |
| :------------------------------- | :----------------------------- | :-------------- |
| `convertRawToReservationCore()`  | Row → ReservationCore          | 08_Utilities.js |
| `convertReservationCoreToRow()`  | ReservationCore → Row          | 08_Utilities.js |
| `convertRawToUserCore()`         | Row → UserCore                 | 08_Utilities.js |
| `convertUserCoreToRow()`         | UserCore → Row                 | 08_Utilities.js |
| `convertReservationsToObjects()` | キャッシュ → ReservationCore[] | 08_Utilities.js |

### オプショナルフィールドの安全な扱い方

```javascript
// nullish coalescing演算子（??）を活用
const slots = lesson.beginnerSlots ?? 0;

// 条件演算子を活用
const venue = reservation.venue ? reservation.venue : '未設定';

// Optional chaining（?.）を活用
const email = user.email?.toLowerCase();
```

## 定数の使い方

### 2段階定数構造

バックエンドとフロントエンド間の定数不整合を防ぐため、2段階定数構造を採用している。

```javascript
// 1段階目: 個別定数オブジェクト
const STATUS = {
  CONFIRMED: '確定',
  CANCELED: '取消',
  WAITLISTED: '待機',
  COMPLETED: '完了',
};

// 2段階目: CONSTANTS統合オブジェクト
const CONSTANTS = {
  STATUS: STATUS,
  CLASSROOMS: CLASSROOMS,
  // ... 他の定数群
};
```

### 使用パターン

```javascript
// ✅ 推奨：完全参照（AI理解性・一貫性）
if (status === CONSTANTS.STATUS.CONFIRMED) { ... }

// ✅ 許容：短縮参照（タイピング効率重視時）
if (status === STATUS.CONFIRMED) { ... }

// 両方とも型エラー検出される
STATUS.CONFIMED;               // ❌ タイポ検出（CONFIRMED のスペルミス）
CONSTANTS.STATUS.INVALID;      // ❌ 存在しないプロパティ
```

### 定数追加・変更時

1. `src/shared/00_Constants.js` を編集
2. `npm run types:refresh` で型定義を再生成
3. `npm run validate` で整合性を確認

---

## 型生成ワークフロー

### コマンド一覧

| コマンド                | 説明                       |
| ----------------------- | -------------------------- |
| `npm run types:refresh` | 型定義の完全再生成（推奨） |
| `npm run types:check`   | 型チェックのみ実行         |

### 新しい定数やクラスを追加する方法

1. ソースファイルに export を追加

   ```javascript
   // src/backend/新しいファイル.js
   export const MY_NEW_CONSTANT = { ... };
   export class MyNewClass { ... }
   ```

2. 型定義を再生成

   ```bash
   npm run types:refresh
   ```

   これだけで以下が自動的に行われる：

   - `types/generated-backend-globals/新しいファイル.d.ts` が生成される
   - `types/generated-backend-globals/index.d.ts` に参照が追加される
   - グローバル型ブリッジに `declare global` が追加される


### トラブルシューティング

```bash
# 型定義が更新されない場合
npm run clean:types && npm run types:refresh

# ビルドエラー: "export is not defined"
# → ビルドプロセスで export は自動削除される。build-output/ を確認
grep "^export" build-output/*.js
```

---

## 関連ドキュメント

- [DATA_MODEL.md](DATA_MODEL.md) - データモデル全体の設計
- [AI_INSTRUCTIONS.md](../AI_INSTRUCTIONS.md) - 開発ルール・ワークフロー

---

**最終更新**: 2025-12-29 **バージョン**: 2.1 - CONSTANTS_GUIDE.md と type-generation-workflow.md を統合
