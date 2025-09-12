# リファクタリング計画: `availableSlots` から `lessons` への移行（詳細作業指示書）

## 1. 目的と背景

現在のデータモデルでは、空き枠情報を返すAPIのレスポンス（旧 `availableSlots`）は、単なる「空き枠」だけでなく、「静的な講座情報（`schedule`）」と「動的な予約状況（`status`）」を組み合わせたリッチなオブジェクトとなっています。

しかし、関数名や変数名が `availableSlots` や `slots` のままであるため、コードの実態と名称が乖離し、可読性やメンテナンス性の低下を招いています。

このリファクタリングでは、これらの名称を実態に即した `lessons` に統一することで、コードの意図を明確にし、将来の開発効率を向上させることを目的とします。

## 2. 作業担当AIへの指示

この計画書は、AI開発アシスタント（Claude Code Sonnet 4）が作業することを前提としています。各ステップは独立して実行可能ですが、**必ずステップの順序通りに作業を進めてください。** 各ステップの完了後には、テスト環境へのデプロイと動作確認を行うことを推奨します。

## 3. リファクタリング戦略

データの流れに沿って、**バックエンドからフロントエンドへ**と段階的に修正を進めます。このトップダウンのアプローチにより、手戻りを最小限に抑え、各ステップでの動作検証を容易にします。

1. **APIの契約更新**: バックエンドAPIが返すデータ構造を完全に `lessons` に統一します。
2. **データ受付口の修正**: フロントエンドがAPIから `lessons` データを受け取れるようにします。
3. **状態管理の統一**: アプリケーション内部の状態を `lessons` に統一します。
4. **UIとロジックの修正**: 新しいデータ構造 (`lesson.schedule.*`) を利用するようにUIの描画ロジックを修正します。
5. **クリーンアップ**: 不要になった古い変数名やロジックを削除します。

---

## 4. 詳細作業計画

### ✅ **事前準備: 完了済み**

- **型定義の更新**: `types/api-types.js` は完了済み。
- **バックエンドコアロジックの更新**: `dev/backend/05-3_Backend_AvailableSlots.js` の `getAvailableSlots` から `getLessons` へのリネームは完了済み。
- **バックエンドAPIの更新**: `dev/backend/09_Backend_Endpoints.js` の `getBatchData` と `executeOperationAndGetLatestData` は `lessons` を返すように修正済み。
- **フロントエンドデータ処理の更新**: `dev/frontend/12_WebApp_Core.js` の `processInitialData` は `lessons` を受け取るように修正済み。

---

### ⚠️ **ここから作業開始**

### **ステップ1: フロントエンドのデータ受付口の修正**

**目的**: ログイン時に `lessons` データを正しく取得し、アプリケーションの状態に反映させる。

**対象ファイル**:

- `dev/backend/09_Backend_Endpoints.js`
- `dev/frontend/14_WebApp_Handlers.js`

**具体的な指示**:

1. **`getLoginData` 関数の修正 (`09_Backend_Endpoints.js`)**:
   - `getBatchData` を呼び出す際に、`'lessons'` データタイプを追加で要求してください。

   ```diff
   --- a/dev/backend/09_Backend_Endpoints.js
   +++ b/dev/backend/09_Backend_Endpoints.js
   @@ -8000,7 +8000,7 @@
    Logger.log(`getLoginData開始: phone=${phone}`);

    // 統合バッチ処理で一度にすべてのデータを取得
   ```

- const batchResult = getBatchData(['initial', 'reservations'], phone);

* const batchResult = getBatchData(['initial', 'reservations', 'lessons'], phone); if (!batchResult.success) { return batchResult; }

  ```

  ```

2. **`processLoginWithValidatedPhone` 関数の修正 (`14_WebApp_Handlers.js`)**:
   - APIレスポンスの `response.availableSlots` を `response.data.lessons` に変更し、`processInitialData` 関数に渡すようにしてください。

   ```diff
   --- a/dev/frontend/14_WebApp_Handlers.js
   +++ b/dev/frontend/14_WebApp_Handlers.js
   @@ -153,8 +153,8 @@
          // ユーザーが見つかった場合：クライアントサイド処理で状態構築
          const newAppState = processInitialData(
            response.data,
            normalizedPhone,
   ```

