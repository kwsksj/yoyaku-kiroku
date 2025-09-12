# リファクタリング計画: `availableSlots` から `lessons` への名称変更

## 1. 目的と背景

現在のデータモデルでは、空き枠情報を返すAPIのレスポンス（旧 `availableSlots`）は、単なる「空き枠」だけでなく、「静的な講座情報（`schedule`）」と「動的な予約状況（`status`）」を組み合わせたリッチなオブジェクトとなっています。

しかし、関数名や変数名が `availableSlots` や `slots` のままであるため、コードの実態と名称が乖離し、可読性やメンテナンス性の低下を招いています。

このリファクタリングでは、これらの名称を実態に即した `lessons` に統一することで、コードの意図を明確にし、将来の開発効率を向上させることを目的とします。

## 2. 変更内容の概要

このリファクタリングでは、以下の変更をシステム全体に適用します。

- **型定義の変更**: `AvailableSlot` を `Lesson` に変更し、その構成要素も `LessonSchedule`, `LessonStatus` に変更します。
- **バックエンドの変更**:
  - 空き枠計算関数名を `getAvailableSlots` から `getLessons` に変更します。
  - 関連する内部変数名を `availableSlots` から `lessons` に変更します。
- **APIエンドポイントの変更**:
  - `getBatchData` などのAPIで、データタイプ `'slots'` を `'lessons'` に変更します。
  - APIレスポンスのキーを `slots` から `lessons` に変更します。
- **フロントエンドの変更**:
  - 状態管理(StateManager)で保持するプロパティ名を `slots` から `lessons` に変更します。
  - APIレスポンスの `lessons` を受け取り、正しく処理するように修正します。

## 3. 影響範囲

この変更は、フロントエンドからバックエンドまで広範囲に影響します。主な対象ファイルは以下の通りです。

- `types/api-types.js` (型定義)
- `dev/backend/05-3_Backend_AvailableSlots.js` (メインロジック)
- `dev/backend/09_Backend_Endpoints.js` (APIエンドポイント)
- `dev/frontend/*.js` (フロントエンドのビューとハンドラー)
- `dev/templates/10_WebApp.html` (HTMLテンプレート)
- `dev/backend/05-2_Backend_Write.js` (APIエンドポイント経由で間接的に影響)
- `dev/backend/04_Backend_User.js` (APIエンドポイント経由で間接的に影響)

## 4. 実装手順

以下の手順で段階的に変更を適用します。

### Step 1: 型定義の更新

まず、システムの共通言語である型定義を更新します。

**ファイル**: `types/api-types.js`

```diff
--- a/types/api-types.js
+++ b/types/api-types.js
@@ -32,41 +32,39 @@
  */

 /**
- * @typedef {Object} AvailableSlot
  * 日程マスタ由来の静的な日程情報を表すオブジェクト
- * @typedef {Object} ScheduleDetails
+ * @typedef {Object} LessonSchedule
  * @property {string} classroom - 教室名
  * @property {string} date - 日付
  * @property {string} venue - 会場
  * @property {string} classroomType - 教室形式
  * @property {string} firstStart - 1部開始時刻
  * @property {string} firstEnd - 1部終了時刻
- * @property {string} secondStart - 2部開始時刻
- * @property {string} secondEnd - 2部終了時刻
- * @property {string} beginnerStart - 初回者開始時刻
  * @property {string} [secondStart] - 2部開始時刻
  * @property {string} [secondEnd] - 2部終了時刻
  * @property {string} [beginnerStart] - 初回者開始時刻
  * @property {number} totalCapacity - 全体定員
  * @property {number} beginnerCapacity - 初回者定員
- * @property {number} availableSlots - 利用可能枠数
  */

 /**
  * 予約状況から計算される動的な空き枠情報を表すオブジェクト
- * @typedef {Object} SlotStatus
+ * @typedef {Object} LessonStatus
  * @property {number} [availableSlots] - 利用可能枠数 (セッション制/全日制用)
  * @property {number} [morningSlots] - 午前枠の空き (2部制用)
  * @property {number} [afternoonSlots] - 午後枠の空き (2部制用)
  * @property {number} firstLectureSlots - 初回講座枠数
  * @property {boolean} isFull - 満席かどうか
  * @property {boolean} firstLectureIsFull - 初回講座満席かどうか
  */

 /**
- * @typedef {Object} AvailableSlot
- * @property {ScheduleDetails} schedule - 静的な日程情報
- * @property {SlotStatus} status - 動的な空き状況
+ * 講座情報とその予約状況をまとめたオブジェクト
+ * @typedef {Object} Lesson
+ * @property {LessonSchedule} schedule - 静的な日程情報
+ * @property {LessonStatus} status - 動的な空き状況
  */

 /**

```

