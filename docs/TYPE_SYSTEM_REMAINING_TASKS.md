# 型システム統一 - 残課題（改訂版）

## Phase 4-5 完了内容

### ✅ 実施済み

1. **エイリアス型の削除**
   - `types/core/session.d.ts`: `LessonData`, `Lesson` → 削除
   - `types/dto/accounting.d.ts`: `AccountingCalculationResultDto`, `AccountingMasterItemDto`, `ClassifiedAccountingItemsDto` → 削除
   - `types/dto/user.d.ts`: `UserProfileDto` → 削除、`UserUpdateDto`をinterface化
   - `types/dto/reservation.d.ts`: `ReservationDetailDto` → 削除

2. **不要ファイルの削除確認**
   - `html-environment.d.ts` ✓（Phase 1-3で削除済み）
   - `dev-environment.d.ts` ✓（Phase 1-3で削除済み）

3. **types/index.d.tsの簡素化**
   - 統一型システムへの参照のみに整理済み

### ⚠️ 判明した設計上の問題

#### 1. 不必要な型階層の複雑さ

**問題**: Core/DTO/Viewの3層構造が、このプロジェクトの規模に対して過剰

**データ規模の現実**:

- 日程データ: ~50件/月
- 予約データ: ~200件/月
- 生徒データ: ~100件
- 合計データサイズ: ~300KB（GAS上限100MBの0.3%）

**結論**: DTO層は不要。Core型で統一すべき

#### 2. Session vs Lesson の命名不整合

**問題**: バックエンドだけ`Session`、フロントエンドは`lessons`

```javascript
// フロントエンド（一貫してlesson）
state.lessons;
selectedLesson;
renderBookingLessons();

// バックエンド（Sessionに変更してしまった）
SessionCore; // ← 浮いている
getLessons(); // ← 関数名はlesson
```

**影響**: コードの可読性低下、認知負荷増大

#### 3. 空き枠プロパティ名の不統一

**問題**: スプレッドシートの列名と型定義が乖離

```typescript
// 現状（不明確）
morningSlots; // 午前？1部？
afternoonSlots; // 午後？2部？
firstLectureSlots; // 初回？
availableSlots; // どの枠？
isFull; // 冗長（計算可能）
```

**スプレッドシートの実際の列名**:

- "1部開始", "1部終了"
- "2部開始", "2部終了"
- "初回枠開始"
- "総定員", "初回枠定員"

## 🔧 Phase 6（簡略版）: Core型への統合と命名統一

### 目的

1. DTO層を廃止し、Core型に統合
2. Session → Lesson に統一
3. スプレッドシート準拠の命名に統一

### 作業内容

#### 6-1. 型定義の統一

**ファイル名変更**:

```bash
types/core/session.d.ts → types/core/lesson.d.ts
```

**型名変更**:

```typescript
// types/core/lesson.d.ts

/**
 * レッスン情報（日程マスタの1行）
 *
 * 1日の教室開催情報を表現
 * スプレッドシート「日程マスタ」の列名に準拠
 */
interface LessonCore {
  // --- 基本情報 ---
  /** 教室名 */
  classroom: string;

  /** 開催日（YYYY-MM-DD） */
  date: string;

  /** 会場名 */
  venue?: string;

  /** 教室形式（'セッション制' | '時間制・2部制' | '時間制・全日'） */
  classroomType?: string;

  /** 備考 */
  notes?: string;

  /**
   * ステータス
   * @see CONSTANTS.SCHEDULE_STATUS
   * - '開催予定': 予約可能
   * - '休講': 予約不可
   * - '開催済み': 過去の日程
   */
  status?: string;

  // --- 時間情報 ---
  /** 1部開始時刻（HH:mm） */
  firstStart?: string;

  /** 1部終了時刻（HH:mm） */
  firstEnd?: string;

  /** 2部開始時刻（HH:mm） */
  secondStart?: string;

  /** 2部終了時刻（HH:mm） */
  secondEnd?: string;

  /** 初回枠開始時刻（HH:mm） */
  beginnerStart?: string;

  /** 全日開始時刻（HH:mm）- セッション制・時間制全日用 */
  startTime?: string;

  /** 全日終了時刻（HH:mm）- セッション制・時間制全日用 */
  endTime?: string;

  // --- 定員情報 ---
  /** 総定員 */
  totalCapacity?: number;

  /** 初回枠定員 */
  beginnerCapacity?: number;

  // --- 空き枠情報（計算結果） ---
  /** 1部空き枠数 */
  firstSlots?: number;

  /** 2部空き枠数（2部制の場合のみ） */
  secondSlots?: number;

  /**
   * 初回枠の空き数
   * - null: 経験者限定（初回枠なし）
   * - 0: 初回枠満席
   * - 1以上: 初回枠あり
   */
  beginnerSlots?: number | null;

  /** 行インデックス（シート行番号） */
  rowIndex?: number;
}
```

