# レッスン参加者リストWebApp 仕様書兼実装計画書

## 1. はじめに

### 1.1. 目的

本ドキュメントは、管理者およびレッスン参加生徒向けの、予約・参加者情報確認WebApp（以下、本WebApp）の開発に関する仕様と実装計画を定義します。

### 1.2. スコープ

本計画のスコープは、以下の機能の実装とします。

1. **レッスンごとの参加者リスト表示機能**
2. **参加者ごとの詳細情報・予約履歴表示機能**
3. **ユーザー権限（管理者/一般生徒）に応じた表示情報の制御**
4. **過去のレッスン履歴の閲覧機能**（コミュニティ感の醸成）

_補足: 今回はデータの閲覧（読み取り）機能に限定し、情報の編集・更新機能は将来的な拡張範囲とします。_

### 1.3. 設計の意図

本WebAppは、単なる管理ツールではなく、**参加者同士がつながりを感じられるコミュニティツール**を目指します。

**主な意図**:

- **他の参加者の様子を知る**: 同じレッスンに参加する人の作品や進捗を知ることで、仲間意識が生まれる
- **過去の活動を振り返る**: 過去のレッスンでどんな人が何を作っていたか見ることで、自分の制作のヒントになる
- **コミュニティの活気を感じる**: 教室全体の活動状況を可視化し、教室の雰囲気を伝える

このため、**過去のレッスンデータも積極的に表示**し、未来の予約だけでなく歴史も見られるようにします。

### 1.4. 前提条件

- 既存のデータモデル（`UserCore`, `LessonCore`, `ReservationCore`）を使用
- 既存のUIコンポーネントシステム（`13_WebApp_Components.js`）を活用
- 既存のデザインシステム（`11_WebApp_Config.js`の`DesignConfig`）を遵守
- ビルドプロセス（`npm run build`）によるコード変換を前提とする

---

## 2. 画面仕様

### 2.1. 画面構成

- 本WebAppは単一のページで構成されます。
- 画面上部に開催される「レッスン」を選択するためのドロップダウンリストを配置します。
- ドロップダウンでレッスンを選択すると、そのレッスンの参加者リストが画面下部にテーブル形式で表示されます。
- 参加者リストの氏名（またはニックネーム）をクリックすると、その生徒の詳細情報が同一ページ内に表示されます。

### 2.2. レッスン別参加者リスト画面

#### UIコンポーネント

1. **レッスン選択ドロップダウン:**
    - システムに登録されている全ての `Lesson` を選択肢として表示します。
2. **参加者テーブル:**
    - 選択された `Lesson` に紐づく予約情報の一覧を表示します。
    - 「本名」または「ニックネーム」列は、生徒詳細ページへのリンクとして機能します。

#### 表示項目（テーブル列）

| ヘッダー名     | データ項目                      | 権限           | 備考                             |
| -------------- | ------------------------------- | -------------- | -------------------------------- |
| 日付           | `ReservationCore.date`          | 全員           |                                  |
| 教室           | `LessonCore.classroom`          | 全員           |                                  |
| 会場           | `LessonCore.venue`              | 全員           |                                  |
| 開始時刻       | `ReservationCore.startTime`     | 全員           |                                  |
| 終了時刻       | `ReservationCore.endTime`       | 全員           |                                  |
| ステータス     | `ReservationCore.status`        | 全員           |                                  |
| 本名           | `UserCore.realName`             | **管理者のみ** |                                  |
| ニックネーム   | `UserCore.nickname`             | 全員           | 生徒詳細ページへのリンク         |
| 表示名         | `UserCore.displayName`          | 全員           | nicknameが未設定の場合の代替     |
| 初回           | `ReservationCore.firstLecture`  | 全員           | (例: "●" や "初回" のような表示) |
| 彫刻刀レンタル | `ReservationCore.chiselRental`  | 全員           | (例: "●" や "あり" のような表示) |
| 制作メモ       | `ReservationCore.workInProgress`| 全員           |                                  |
| order          | `ReservationCore.order`         | 全員           | 注文内容                         |

### 2.3. 生徒詳細ページ

#### UIコンポーネント

1. **戻るボタン:**
    - レッスン別参加者リスト画面の表示に戻ります。