### Step 2: バックエンドのコアロジック更新

`getAvailableSlots` 関数とその関連部分を `getLessons` に変更します。`dev` ディレクトリへの移行は完了しています。

**ファイル**: `src/05-3_Backend_AvailableSlots.js`

```diff
--- a/src/05-3_Backend_AvailableSlots.js
+++ b/src/05-3_Backend_AvailableSlots.js
@@ -7,10 +7,10 @@
  */

 /**
- * 利用可能な予約枠を計算して返す
+ * 開催予定の講座情報（空き枠情報を含む）を計算して返す
  */
-function getAvailableSlots() {
+function getLessons() {
   try {
-    Logger.log('=== getAvailableSlots 開始 ===');
+    Logger.log('=== getLessons 開始 ===');
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     const todayString = Utilities.formatDate(
@@ -18,7 +18,7 @@
       'yyyy-MM-dd',
     );
     Logger.log(
-      `=== getAvailableSlots: today=${today}, todayString=${todayString} ===`,
+      `=== getLessons: today=${today}, todayString=${todayString} ===`,
     );

     const scheduledDates = getAllScheduledDates(todayString, null);
@@ -68,7 +68,7 @@
       reservationsByDateClassroom.get(key).push(reservation);
     });

-    const availableSlots = [];
+    const lessons = [];

     scheduledDates.forEach(schedule => {
       const key = `${schedule.date}|${schedule.classroom}`;
@@ -239,7 +239,7 @@
         const firstLectureIsFull =
           beginnerCapacity > 0 && introFinalAvailable === 0;

-        availableSlots.push({
+        lessons.push({
           schedule: {
             classroom: schedule.classroom,
             date: schedule.date,
@@ -308,7 +308,7 @@
         const firstLectureIsFull =
           beginnerCapacity > 0 && introFinalAvailable === 0;

-        availableSlots.push({
+        lessons.push({
           schedule: {
             classroom: schedule.classroom,
             date: schedule.date,
@@ -361,7 +361,7 @@
         const firstLectureIsFull =
           beginnerCapacity > 0 && introFinalAvailable === 0;

-        availableSlots.push({
+        lessons.push({
           schedule: {
             classroom: schedule.classroom,
             date: schedule.date,
@@ -409,7 +409,7 @@
       now.getMonth(),
       now.getDate(),
     );
-    const filteredSlots = availableSlots.filter(slot => {
+    const filteredLessons = lessons.filter(lesson => {
       const slotDate = new Date(slot.date);

       // 当日以外はそのまま表示
@@ -437,21 +437,21 @@
     });

     // 8. 日付・教室順でソート
-    filteredSlots.sort((a, b) => {
+    filteredLessons.sort((a, b) => {
       const dateComp = new Date(a.date).getTime() - new Date(b.date).getTime();
       if (dateComp !== 0) return dateComp;
-      return a.classroom.localeCompare(b.classroom);
+      return a.schedule.classroom.localeCompare(b.schedule.classroom);
     });

     Logger.log(
-      `=== 利用可能な予約枠を ${filteredSlots.length} 件計算しました（フィルター後） ===`,
+      `=== 利用可能な予約枠を ${filteredLessons.length} 件計算しました（フィルター後） ===`,
     );
     Logger.log(
-      `=== filteredSlots サンプル: ${JSON.stringify(filteredSlots.slice(0, 2))} ===`,
+      `=== lessons サンプル: ${JSON.stringify(filteredLessons.slice(0, 2))} ===`,
     );
-    Logger.log('=== getAvailableSlots 正常終了 ===');
-    return createApiResponse(true, filteredSlots);
+    Logger.log('=== getLessons 正常終了 ===');
+    return createApiResponse(true, filteredLessons);
   } catch (error) {
-    Logger.log(`getAvailableSlots エラー: ${error.message}\n${error.stack}`);
-    return BackendErrorHandler.handle(error, 'getAvailableSlots', { data: [] });
+    Logger.log(`getLessons エラー: ${error.message}\n${error.stack}`);
+    return BackendErrorHandler.handle(error, 'getLessons', { data: [] });
   }
 }

@@ -463,13 +463,13 @@
  * @param {string} classroom - 教室名
  * @returns {object} - { success: boolean, data: object[], message?: string }
  */
-function getAvailableSlotsForClassroom(classroom) {
-  const result = getAvailableSlots();
+function getLessonsForClassroom(classroom) {
+  const result = getLessons();
   if (!result.success) {
     return createApiResponse(false, { message: result.message, data: [] });
   }
   return createApiResponse(
     true,
-    result.data.filter(slot => slot.classroom === classroom),
+    result.data.filter(lesson => lesson.schedule.classroom === classroom),
   );
 }


```