**削除する型**:

- `SessionCore` → `LessonCore`に統合
- `SessionWithStatus` → 不要（拡張構造を廃止）
- `AvailableSlotsDto` → 不要（DTO層廃止）

#### 6-2. バックエンド実装の修正

**05-3_Backend_AvailableSlots.js**:

```javascript
/**
 * 開催予定のレッスン情報（空き枠情報を含む）を計算して返す
 * @returns {ApiResponse<LessonCore[]>}
 */
function getLessons() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // スケジュールマスタデータ取得
    const scheduledDates = getScheduleMasterData();

    // 予約データ取得
    const reservationsCache = getCachedData(CACHE_KEYS.ALL_RESERVATIONS);
    const allReservations = reservationsCache?.reservations || [];
    const headerMap = reservationsCache?.headerMap || {};

    const convertedReservations = convertReservationsToObjects(allReservations, headerMap);

    // 日付・教室ごとに予約を分類
    const reservationsByDateClassroom = new Map();
    convertedReservations.forEach(reservation => {
      const dateString = Utilities.formatDate(new Date(reservation.date), CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
      const key = `${dateString}|${reservation.classroom}`;
      if (!reservationsByDateClassroom.has(key)) {
        reservationsByDateClassroom.set(key, []);
      }
      reservationsByDateClassroom.get(key)?.push(reservation);
    });

    /** @type {LessonCore[]} */
    const lessons = [];

    // 未来の日程のみに絞り込み（空き枠計算前）
    const futureSchedules = scheduledDates.filter(schedule => {
      const scheduleDate = schedule.date instanceof Date ? schedule.date : new Date(schedule.date);
      return scheduleDate >= today;
    });

    futureSchedules.forEach(schedule => {
      const dateKey = Utilities.formatDate(schedule.date, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');
      const key = `${dateKey}|${schedule.classroom}`;
      const reservationsForDate = reservationsByDateClassroom.get(key) || [];

      // 空き枠計算
      const availableSlots = calculateAvailableSlots(schedule, reservationsForDate);

      // LessonCore形式で追加
      lessons.push({
        classroom: schedule.classroom,
        date: dateKey,
        venue: schedule.venue,
        classroomType: schedule.classroomType,
        firstStart: schedule.firstStart,
        firstEnd: schedule.firstEnd,
        secondStart: schedule.secondStart,
        secondEnd: schedule.secondEnd,
        beginnerStart: schedule.beginnerStart,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        totalCapacity: schedule.totalCapacity,
        beginnerCapacity: schedule.beginnerCapacity,
        // 空き枠情報を追加
        firstSlots: availableSlots.first,
        secondSlots: availableSlots.second,
        beginnerSlots: availableSlots.beginner,
      });
    });

    return createApiResponse(true, { data: lessons });
  } catch (error) {
    Logger.log(`getLessons エラー: ${error.message}\n${error.stack}`);
    return BackendErrorHandler.handle(error, 'getLessons', { data: [] });
  }
}

/**
 * 空き枠を計算
 * @param {ScheduleMasterData} schedule
 * @param {ReservationCore[]} reservations
 * @returns {{first: number, second: number|undefined, beginner: number|null}}
 */
function calculateAvailableSlots(schedule, reservations) {
  const result = {
    first: 0,
    second: undefined,
    beginner: null,
  };

  // 教室タイプ別の計算ロジック
  if (schedule.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
    // 2部制の場合
    const morningReservations = reservations.filter(r => isInTimeSlot(r, schedule.firstStart, schedule.firstEnd));
    const afternoonReservations = reservations.filter(r => isInTimeSlot(r, schedule.secondStart, schedule.secondEnd));

    result.first = (schedule.totalCapacity || 0) - morningReservations.length;
    result.second = (schedule.totalCapacity || 0) - afternoonReservations.length;

    // 初回枠計算
    if (schedule.beginnerCapacity) {
      const beginnerCount = afternoonReservations.filter(r => r.firstLecture).length;
      result.beginner = Math.max(0, schedule.beginnerCapacity - beginnerCount);
    }
  } else {
    // 全日制・セッション制
    result.first = (schedule.totalCapacity || 0) - reservations.length;
  }

  return result;
}
```

