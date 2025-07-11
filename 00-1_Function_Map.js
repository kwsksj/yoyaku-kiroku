/**
 * =================================================================
 * 【ファイル名】: 00-1_Function_Map.gs
 * 【バージョン】: 1.1
 * 【役割】: このプロジェクトに存在する全ての主要な関数とその依存関係を定義する。
 * 機能改修時の影響範囲特定や、デバッグの効率化を目的とする。
 * このファイルはコードとしての実行を目的としない。
 * 【v1.1での変更点】:
 * - 可読性向上のため、テーブルの各行にJSDocの行頭アスタリスクを追加。
 * =================================================================
 *
 * 【見方】
 * - 関数名: `_`で始まるものは、同一ファイル内での利用を主とするプライベートなヘルパー関数。
 * - 呼び出し元 (Called By): その関数を呼び出している関数やトリガー。
 * - 呼び出す関数 (Calls To): その関数が内部で呼び出している主要な関数。
 *
 * --- バックエンド 関数マップ (.gs) ---
 *
 * | ファイル名 | 関数名 | 役割 | 呼び出し元 (Called By) | 呼び出す関数 (Calls To) |
 * |---|---|---|---|---|
 * | **01_Code.gs** | | | | |
 * | | `doGet` | WebAppの初期表示 | (GASトリガー) | `HtmlService` |
 * | | `onOpen` | スプレッドシート開封時にカスタムメニューを作成 | (GASトリガー) | `SpreadsheetApp`, `addAdminMenu`, `addCacheMenu` |
 * | | `addAdminMenu` | 管理者用メニュー項目を追加 | `onOpen` | - |
 * | | `addCacheMenu` | キャッシュ用メニュー項目を追加 | `onOpen` | - |
 * | | `handleOnChange` | シート変更トリガーの受付 | (GASトリガー) | `processChange`, `handleError`, `LockService` |
 * | | `handleEdit` | シート編集トリガーの受付 | (GASトリガー) | `processCellEdit`, `handleError`, `LockService` |
 * | **02-1_BusinessLogic_Batch.gs** | | | | |
 * | | `processYesterdayData` | メニュー項目: 昨日までのデータを処理 | (UIメニュー) | `processReservations` |
 * | | `processTodayData` | メニュー項目: 今日のデータを処理 | (UIメニュー) | `processReservations` |
 * | | `processOldestDate` | メニュー項目: 最も古い日付のデータを処理 | (UIメニュー) | `processReservations` |
 * | | `processReservations` | 予約のアーカイブと売上転記のメイン処理 | `processYesterdayData`, `processTodayData`, `processOldestDate` | `handleError`, `transferPastReservationsToArchive`, `deleteProcessedReservations` |
 * | | `logSalesFromArchivedData` | アーカイブデータから売上ログを生成・転記 | `transferPastReservationsToArchive` | `createSalesRow` |
 * | | `transferPastReservationsToArchive` | 過去の予約をアーカイブシートに移動 | `processReservations` | `createHeaderMap`, `shouldProcessRowByDate`, `logSalesFromArchivedData`, `formatSheetWithBordersSafely`, `updateRosterFromArchivedData` |
 * | | `updateRosterFromArchivedData` | アーカイブデータに基づき生徒名簿を更新 | `transferPastReservationsToArchive` | `createHeaderMap` |
 * | | `deleteProcessedReservations` | 処理済みの予約行を削除 | `processReservations` | - |
 * | | `createSalesRow` | 売上ログシート用の1行データを作成 | `logSalesFromArchivedData` | - |
 * | **02-2_BusinessLogic_Handlers.gs**| | | | |
 * | | `processCellEdit` | onEditトリガーの処理を振り分け | `handleEdit` | `handleRosterEdit`, `handleReservationSheetEdit` |
 * | | `processChange` | onChangeトリガーの処理を振り分け | `handleOnChange` | `handleRowInsert`, `sortAndRenumberDateBlock`, `updateSummarySheet` |
 * | | `handleReservationSheetEdit`| 予約シートの編集イベントを統括 | `processCellEdit` | `handleNameEdit`, `_handleTimeEditInReservation`, `_handleParticipantCountEditInReservation`, `updateAndSortSheet`, `updateSummarySheet`, `setCheckboxChoices` |
 * | | `handleRosterEdit` | 生徒名簿の編集イベントを処理 | `processCellEdit` | `updateFutureReservations` |
 * | | `handleNameEdit` | 予約シートの名前列編集を処理 | `_handleNameEditInReservation` | `getRosterData`, `populateReservationWithRosterData`, `handleReservationNameClear` |
 * | | `_handleTimeEditInReservation`| 時刻関連セルの編集を処理 | `handleReservationSheetEdit` | `updateBillableTime` |
 * | | `_handleParticipantCountEditInReservation`| 人数列のキャンセル入力を処理 | `handleReservationSheetEdit` | `insertEmptyRowForCancellation`, `createHeaderMap` |
 * | **02-3_BusinessLogic_SheetUtils.gs**| | | | |
 * | | `updateAndSortSheet` | シートのソート、再採番、数式復元、罫線描画 | `handleReservationSheetEdit` | `createHeaderMap`, `sortAndRenumberDateBlock`, `formatSheetWithBordersSafely` |
 * | | `sortAndRenumberDateBlock`| 特定日付ブロックのソートと再採番 | `updateAndSortSheet`, `manuallyReSortAndNumberSheet`, `processChange` | `createHeaderMap` |
 * | | `manuallyReSortAndNumberSheet`| メニュー項目: シート全体を手動でソート・採番 | (UIメニュー) | `handleError`, `sortAndRenumberDateBlock`, `formatSheetWithBordersSafely` |
 * | | `updateBillableTime` | 受講時間を計算・更新 | `_handleTimeEditInReservation` | `createHeaderMap` |
 * | | `handleRowInsert` | 行挿入時に日付等を自動入力 | `processChange` | `createHeaderMap` |
 * | | `insertEmptyRowForCancellation`| キャンセル時に空行を挿入 | `_handleParticipantCountEditInReservation` | - |
 * | | `handleReservationNameClear`| 予約者名クリア時に行を部分的にクリア | `handleNameEdit` | - |
 * | | `populateReservationWithRosterData`| 名簿データに基づき予約行を自動入力 | `handleNameEdit` | `getRosterData`, `createHeaderMap` |
 * | | `updateFutureReservations`| 名簿更新時に未来の予約情報を同期 | `handleRosterEdit` | `createHeaderMap` |
 * | | `_createNameToIdMap`| 名簿データから名前とIDの対応マップを作成 | `getRosterData` | `createHeaderMap` |
 * | | `getRosterData` | 生徒名簿のデータを取得・整形 | `handleNameEdit` | `createHeaderMap`, `_createNameToIdMap` |
 * | | `manuallyFormatActiveSheet`| メニュー項目: 罫線を手動で再描画 | (UIメニュー) | `formatSheetWithBordersSafely` |
 * | **03_BusinessLogic_Summary.gs**| | | | |
 * | | `updateSummarySheet` | 編集イベントに基づきサマリーを部分更新 | `handleReservationSheetEdit`, `processChange` | `createHeaderMap`, `recalculateAndWriteSummary` |
 * | | `recalculateAndWriteSummary`| 特定の日付・教室のサマリーを再計算・書き込み | `updateSummarySheet` | `createHeaderMap`, `getVenueForDate`, `countReservations`, `updateSummaryRow` |
 * | | `updateSummaryRow` | サマリーシートの特定行を更新または新規作成 | `recalculateAndWriteSummary`, `rebuildSummarySheet` | - |
 * | | `rebuildSummarySheet` | メニュー項目: サマリーシートをゼロから再構築 | (UIメニュー) | `handleError`, `createHeaderMap`, `updateSummaryRow` |
 * | | `countReservations` | 特定条件での予約数をカウント | `recalculateAndWriteSummary` | `createHeaderMap` |
 * | | `getVenueForDate` | 特定日付の会場名を取得 | `recalculateAndWriteSummary` | `createHeaderMap` |
 * | **04_Backend_User.gs** | | | | |
 * | | `authenticateUser` | WebApp: 電話番号でユーザーを認証 | `registerNewUser`, (WebApp) | `_normalizeAndValidatePhone` |
 * | | `registerNewUser` | WebApp: 新規ユーザーを名簿に登録 | (WebApp) | `authenticateUser` |
 * | | `updateUserProfile` | WebApp: ユーザープロフィールを更新 | (WebApp) | - |
 * | | `_normalizeAndValidatePhone`| 電話番号を正規化・検証 | `authenticateUser` | - |
 * | **05-1_Backend_Read.gs** | | | | |
 * | | `getSlotsAndMyBookings` | WebApp: 予約枠と自身の予約情報を取得 | `getInitialWebApp_Data`, `makeReservationAndGetLatestData`, `cancelReservationAndGetLatestData`, `fetchSlotsAndSetState` | `createHeaderMap` |
 * | | `getReservationDetails` | WebApp: 会計用の予約詳細を取得 | (WebApp) | `createHeaderMap`, `findRowIndexByValue` |
 * | | `getReservationDetailsForEdit`| WebApp: 予約編集用の全詳細を取得 | (WebApp) | `createHeaderMap`, `findRowIndexByValue` |
 * | | `getAccountingMasterData` | WebApp: 料金・商品マスタを取得 | `getInitialWebApp_Data` | - |
 * | | `getParticipationHistory` | WebApp: 参加履歴を取得 | `updateMemoAndGetLatestHistory`, (WebApp) | `createHeaderMap` |
 * | **05-2_Backend_Write.gs** | | | | |
 * | | `_validateTimeBasedReservation`| 時間制予約の時刻を検証 | `makeReservation`, `updateReservationDetails` | - |
 * | | `makeReservation` | WebApp: 予約を作成 | `makeReservationAndGetLatestData` | `getAccountingMasterData`, `_validateTimeBasedReservation`, `createHeaderMap`, `sortAndRenumberDateBlock`, ... |
 * | | `cancelReservation` | WebApp: 予約をキャンセル | `cancelReservationAndGetLatestData` | `createHeaderMap`, `findRowIndexByValue`, `findLastRowOfDateBlock`, `sortAndRenumberDateBlock`, ... |
 * | | `updateReservationDetails`| WebApp: 予約詳細を更新 | (WebApp) | `getAccountingMasterData`, `_validateTimeBasedReservation`, `createHeaderMap`, `findRowIndexByValue`, `updateBillableTime` |
 * | | `saveAccountingDetails` | WebApp: 会計情報を保存 | (WebApp) | `createHeaderMap`, `findRowIndexByValue` |
 * | | `updateMemoAndGetLatestHistory`| WebApp: 制作メモを更新し、最新履歴を返す | (WebApp) | `findRowIndexByValue`, `getParticipationHistory` |
 * | **06_ExternalServices.gs** | | | | |
 * | | `setCheckboxChoices` | Googleフォームの選択肢を更新 | `handleReservationSheetEdit` | `createStringArrayFromCounts`, `FormApp` |
 * | | `createStringArrayFromCounts`| フォーム選択肢用の文字列配列を生成 | `setCheckboxChoices` | `createHeaderMap` |
 * | | `addCalendarEventsToSheetWithSpecifics`| メニュー項目: Googleカレンダーから予約枠を追加 | (UIメニュー) | `handleError`, `createHeaderMap`, `CalendarApp` |
 * | **07_CacheManager.gs** | | | | |
 * | | `updateRosterCache` | メニュー項目: 生徒名簿のキャッシュを更新 | (UIメニュー) | `handleError`, `getAllStudentNames`, `updateRosterSheet`, `getAllReservations`, `updateCacheData` |
 * | | `getAllStudentNames` | 全ての予約シートから生徒名を取得 | `updateRosterCache` | - |
 * | | `updateRosterSheet` | 名簿に存在しない生徒を追加 | `updateRosterCache` | - |
 * | | `getAllReservations` | 全ての予約データを取得・整形 | `updateRosterCache` | `createHeaderMap` |
 * | | `updateCacheData` | 名簿のキャッシュ列を更新 | `updateRosterCache` | - |
 * | **08_Utilities.gs** | | | | |
 * | | `createHeaderMap` | ヘッダー配列からヘッダーマップを作成 | (多数) | - |
 * | | `shouldProcessRowByDate`| 日付が処理対象か判定 | `transferPastReservationsToArchive` | - |
 * | | `handleError` | エラー/情報メッセージを表示 | (多数) | `Logger`, `SpreadsheetApp` |
 * | | `findRowIndexByValue` | 特定の値を持つ行を検索 | `cancelReservation`, `getReservationDetails`, `updateReservationDetails`, ... | - |
 * | | `findLastRowOfDateBlock`| 特定日付ブロックの最終行を検索 | `cancelReservation` | - |
 * | | `formatSheetWithBordersSafely`| 罫線描画ライブラリを安全に呼び出し | `transferPastReservationsToArchive`, `updateAndSortSheet`, `manuallyReSortAndNumberSheet` | `drawBorders` (外部ライブラリ) |
 * | | `include` | HTMLファイルをインクルード | `doGet` (間接的に) | `HtmlService` |
 * | **09_Backend_Endpoints.gs** | | | | |
 * | | `getInitialWebApp_Data` | WebApp初期化データを一括取得 | (WebApp) | `getSlotsAndMyBookings`, `getAccountingMasterData` |
 * | | `makeReservationAndGetLatestData`| 予約作成とデータ再取得を統合 | (WebApp) | `makeReservation`, `recalculateAndWriteSummary`, `getSlotsAndMyBookings` |
 * | | `cancelReservationAndGetLatestData`| 予約キャンセルとデータ再取得を統合 | (WebApp) | `cancelReservation`, `recalculateAndWriteSummary`, `getSlotsAndMyBookings` |
 */