2. **生徒情報セクション:**
    - 顧客の基本情報を表示します。
3. **予約履歴セクション:**
    - 該当顧客の過去の予約履歴（よやくカード、きろくカード）をテーブルで表示します。

#### 表示項目（生徒情報）

- **全員に表示:**
  - ニックネーム
  - 参加回数
  - 登録日時
  - 将来制作したいもの
- **管理者のみ表示:**
  - 本名
  - 電話番号
  - メールアドレス
  - メール連絡希望, 日程連絡希望, 通知日, 通知時刻
  - 年代, 性別, 利き手, 住所
  - 木彫り経験, 過去の制作物, 今後のご参加について
  - 同行者, 来場手段, 送迎
  - notes, 初回メッセージ, きっかけ

#### 表示項目（予約履歴）

| ヘッダー名 | データ項目                       | 権限 |
| ---------- | -------------------------------- | ---- |
| 日付       | `ReservationCore.date`           | 全員 |
| 教室       | `LessonCore.classroom`           | 全員 |
| 会場       | `LessonCore.venue`               | 全員 |
| 開始時刻   | `ReservationCore.startTime`      | 全員 |
| 終了時刻   | `ReservationCore.endTime`        | 全員 |
| ステータス | `ReservationCore.status`         | 全員 |
| 制作メモ   | `ReservationCore.workInProgress` | 全員 |

---

## 3. 実装計画

### Phase 1: バックエンド準備 (3-4日)

#### Task 1.1: 管理者権限システムの設計と実装

**現状**: 既存システムには管理者権限の概念が存在しない（予約の所有者チェックのみ）

**実装方針**:

1. **管理者判定方法（PropertiesServiceを使用）**:
   - PropertiesServiceに管理者専用のパスワード（電話番号形式）を保存
   - 管理者は通常の電話番号認証とは別に、特別なパスワードでログイン
   - 実装例:

     ```javascript
     // スクリプトプロパティに保存（初回設定時）
     PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', '99999999999');

     // 判定関数
     function isAdminLogin(phone) {
       const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
       return phone === adminPassword;
     }
     ```

   - メリット: コードを変更せずに管理者パスワードを変更可能、セキュリティが高い

2. **`04_Backend_User.js` に権限判定関数を追加**:

   ```javascript
   /**
    * 電話番号が管理者パスワードと一致するかをチェック
    * @param {string} phone - 電話番号（正規化済み）
    * @returns {boolean} 管理者の場合true
    */
   export function isAdminLogin(phone) {
     try {
       const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
       return phone === adminPassword;
     } catch (error) {
       Logger.log(`管理者チェックエラー: ${error.message}`);
       return false;
     }
   }

   /**
    * 生徒IDが管理者かどうかを判定
    * - 生徒名簿から電話番号を取得し、管理者パスワードと照合
    * @param {string} studentId - 生徒ID
    * @returns {boolean} 管理者の場合true
    */
   export function isAdminUser(studentId) {
     try {
       const student = getCachedStudentById(studentId);
       if (!student || !student.phone) {
         return false;
       }
       return isAdminLogin(student.phone);
     } catch (error) {
       Logger.log(`管理者チェックエラー: ${error.message}`);
       return false;
     }
   }
   ```

   **注意**: 管理者パスワードは初回セットアップ時に以下のスクリプトで設定：

   ```javascript
   // GASエディタから一度だけ実行
   function setupAdminPassword() {
     PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', '99999999999');
     Logger.log('管理者パスワードを設定しました');
   }
   ```

3. **セキュリティ考慮事項**:
   - フロントエンドでの権限チェックは表示制御のみ（信頼しない）
   - バックエンドで必ず権限を検証してからデータを返す
   - 管理者限定データはAPIレスポンスに含めない（フロントで非表示にするのではなく、最初から送信しない）

#### Task 1.2: APIエンドポイントの実装

`src/backend/09_Backend_Endpoints.js` に以下の関数を追記:

1. **`getLessonsForParticipantsView(studentId, includeHistory)`**:
   - レッスン選択用のドロップダウンリストを返す
   - **キャッシュ期間の拡充が必要**: 現状は7日前〜1年後だが、過去データも表示するため**過去6ヶ月〜未来1年**程度に拡張
   - `includeHistory`: `true`の場合は過去のレッスンも含める、`false`の場合は未来のみ
   - 返却データ: `lessonId`, `classroom`, `date`, `venue`, `status`（開催済み/開催予定）
   - デフォルトでは過去3ヶ月〜未来のレッスンを表示（ドロップダウンで切り替え可能）

2. **`getReservationsForLesson(lessonId, studentId)`**:
   - 特定レッスンの予約情報リストを返す
   - `studentId` で管理者判定を行い、権限に応じてデータをフィルタリング
   - 予約データに生徒情報（`user`）を結合して返す
   - **管理者**: 全項目を返す
   - **一般生徒**: `realName`, `phone`, `email` などの個人情報を除外

3. **`getStudentDetailsForParticipantsView(targetStudentId, requestingStudentId)`**:
   - 特定生徒の詳細情報と予約履歴を返す
   - `requestingStudentId` で管理者判定を行い、権限に応じてデータをフィルタリング
   - **管理者**: 全項目を返す
   - **一般生徒（本人）**: 自分の情報のみ閲覧可能
   - **一般生徒（他人）**: 公開情報のみ（`nickname`, `displayName`, 参加回数など）

#### Task 1.3: エラーハンドリングの実装

- 既存の `createApiResponse` を使用して統一的なエラーレスポンスを返す
- エラーケース:
  - レッスンが見つからない
  - 権限がない
  - データが不正
  - キャッシュ取得失敗時のフォールバック処理

#### Task 1.4: キャッシュ期間の拡充（重要）

**現状の課題**:

- `rebuildScheduleMasterCache()` のデフォルト期間は「7日前〜1年後」(src/backend/07_CacheManager.js:1080-1084)
- 参加者が過去のレッスン履歴を見られるようにするには不足

**対応方針**:

1. **`07_CacheManager.js` の `rebuildScheduleMasterCache()` を修正**:

   ```javascript
   export function rebuildScheduleMasterCache(fromDate, toDate) {
     try {
       const today = new Date();

       // 変更前: 7日前から
       // const sevenDaysAgo = new Date(today);
       // sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

       // 変更後: 6ヶ月前から（過去のレッスン履歴を表示するため）
       const sixMonthsAgo = new Date(today);
       sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
       const startDate =
         fromDate ||
         Utilities.formatDate(sixMonthsAgo, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');

       // 終了日は1年後のまま（変更なし）
       const oneYearLater = new Date(
         today.getFullYear() + 1,
         today.getMonth(),
         today.getDate(),
       );
       const endDate =
         toDate ||
         Utilities.formatDate(oneYearLater, CONSTANTS.TIMEZONE, 'yyyy-MM-dd');

       // ... 以下同じ
     }
   }
   ```

2. **キャッシュサイズへの影響**:
   - 現在: 約7日分の過去データ（約10-15件）
   - 変更後: 約6ヶ月分の過去データ（約150-200件）
   - 予想サイズ: 30KB → 50KB程度（100KB制限内で問題なし）

3. **パフォーマンスへの影響**:
   - キャッシュ取得時間: ほぼ変化なし（メモリ内での配列操作）
   - キャッシュ再構築時間: +1-2秒程度（シート読み込み範囲の増加）

#### Task 1.5: キャッシュ戦略の最適化

- 拡充したキャッシュシステムを活用
- レッスン一覧: `master_schedule_data` キャッシュから取得（**6ヶ月前〜1年後**のデータ）
- 予約一覧: `all_reservations` キャッシュから該当レッスンの予約をフィルタリング
- 生徒情報: `students_basic_data` キャッシュから取得（詳細情報は必要に応じてシートから取得）

### Phase 2: フロントエンド実装 (3-5日)

#### Task 2.1: 基本ファイルの作成

**ファイル構成（プロジェクトの命名規則に従う）**:

1. **`src/templates/15_WebApp_Participants.html`**:
   - 本WebAppの骨格となるHTMLファイル
   - 既存の `10_WebApp.html` を参考に構造を作成
   - ビルドプロセスで JavaScriptが自動注入される