**変更点**:

- `SessionCore[]` → `LessonCore[]`
- 拡張構造（`{schedule, status}`）を廃止
- 空き枠情報を直接プロパティとして追加
- `isFull`削除（フロントエンドで判定）

#### 6-3. フロントエンドの修正

**状態管理（12_WebApp_StateManager.js）**:

```javascript
// 既に lessons として定義済み → 型だけ明記
interface UIState {
  lessons: LessonCore[];  // 型名だけ変更
  // ...
}
```

**表示判定**:

```javascript
// isFull判定（各箇所で）
function isLessonFull(lesson) {
  if (lesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
    return (lesson.firstSlots || 0) === 0 && (lesson.secondSlots || 0) === 0;
  }
  return (lesson.firstSlots || 0) === 0;
}

// 初回枠判定
function hasBeginnerSlot(lesson) {
  return lesson.beginnerSlots !== null && (lesson.beginnerSlots || 0) > 0;
}

function isBeginnerOnly(lesson) {
  return lesson.beginnerSlots === null;
}
```

#### 6-4. 型チェックエラーの解消

**削除するファイル**:

- `types/view/state.d.ts`の`SessionWithStatus`定義
- `types/dto/session.d.ts`（作成しない）

**any型の削除**:

- すべて`LessonCore`に統一
- 型アサーション不要

### 作業量見積もり

| 作業項目           | ファイル数     | 所要時間  |
| ------------------ | -------------- | --------- |
| 型定義修正         | 3ファイル      | 30分      |
| バックエンド修正   | 2ファイル      | 1時間     |
| フロントエンド修正 | 5ファイル      | 1時間     |
| テスト・検証       | -              | 30分      |
| **合計**           | **10ファイル** | **3時間** |

## 📊 改善効果

### Before（現状）

```typescript
// 3層構造
SessionCore (Core層)
  ↓
AvailableSlotsDto (DTO層)
  ↓
SessionWithStatus (View層)

// 型定義ファイル数: 5個
// any型使用箇所: 8箇所
// 変換処理: 3箇所
```

### After（改善後）

```typescript
// 1層構造
LessonCore(統一);

// 型定義ファイル数: 1個
// any型使用箇所: 0箇所
// 変換処理: 0箇所
```

### メリット

| 項目           | 改善     |
| -------------- | -------- |
| 型定義の複雑さ | 80%削減  |
| コード量       | 30%削減  |
| 認知負荷       | 大幅軽減 |
| 命名の一貫性   | 完全統一 |
| パフォーマンス | 変わらず |

## 🎯 Phase 6 実施後の状態

### 完了状態

- ✅ Core型のみで全データフロー実現
- ✅ Session → Lesson に完全統一
- ✅ スプレッドシート準拠の命名
- ✅ 型エラー完全解消
- ✅ any型完全排除

### Phase 7以降は不要

Phase 6完了により、以下は不要に：

- ~~Phase 7: API戻り値構造の統一~~ → Core型統一で解決
- ~~Phase 8: 型安全性の回復~~ → Core型統一で解決