-            response.availableSlots,

*            response.data.lessons, // 修正箇所
             response.data.userReservations,
           );
           debugLog(

  ```

  ```

**完了確認**: このステップ完了後、ログイン時に `lessons` データが正しく `stateManager` に格納されるようになります。

---

### **ステップ2: フロントエンドの状態管理とデータアクセスの統一**

**目的**: アプリケーション全体で `state.slots` への参照を `state.lessons` に変更し、データアクセスを新しいデータ構造に統一する。

**対象ファイル**: `dev/frontend/*.js` (全ファイルが対象の可能性あり)

**具体的な指示**:

1. **`stateManager` の参照を置換**:
   - プロジェクト全体で `stateManager.getState().slots` を検索し、すべて `stateManager.getState().lessons` に置換してください。
   - 同様に、`state.slots` という変数も `state.lessons` に変更してください。

2. **データ構造アクセスの修正 (`13_WebApp_Views.js`など)**:
   - `renderBookingSlots` 関数内で、古い `sl.date` や `sl.classroom` のようなフラットなアクセスを、新しい `lesson.schedule.date` や `lesson.schedule.classroom` のような階層化されたアクセスに修正してください。
   - **重要**: `renderBookingSlots` 内の `findReservationByDateAndClassroom` の呼び出しも、`sl.date` から `lesson.schedule.date` に変更する必要があります。

   ```javascript
   // 修正前 (例)
   const reservationData = findReservationByDateAndClassroom(sl.date, sl.classroom);

   // 修正後 (例)
   const reservationData = findReservationByDateAndClassroom(lesson.schedule.date, lesson.schedule.classroom);
   ```

3. **変数名のリネーム**:
   - `selectedSlot` という変数名を `selectedLesson` に変更してください。
   - `relevantSlots` という変数名を `relevantLessons` に変更してください。
   - ループ変数 `sl` を `lesson` に変更してください。

**完了確認**: このステップが完了すると、アプリケーションは新しい `lessons` データモデルで動作するようになり、UIが正しく表示されるはずです。

---

### **ステップ3: クリーンアップと最終検証**

**目的**: 古い後方互換性コードを削除し、リファクタリングを完了させる。

**対象ファイル**: `dev/backend/09_Backend_Endpoints.js`

**具体的な指示**:

1. **`getBatchData` 関数の後方互換性コード削除**:
   - `'slots'` のデータタイプリクエストのサポートを削除し、`'lessons'` のみに対応するようにしてください。

   ```diff
   --- a/dev/backend/09_Backend_Endpoints.js
   +++ b/dev/backend/09_Backend_Endpoints.js
   @@ -8088,18 +8088,13 @@
    }

    // 2. 講座情報が要求されている場合
   ```

- if (dataTypes.includes('lessons') || dataTypes.includes('slots')) {

* if (dataTypes.includes('lessons')) { Logger.log('=== getBatchData: lessons要求を処理中 ==='); const lessonsResult = getLessons(); Logger.log( `=== getBatchData: getLessons結果 - success=${lessonsResult.success}, dataLength=${lessonsResult.data?.length} ===`, ); if (!lessonsResult.success) { Logger.log(`=== getBatchData: lessons取得失敗で早期リターン ===`); return lessonsResult; } result.data = { ...result.data, lessons: lessonsResult.data };

-      // 後方互換性のためslotsキーも設定
-      if (dataTypes.includes('slots')) {
-        result.data = { ...result.data, slots: lessonsResult.data };
-      }
       Logger.log(`=== getBatchData: lessonsデータ設定完了 ===`);

  }

  ```

  ```

**完了確認**: 全ての機能（ログイン、予約作成・編集・キャンセル、会計）が正常に動作することを確認してください。

---

## 5. 完了の定義

以下の項目がすべて満たされた時点で、このリファクタリングは完了とします。

- [ ] バックエンドのAPIレスポンスから `slots` というキーが完全に排除される。
- [ ] フロントエンドのコード（`dev/frontend/*.js`）から `slots` という単語（変数名、プロパティ名）が完全に排除される。
- [ ] アプリケーションの全機能が、`lessons` データモデルを基準に正常に動作する。
- [ ] コード内に `getAvailableSlots` の呼び出しが残っていない。