2. **`src/frontend/15_WebApp_Participants_Core.js`**:
   - 初期化とページ遷移の制御ロジック
   - `google.script.run` によるバックエンドAPI呼び出し
   - エラーハンドリング（既存の `ErrorHandler` を活用）

3. **`src/frontend/15_WebApp_Participants_Views.js`**:
   - レッスン別参加者リスト画面のレンダリング
   - 生徒詳細画面のレンダリング
   - 既存の `Components` を活用したUI構築

4. **`src/frontend/15_WebApp_Participants_Handlers.js`**:
   - イベントハンドラの定義
   - ドロップダウン選択、リンククリックなど

#### Task 2.2: UIコンポーネントの活用

**既存コンポーネントの利用**:

```javascript
// 13_WebApp_Components.js を活用
Components.dropdown()         // レッスン選択ドロップダウン
Components.table()            // 参加者リストテーブル
Components.button()           // 戻るボタンなど
Components.cardContainer()    // 生徒詳細カード
Components.loader()           // ローディング表示
```

**デザインシステムの遵守**:

```javascript
// 11_WebApp_Config.js の DesignConfig を使用
DesignConfig.colors           // カラーパレット
DesignConfig.spacing          // 余白・サイズ
DesignConfig.typography       // フォント設定
DesignConfig.breakpoints      // レスポンシブ対応
```

#### Task 2.3: 参加者リスト画面の実装

1. **初期化処理**:

   ```javascript
   // ページロード時
   google.script.run
     .withSuccessHandler(handleLessonsLoaded)
     .withFailureHandler(ErrorHandler.handleApiError)
     .getLessonsForParticipantsView();
   ```

2. **ドロップダウン生成**: `Components.dropdown()` を使用

3. **テーブル描画**:
   - `Components.table()` を使用して参加者テーブルを生成
   - **表示制御**: バックエンドから返されたデータオブジェクトに存在するキーのみ表示
   - ニックネームまたは表示名にリンクを設定

4. **レスポンシブ対応**: `DesignConfig.breakpoints` に基づくスタイル調整

#### Task 2.4: 生徒詳細画面の実装

1. **詳細情報取得**:

   ```javascript
   // ニックネームクリック時
   google.script.run
     .withSuccessHandler(handleStudentDetailsLoaded)
     .withFailureHandler(ErrorHandler.handleApiError)
     .getStudentDetailsForParticipantsView(targetStudentId, requestingStudentId);
   ```

2. **情報カードの生成**: `Components.cardContainer()` を使用

3. **予約履歴テーブル**: `Components.table()` を使用

4. **戻るボタン**: `Components.button()` を使用してレッスンリストへ戻る

#### Task 2.5: エラーハンドリングとローディング状態

- 既存の `ErrorHandler` を活用
- `Components.loader()` でローディング表示
- APIエラー時のフォールバック処理
- オフライン検出とユーザー通知

### Phase 3: 統合とテスト (2-3日)

#### Task 3.1: ビルドとデプロイ

1. **開発環境での確認**:

   ```bash
   npm run ai:test  # validate:fix + テスト環境へデプロイ
   ```

2. **テスト環境のURL取得**:

   ```bash
   npm run url:exec:test  # WebApp URL
   npm run url:sheet:test # スプレッドシート URL（キャッシュクリア用）
   ```

3. **キャッシュのリフレッシュ**: スプレッドシートを開いてリロード（テスト環境の特性）

#### Task 3.2: MCP DevToolsを使った自動テスト

**Chrome DevTools MCPによる動作確認**:

1. **WebAppを開く**:

   ```javascript
   mcp__devtools__new_page({ url: "<test-env-url>" })
   ```

2. **スナップショット取得**:

   ```javascript
   mcp__devtools__take_snapshot()
   ```

3. **レッスン選択とテーブル確認**:
   - ドロップダウンから特定のレッスンを選択
   - 参加者テーブルが正しく表示されることを確認
   - 表示項目が権限に応じて適切に制御されていることを確認

4. **生徒詳細ページへの遷移**:
   - ニックネームリンクをクリック
   - 詳細情報と予約履歴が正しく表示されることを確認

5. **コンソールログの確認**:

   ```javascript
   mcp__devtools__list_console_messages()
   ```