### Step 3: APIエンドポイントの更新

APIのI/Fを変更し、フロントエンドに `lessons` としてデータを渡すようにします。

**ファイル**: `src/09_Backend_Endpoints.js`

```diff
--- a/src/09_Backend_Endpoints.js
+++ b/src/09_Backend_Endpoints.js
@@ -35,7 +35,7 @@
           initialData: {
             ...batchResult.data.initial,
           },
-          slots: batchResult.data.slots || [],
+          lessons: batchResult.data.lessons || [],
         },
       });

@@ -250,15 +250,15 @@

     // 2. 空席情報が要求されている場合 - 非同期タスクとして登録
     if (dataTypes.includes('slots')) {
-      slotsDataTask = () => {
+      const lessonsDataTask = () => {
         Logger.log('=== getBatchData: slots要求を処理中（並列処理） ===');
-        const availableSlotsResult = getAvailableSlots();
+        const lessonsResult = getLessons();
         Logger.log(
-          `=== getBatchData: getAvailableSlots結果 - success=${availableSlotsResult.success}, dataLength=${availableSlotsResult.data?.length} ===`,
+          `=== getBatchData: getLessons結果 - success=${lessonsResult.success}, dataLength=${lessonsResult.data?.length} ===`,
         );
-        if (!availableSlotsResult.success) {
-          throw new Error(`空席情報取得失敗: ${availableSlotsResult.message || '不明なエラー'}`);
+        if (!lessonsResult.success) {
+          throw new Error(`講座情報取得失敗: ${lessonsResult.message || '不明なエラー'}`);
         }
-        return availableSlotsResult;
+        return lessonsResult;
       };
-      asyncTasks.push({name: 'slots', task: slotsDataTask});
+      asyncTasks.push({name: 'lessons', task: lessonsDataTask});
     }

     // 並列実行（GASでは真の非同期は使えないが、処理順序の最適化で高速化）
@@ -298,9 +298,9 @@
       }
     }

-    if (taskResults.slots) {
-      result.data.slots = taskResults.slots.data;
-      Logger.log(`=== getBatchData: slotsデータ設定完了（並列処理版） ===`);
+    if (taskResults.lessons) {
+      result.data.lessons = taskResults.lessons.data;
+      Logger.log(`=== getBatchData: lessonsデータ設定完了（並列処理版） ===`);
     }

     // 3. 個人予約データが要求されている場合（他データに依存するため後処理）

```