## 💡 命名規則の確定

### プロパティ名の統一ルール

**原則**: スプレッドシートの列名に準拠

| 概念          | スプレッドシート列名 | 型定義プロパティ名 |
| ------------- | -------------------- | ------------------ |
| 1部開始       | "1部開始"            | `firstStart`       |
| 1部終了       | "1部終了"            | `firstEnd`         |
| 2部開始       | "2部開始"            | `secondStart`      |
| 2部終了       | "2部終了"            | `secondEnd`        |
| 初回枠開始    | "初回枠開始"         | `beginnerStart`    |
| 総定員        | "総定員"             | `totalCapacity`    |
| 初回枠定員    | "初回枠定員"         | `beginnerCapacity` |
| **1部空き枠** | （計算値）           | `firstSlots`       |
| **2部空き枠** | （計算値）           | `secondSlots`      |
| **初回枠**    | （計算値）           | `beginnerSlots`    |

**理由**:

- ✅ ビジネス用語との一貫性（first=1部、second=2部）
- ✅ 英語のみで統一（TypeScriptの慣習に従う）
- ✅ コード検索が容易
- ✅ スプレッドシートとの対応が明確

### 変数名の統一ルール

| 用途     | 命名             | 例                           |
| -------- | ---------------- | ---------------------------- |
| 単数形   | `lesson`         | `const lesson = ...`         |
| 複数形   | `lessons`        | `const lessons = ...`        |
| 選択中   | `selectedLesson` | `state.selectedLesson`       |
| 配列操作 | `lesson`         | `lessons.map(lesson => ...)` |

**禁止**: `session`, `slot`, `schedule`（文脈で混乱する）

## 📋 実装チェックリスト

### Phase 6-1: 型定義修正

- [ ] `types/core/session.d.ts` → `types/core/lesson.d.ts`にリネーム
- [ ] `SessionCore` → `LessonCore`に変更
- [ ] 空き枠プロパティを追加（`firstSlots`, `secondSlots`, `beginnerSlots`）
- [ ] `types/view/state.d.ts`から`SessionWithStatus`削除
- [ ] `types/core/index.d.ts`の参照を更新

### Phase 6-2: バックエンド修正

- [ ] `05-3_Backend_AvailableSlots.js`: `getLessons()`を修正
  - [ ] 戻り値型を`LessonCore[]`に
  - [ ] 拡張構造を廃止
  - [ ] 未来の日程のみに絞り込み（空き枠計算前）
  - [ ] 空き枠計算を統合
- [ ] `02-5_BusinessLogic_Notification.js`: 型注釈を`LessonCore[]`に
- [ ] `05-2_Backend_Write.js`: `checkCapacityFull()`を修正
- [ ] any型削除

### Phase 6-3: フロントエンド修正

- [ ] `12_WebApp_StateManager.js`: 型注釈を`LessonCore[]`に
- [ ] `13_WebApp_Views_Booking.js`: プロパティアクセスを更新
  - [ ] `lesson.firstSlots`, `lesson.secondSlots`, `lesson.beginnerSlots`に変更
- [ ] `14_WebApp_Handlers_Reservation.js`: 満席判定を更新
  - [ ] `isLessonFull()`関数を追加
- [ ] その他のlesson参照箇所を確認

### Phase 6-4: テスト・検証

- [ ] 型チェック実行（`npm run check-types`）
- [ ] ビルド実行（`npm run dev:build`）
- [ ] テスト環境デプロイ（`npm run dev:test`）
- [ ] 動作確認
  - [ ] レッスン一覧表示
  - [ ] 空き枠表示
  - [ ] 予約作成
  - [ ] 満席判定

---

**作成日**: 2025-10-04 **最終更新**: 2025-10-04 **関連ドキュメント**: [TYPE_SYSTEM_REDESIGN.md](./TYPE_SYSTEM_REDESIGN.md), [TYPE_SYSTEM_UNIFICATION.md](./TYPE_SYSTEM_UNIFICATION.md)