6. **スクリーンショット取得**（必要に応じて）:

   ```javascript
   mcp__devtools__take_screenshot({ filePath: "test-screenshots/participants-view.png" })
   ```

#### Task 3.3: 権限テスト

**管理者アカウントでのテスト**:

- 全ての項目（本名、電話番号、メールアドレスなど）が表示されることを確認
- 他の生徒の詳細情報にアクセスできることを確認
- コンソールで返却データの構造を確認

**一般生徒アカウントでのテスト**:

- 本名などの管理者限定項目が**APIレスポンスに含まれていない**ことを確認（DevToolsのNetworkタブで確認）
- 自分以外の生徒の詳細情報は公開情報のみ表示されることを確認
- 自分の予約のみ詳細情報にアクセスできることを確認

#### Task 3.4: エラーケースのテスト

- 存在しないレッスンIDを指定した場合のエラーハンドリング
- 権限のない情報へのアクセス時のエラーメッセージ
- ネットワークエラー時のフォールバック動作
- キャッシュ不整合時の自動回復

#### Task 3.5: パフォーマンステスト

- レッスン一覧の読み込み時間測定
- 参加者リストの表示速度確認
- キャッシュヒット率の確認（ログから検証）
- 大量データ（100件以上の予約）でのスクロール性能

---

## 4. データモデル（参考）

APIで交換されるデータの型定義案です。管理者限定の項目はオプショナル（`?`）として定義します。

**既存のCore型を基盤として使用**し、View専用の型は `types/view/` に配置します。

```typescript
// types/view/participants.d.ts (新規作成)

/**
 * レッスン選択用のリストアイテム
 */
interface ParticipantsViewLessonItem {
  lessonId: string;
  classroom: string;  // LessonCore.classroom
  date: string;       // LessonCore.date
  venue?: string;     // LessonCore.venue
}

/**
 * 参加者リスト用の予約情報
 * - バックエンドでReservationCoreとUserCoreを結合して生成
 * - 権限に応じて項目が動的に変化
 */
interface ParticipantsViewReservation {
  // 予約基本情報（全員）
  reservationId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status: string;

  // レッスン情報（全員）
  classroom: string;
  venue?: string;

  // 生徒情報（公開）
  studentId: string;
  nickname?: string;
  displayName?: string;  // nicknameの代替

  // 生徒情報（管理者のみ）
  realName?: string;
  phone?: string;
  email?: string;

  // 予約オプション（全員）
  firstLecture?: boolean;
  chiselRental?: boolean;
  workInProgress?: string;
  order?: string;
}

/**
 * 生徒詳細情報
 * - 権限に応じて項目が動的に変化
 */
interface ParticipantsViewStudentDetail {
  // 基本情報（公開）
  studentId: string;
  nickname?: string;
  displayName?: string;
  participationCount: number;  // 予約履歴から計算

  // 詳細情報（管理者 or 本人のみ）
  realName?: string;
  phone?: string;
  email?: string;
  wantsEmail?: boolean;
  wantsScheduleNotification?: boolean;
  notificationDay?: number;
  notificationHour?: number;

  // その他情報（管理者 or 本人のみ）
  ageGroup?: string;
  gender?: string;
  dominantHand?: string;
  address?: string;
  experience?: string;
  pastWork?: string;
  futureParticipation?: string;
  futureCreations?: string;
  trigger?: string;
  firstMessage?: string;

  // 予約履歴
  reservationHistory: ParticipantsViewReservationHistory[];
}

/**
 * 予約履歴用の簡略型
 */
interface ParticipantsViewReservationHistory {
  date: string;
  classroom: string;
  venue?: string;
  startTime?: string;
  endTime?: string;
  status: string;
  workInProgress?: string;
}

/**
 * APIレスポンス型（統一フォーマット）
 */
interface ParticipantsViewApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
```

**型定義生成の流れ**:

1. バックエンドで `ReservationCore`, `LessonCore`, `UserCore` を使用してデータを処理
2. 権限に応じて必要なプロパティのみをピックアップ
3. View専用の型（`ParticipantsView*`）に変換してフロントエンドへ返却
4. フロントエンドではView専用の型を使用して開発

**セキュリティ上の重要事項**:

- バックエンドで権限チェックを行い、管理者限定の項目を含めない
- フロントエンドでの非表示ではなく、**データ自体を送信しない**
- `google.script.run` の呼び出し時に必ず `studentId` を渡して権限検証

---

## 5. 追加の考慮事項

### 5.1. セキュリティとプライバシー

1. **権限管理の二重チェック**:
   - フロントエンド: UI表示の制御（UX向上のため）
   - バックエンド: データ送信前の厳格なチェック（セキュリティ確保）

2. **個人情報の保護**:
   - 本名、電話番号、メールアドレスは管理者のみ閲覧可能
   - 一般生徒は自分の情報のみ閲覧可能
   - 他の生徒の情報は公開されているもの（ニックネーム、参加回数など）のみ

3. **監査ログ**:
   - 管理者による生徒情報へのアクセスをログに記録（将来的な拡張）
   - 不正アクセスの検知と対策

### 5.2. パフォーマンスとスケーラビリティ

1. **キャッシュ戦略**:
   - 既存のキャッシュシステムを最大限活用
   - レッスン一覧: 24時間キャッシュ（**6ヶ月前〜1年後**のデータを保持）← 拡充
   - 予約情報: 6時間キャッシュ（差分更新対応）
   - 生徒基本情報: 6時間キャッシュ

2. **データ量の制限**:
   - レッスン一覧: キャッシュには6ヶ月前〜1年後が含まれ、デフォルトでは過去3ヶ月〜未来を表示
   - 予約履歴は最新100件まで（それ以上は「もっと見る」で追加読み込み）
   - ページネーション実装（将来的な拡張）

3. **過去データ表示の意義**:
   - 参加者同士のつながりを感じられる
   - 過去の作品や進捗を参考にできる
   - 教室のコミュニティ感を醸成

4. **レスポンシブ設計**:
   - モバイルファーストで設計
   - タブレット・デスクトップにも対応
   - 既存の `DesignConfig.breakpoints` を活用

### 5.3. ユーザビリティ

1. **読み込み状態の明示**:
   - ローディングインジケーター（`Components.loader()`）
   - スケルトンスクリーン（将来的な拡張）

2. **エラーメッセージの親切化**:
   - 技術的なエラーを避け、ユーザーフレンドリーなメッセージを表示
   - 解決策の提示（「再読み込みしてください」など）

3. **アクセシビリティ**:
   - 適切なARIAラベルの設定
   - キーボードナビゲーション対応
   - 色覚サポート（色だけでなく、アイコンやテキストでも情報を伝える）

### 5.4. 将来的な拡張

本仕様では読み取り機能のみを実装しますが、以下の機能は将来的な拡張として検討できます：

1. **編集機能**:
   - 管理者による予約情報の編集
   - 生徒情報の更新

2. **フィルタリング・検索**:
   - ステータスによるフィルタリング
   - 生徒名での検索
   - 日付範囲での絞り込み

3. **エクスポート機能**:
   - 参加者リストのCSVエクスポート
   - 印刷用フォーマット

4. **統計情報**:
   - 参加者数の推移グラフ
   - キャンセル率の分析
   - 初回参加者の割合

5. **通知機能**:
   - レッスン開催前のリマインダー
   - 参加者リストの更新通知

---

## 6. まとめ

本仕様書は、レッスン参加者リスト表示機能の実装に必要な情報を包括的にまとめています。

**実装の重要ポイント**:

1. ✅ **既存のアーキテクチャを尊重**: データモデル、UIコンポーネント、デザインシステムを再利用
2. ✅ **セキュリティファースト**: バックエンドでの権限チェックを徹底
3. ✅ **パフォーマンス重視**: キャッシュシステムを活用し、高速なレスポンスを実現
4. ✅ **テスト駆動**: MCP DevToolsを使った自動テストで品質を担保
5. ✅ **拡張性**: 将来的な機能追加を見据えた設計

**次のステップ**:

1. Phase 1: バックエンドの実装（管理者権限システムとAPIエンドポイント）
2. Phase 2: フロントエンドの実装（UI構築とイベントハンドラ）
3. Phase 3: 統合テストと本番デプロイ

この仕様書に基づいて開発を進めることで、安全で使いやすい参加者リスト表示機能が実装できます。