### Step 4: フロントエンドの更新

フロントエンド側で、APIレスポンスの変更に対応し、新しいデータ構造 (`lesson.schedule`, `lesson.status`) を使って画面を描画するように修正します。この修正は `src/10_WebApp.html` 内の `<script>` タグに含まれる `stateManager`, `renderBookingSlots`, `actionHandlers` など、広範囲にわたります。

**主な修正点**:

- `stateManager` の `slots` プロパティを `lessons` に変更。
- APIレスポンスの `response.data.lessons` を `state.lessons` に格納。
- `renderBookingSlots` などのビュー関数で `lesson.schedule.date` や `lesson.status.isFull` のように階層化されたデータにアクセスするよう修正。
- `actionHandlers` 内で `getBatchData` を呼び出す際に `'slots'` を `'lessons'` に変更。

## 5. 実装進捗状況（2025年9月12日現在）

### ✅ 完了済み

#### Step 1: 型定義の更新 - **完了**

- `types/api-types.js`で以下の変更が完了済み:
  - `AvailableSlot` → `Lesson`
  - `ScheduleDetails` → `LessonSchedule`
  - `SlotStatus` → `LessonStatus`

#### Step 2: バックエンドのコアロジック更新 - **完了**

- `dev/backend/05-3_Backend_AvailableSlots.js`で以下の変更が完了済み:
  - `getAvailableSlots()` → `getLessons()`
  - `getAvailableSlotsForClassroom()` → `getLessonsForClassroom()`
  - 内部変数 `availableSlots` → `lessons`
  - ログメッセージの更新
  - データ構造の階層化対応（`lesson.schedule.classroom`等）

#### Step 3: APIエンドポイントの更新 - **部分完了**

- `dev/backend/09_Backend_Endpoints.js`で`getBatchData`関数内の非同期タスク部分のみ`lessons`への対応が確認できましたが、多くの箇所で古い`slots`が使用され続けています。

### ⚠️ **未完了・不完全な部分**

#### Step 3: APIエンドポイントの更新 - **未完了**

**問題**: `dev/backend/09_Backend_Endpoints.js`で新旧の処理が混在し、リファクタリングが完了していません。

**具体的な未完了部分**:

1. **データ取得ロジックの旧形式残存**:
   - `getBatchData`関数内で、新しい`getLessons()`ではなく、古い`getAvailableSlots()`が呼び出されています。（`dev/backend/09_Backend_Endpoints.js`の8092行目付近）
   - レスポンスのキーが`slots`のままです。（`dev/backend/09_Backend_Endpoints.js`の8100行目付近）

   ```javascript
   // ❌ dev/backend/09_Backend_Endpoints.js: 8092行目
   const availableSlotsResult = getAvailableSlots();

   // ❌ dev/backend/09_Backend_Endpoints.js: 8100行目
   result.data = { ...result.data, slots: availableSlotsResult.data };
   ```

2. **汎用応答関数での旧形式使用**:
   - `executeOperationAndGetLatestData`関数が、レスポンスとして`slots`をハードコーディングしています。（7993行目付近）

   ```javascript
   // ❌ dev/backend/09_Backend_Endpoints.js: 7993行目
   slots: batchResult.data.slots || [],
   ```

#### Step 4: フロントエンドの更新 - **未完了・部分実装状態**

**問題**: `dev/frontend/*.js`（旧`src/10_WebApp.html`から分離）で新旧形式が混在している状態です。

**具体的な未完了部分**:

1. **StateManagerでの混在状態**:

   ```javascript
   // ✅ 新形式（プロパティ名は統一済み）
   stateManager.getState().lessons;

   // ❌ 旧形式（大多数・約71箇所）
   stateManager.getState().slots;
   ```

2. **APIレスポンス処理での混在**:
   - `dev/frontend/12_WebApp_Core.js`の`processInitialData`関数が、古い`availableSlots`を引数として期待しています。

   ```javascript
   // ❌ dev/frontend/12_WebApp_Core.js: 151行目
   function processInitialData(
     data,
     phone,
     availableSlots, // <- 旧形式
     userReservations = null,
   ) {
     // ...
     return {
       // ...
       slots: availableSlots, // <- 旧形式
     };
   }
   ```

3. **データ構造アクセスの混在**:
   - `dev/frontend/13_WebApp_Views.js`の`renderBookingSlots`関数内で、新しい`lesson.schedule.date`形式と、古いフラットな`sl.date`形式のアクセスが混在しています。

   ```javascript
   // ✅ 新形式
   const month = new Date(lesson.schedule.date).getMonth() + 1;

   // ❌ 旧形式
   const reservationData = findReservationByDateAndClassroom(
     sl.date, // <- 旧形式のフラットなアクセス
     sl.classroom,
   );
   ```

4. **ハンドラーでの旧形式残存**:
   - `dev/frontend/14_WebApp_Handlers.js`の`processLoginWithValidatedPhone`関数が、APIレスポンスとして`response.data.slots`を期待しています。

   ```javascript
   // ❌ dev/frontend/14_WebApp_Handlers.js: 156行目
   response.availableSlots;
   ```

**必要な修正作業**:

- [ ] **バックエンドAPI**: `getBatchData`と`executeOperationAndGetLatestData`を修正し、`lessons`を返すように統一する。
- [ ] **StateManager**: `slots`プロパティを完全に`lessons`に統一する。（プロパティ名は完了済み、使用箇所の修正が必要）
- [ ] **データ処理**: `processInitialData`を修正し、`response.data.lessons`を受け取るようにする。
- [ ] **データアクセス**: 全ての`state.slots`アクセスを`state.lessons`に変更する。
- [ ] **変数名**: `selectedSlot`などの変数を`selectedLesson`にリネームする。
- [ ] データ構造アクセスの階層化対応確認（`lesson.schedule.*`, `lesson.status.*`）
- [ ] **バージョン管理**: `_slotsVersion`を`_lessonsVersion`に統一する。（完了済み）

## 6. 次のアクションプラン

### 優先度1: フロントエンドの完全移行

1. **バックエンドAPI修正**: `getBatchData`と`executeOperationAndGetLatestData`を修正し、`lessons`を返すように統一する。
2. **フロントエンドデータ処理修正**: `processInitialData`を修正し、`response.data.lessons`を受け取るようにする。
3. **StateManager利用箇所の統一**: 全ての`state.slots`アクセスを`state.lessons`に変更する。
4. **データ構造アクセス統一**: 全てのビューとヘルパー関数で、データアクセスを`lesson.schedule.*`と`lesson.status.*`に統一する。
5. **変数名統一**: `selectedSlot`を`selectedLesson`にリネームするなど、関連する変数名をすべて`lesson`ベースに統一する。

### 優先度2: 後方互換性の段階的廃止

1. **APIエンドポイント**: フロントエンドの移行完了後、APIエンドポイントでの`'slots'`サポートを廃止する。
2. **レスポンス**: レスポンスでの`slots`プロパティ提供を完全に廃止する。

### 優先度3: 完全移行後の検証

1. 全機能の動作テスト
2. データ構造の整合性確認
3. パフォーマンス影響の検証

## 7. 期待される効果

- **可読性の向上**: `lessons` という名前がデータの実態を正確に表し、コードの意図が明確になります。
- **メンテナンス性の向上**: データ構造が整理され、将来の仕様変更に強くなります。
- **一貫性の確保**: バックエンドからフロントエンドまで、データモデルの名称が統一され、開発者間の認識齟齬を防ぎます。
- **技術負債の解消**: 新旧混在状態の解消により、混乱やバグの原因を排除します。
