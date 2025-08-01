# システムアーキテクチャ仕様書

このドキュメントは、Google Apps Script (GAS)で構築された予約管理システム「きぼりの よやく・きろく」の詳細なアーキテクチャを解説します。プロジェクトの構造、扱うデータモデル、そして各ファイルの具体的な機能について網羅的に説明します。

> **開発者向けクイックスタートは [`README.md`](../README.md) を参照してください**

- **目次**
  - [1. プロジェクトの構成](#1-プロジェクトの構成)
  - [2. データモデル（スプレッドシート構造）](#2-データモデルスプレッドシート構造)
    - [2.1. 予約シート (例: 東京教室, つくば教室, 沼津教室)](#21-予約シート-例-東京教室-つくば教室-沼津教室)
    - [2.2. 生徒名簿シート (`ROSTER_SHEET_NAME`)](#22-生徒名簿シート-roster_sheet_name)
    - [2.3. 料金・商品マスタシート (`ACCOUNTING_MASTER_SHEET_NAME`)](#23-料金商品マスタシート-accounting_master_sheet_name)
    - [2.4. 予約サマリーシート (`SUMMARY_SHEET_NAME`)](#24-予約サマリーシート-summary_sheet_name)
    - [2.5. アクティビティログシート (`LOG_SHEET_NAME`)](#25-アクティビティログシート-log_sheet_name)
  - [3. ファイルカテゴリと機能詳細](#3-ファイルカテゴリと機能詳細)
    - [3.1. ファイルカテゴリ](#31-ファイルカテゴリ)
    - [3.2. エントリーポイントとグローバル設定](#32-エントリーポイントとグローバル設定)
    - [3.3. ビジネスロジック](#33-ビジネスロジック)
    - [3.4. バックエンドAPI](#34-バックエンドapi)
    - [3.5. 外部サービス連携](#35-外部サービス連携)
    - [3.6. キャッシュ管理](#36-キャッシュ管理)
    - [3.7. ユーティリティ](#37-ユーティリティ)
    - [3.8. Webアプリケーション (HTML/JavaScript)](#38-webアプリケーション-htmljavascript)

## 1. プロジェクトの構成

プロジェクトは、責務に応じて機能ごとにファイルが分割されています。主な構成要素は以下の通りです。

- **データモデル**: アプリケーションが扱うデータの構造（スプレッドシートの各シートの定義）。
- **スクリプトファイル**: 役割に応じて分類された、ロジックを実装するファイルの集まり。
- **ロードマップ**: プロジェクトの将来的な計画、目標、および開発の方向性を示すドキュメント。詳細は [roadmap.md](roadmap.md) を参照してください。

## 2. データモデル（スプレッドシート構造）

このプロジェクトは、以下のGoogleスプレッドシートをデータベースとして利用します。

### 2.1. 予約シート (例: 東京教室, つくば教室, 沼津教室)

各教室の予約情報を時系列で記録する主要なデータテーブル。

| ヘッダー名 (定数)                         | データ型             | 説明                                                                                                           |
| ----------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `予約ID` (`HEADER_RESERVATION_ID`)        | `UUID (String)`      | 各予約行を一位に特定するID。行挿入時に自動採番される。                                                         |
| `生徒ID` (`HEADER_STUDENT_ID`)            | `UUID (String)`      | 予約者を示すID。「生徒名簿」シートの`生徒ID`と関連する。                                                       |
| `日付` (`HEADER_DATE`)                    | `Date`               | 予約日。この列を基準にソートされる。**必須項目**。                                                             |
| `会場` (`HEADER_VENUE`)                   | `String`             | 東京教室の場合のみ、カレンダーから自動入力される。                                                             |
| `人数` (`HEADER_PARTICIPANT_COUNT`)       | `Number` or `String` | 予約者の出席番号（1, 2, ...）を示す数値、または`waiting`, `cancel`といった予約の特殊な状態を示す文字列が入る。 |
| `名前` (`HEADER_NAME`)                    | `String`             | 予約者の名前（本名またはニックネーム）。入力されると`生徒ID`が自動補完される。**必須項目**。                   |
| `回数` (`HEADER_CLASS_COUNT`)             | `Number`             | その予約時点での、その生徒の累計参加回数。名簿から自動入力される。                                             |
| `初講` (`HEADER_FIRST_LECTURE`)           | `Boolean`            | 初回講習の参加者であるかを示すフラグ (`TRUE`または空欄)。                                                      |
| `早出` (`HEADER_EARLY_ARRIVAL`)           | `Boolean`            | 早出オプションの利用者であるかを示すフラグ (`TRUE`または空欄)。                                                |
| `彫刻刀レンタル` (`HEADER_CHISEL_RENTAL`) | `Boolean`            | 彫刻刀レンタルの利用者であるかを示すフラグ (`TRUE`または空欄)。                                                |
| `受講時間` (`HEADER_TIME`)                | `Number`             | 時間制教室での課金対象時間。`開始時刻`と`終了時刻`から自動計算される。                                         |
| `制作メモ` (`HEADER_WORK_IN_PROGRESS`)    | `String`             | その日の作業内容のメモ。WebAppから編集可能。                                                                   |
| `order` (`HEADER_ORDER`)                  | `String`             | 物販の購入希望など。WebAppから編集可能。                                                                       |
| `会計詳細` (`HEADER_ACCOUNTING_DETAILS`)  | `JSON (String)`      | WebAppの会計機能で記録された詳細な会計情報。JSON形式で保存される。                                             |
| `LINE`, `in the future`, `notes`, `from`  | `String`             | 生徒名簿と同期される、各種メモ情報。                                                                           |
| `開始時刻` (`HEADER_START_TIME`)          | `Time`               | 時間制教室での講座開始時刻。                                                                                   |
| `終了時刻` (`HEADER_END_TIME`)            | `Time`               | 時間制教室での講座終了時刻。                                                                                   |
| `休憩開始` (`HEADER_BREAK_START`)         | `Time`               | 時間制教室での休憩開始時刻（マスタ参照用）。                                                                   |
| `休憩終了` (`HEADER_BREAK_END`)           | `Time`               | 時間制教室での休憩終了時刻（マスタ参照用）。                                                                   |

### 2.2. 生徒名簿シート (`ROSTER_SHEET_NAME`)

全ての生徒の基本情報と、予約シートから同期されるキャッシュ情報を管理する。

| ヘッダー名 (定数)                         | データ型        | 説明                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `生徒ID` (`HEADER_STUDENT_ID`)            | `UUID (String)` | 全ての生徒を一位に特定するID。**主キー**。初回予約時または新規登録時に自動採番。                                                                                                                                                                                                                                                                      |
| `本名` (`HEADER_REAL_NAME`)               | `String`        | 生徒の本名。                                                                                                                                                                                                                                                                                                                                          |
| `ニックネーム` (`HEADER_NICKNAME`)        | `String`        | WebApp上での表示名。空欄の場合は本名が使用される。                                                                                                                                                                                                                                                                                                    |
| `電話番号` (`HEADER_PHONE`)               | `String`        | WebAppのログイン認証に使用。先頭ゼロが消えないよう文字列として保存。                                                                                                                                                                                                                                                                                  |
| `参加回数` (`HEADER_UNIFIED_CLASS_COUNT`) | `Number`        | 全教室の累計参加回数。アーカイブ処理時に自動で加算される。                                                                                                                                                                                                                                                                                            |
| `よやくキャッシュ`                        | `JSON (String)` | 未来の予約情報オブジェクトの配列をJSON文字列として保存するキャッシュ列。                                                                                                                                                                                                                                                                              |
| `きろく_YYYY`                             | `JSON (String)` | その年の参加日時、教室名、会場、制作メモ、会計詳細の配列をJSON文字列として保存するキャッシュ列。  **[設計思想]** 会計詳細は`予約シート`や`売上ログ`にも記録されるためデータとしては冗長だが、WebAppの「きろく」画面での会計詳細表示を高速化（サーバー通信を不要に）し、エラー発生リスクを最小化するため、意図的にキャッシュに含めている（非正規化）。 |
| `LINE`, `in the future`, `notes`, `from`  | `String`        | 各生徒に関する最新のメモ情報。予約シートから同期されるキャッシュデータ。                                                                                                                                                                                                                                                                              |

### 2.3. 料金・商品マスタシート (`ACCOUNTING_MASTER_SHEET_NAME`)

WebAppの会計機能で使用される、全ての料金体系と販売商品を定義する。

| ヘッダー名 | データ型 | 説明                                                                           |
| ---------- | -------- | ------------------------------------------------------------------------------ |
| `種別`     | `String` | `授業料`, `物販`, `材料`のいずれか。WebAppの会計画面の表示分類に使用。         |
| `項目名`   | `String` | 料金や商品の名前（例：「本講座」「彫刻刀レンタル」「クスノキ」）。**主キー**。 |
| `単価`     | `Number` | 料金または商品の単価。                                                         |
| `単位`     | `String` | 料金の単位（例：「30分」「cm³」）。時間制や体積計算のロジック分岐に使用。      |
| `対象教室` | `String` | その項目が適用される教室名。`共通`または特定の教室名を記述。                   |
| `備考`     | `String` | 割引の条件など、補足的な説明。旧`説明`列。                                     |
| `講座開始` | `Time`   | 授業料タイプの項目における、講座の公式な開始時刻。                             |
| `講座終了` | `Time`   | 授業料タイプの項目における、講座の公式な終了時刻。                             |
| `休憩開始` | `Time`   | 時間制教室における、課金対象から除外する休憩時間の開始時刻。                   |
| `休憩終了` | `Time`   | 時間制教室における、課金対象から除外する休憩時間の終了時刻。                   |

### 2.4. 予約サマリーシート (`SUMMARY_SHEET_NAME`)

WebAppの空席表示を高速化するための、集計済みデータ。`rebuildSummarySheet`または`updateSummarySheet`によって自動更新される。

| ヘッダー名 (定数)                              | データ型    | 説明                                                       |
| ---------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `ユニークキー` (`HEADER_SUMMARY_UNIQUE_KEY`)   | `String`    | `日付_教室名_セッション`の形式。この行を一位に特定するID。 |
| `日付` (`HEADER_DATE`)                         | `Date`      | 予約日。                                                   |
| `教室名` (`HEADER_SUMMARY_CLASSROOM`)          | `String`    | 教室名。                                                   |
| `セッション` (`HEADER_SUMMARY_SESSION`)        | `String`    | `午前`, `午後`, `全日`, `本講座`, `初回講習`のいずれか。   |
| `会場` (`HEADER_SUMMARY_VENUE`)                | `String`    | 教室の開催場所。                                           |
| `定員` (`HEADER_SUMMARY_CAPACITY`)             | `Number`    | そのセッションの定員。                                     |
| `予約数` (`HEADER_SUMMARY_RESERVATION_COUNT`)  | `Number`    | 現在の予約者数。                                           |
| `空席数` (`HEADER_SUMMARY_AVAILABLE_COUNT`)    | `Number`    | `定員 - 予約数`で算出される空席数。                        |
| `最終更新日時` (`HEADER_SUMMARY_LAST_UPDATED`) | `Timestamp` | この行が最後に更新された日時。                             |

### 2.5. アクティビティログシート (`LOG_SHEET_NAME`)

ユーザーの操作やシステムの重要なイベントを時系列で記録する。問題発生時の追跡や利用状況の分析に用いる。

| ヘッダー名       | データ型    | 説明                                                                                               |
| ---------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `タイムスタンプ` | `Timestamp` | ログが記録された日時。                                                                             |
| `生徒ID`         | `String`    | 操作を行ったユーザーの「生徒ID」。システムによる操作の場合は`system`や管理者メールアドレスが入る。 |
| `ニックネーム`   | `String`    | 操作を行ったユーザーの表示名（ニックネーム、または本名）。                                         |
| `アクション`     | `String`    | 操作の種類を識別する文字列 (例: `LOGIN_SUCCESS`, `RESERVATION_CREATE`)。                           |
| `結果`           | `String`    | 操作の結果 (`SUCCESS` or `FAILURE`)。                                                              |
| `詳細`           | `String`    | 操作に関する追加情報（予約ID、エラーメッセージなど）。                                             |

## 3. ファイルカテゴリと機能詳細

### 3.1. ファイルカテゴリ

プロジェクトは大きく分けて以下のカテゴリに分類されます。

1. **エントリーポイントとグローバル設定**: プロジェクトのグローバル定数、UI定義、マニフェスト設定。
2. **ビジネスロジック**: アプリケーションの主要な機能（バッチ処理、イベントハンドラ、シート操作、サマリー更新）。
3. **バックエンドAPI**: Webアプリケーションからのデータ読み書き要求を処理するAPI。
4. **外部サービス連携**: GoogleフォームやGoogleカレンダーとの連携。
5. **キャッシュ管理**: パフォーマンス向上のためのデータキャッシュ処理。
6. **ユーティリティ**: プロジェクト全体で利用される汎用関数。
7. **Webアプリケーション (HTML/JavaScript)**: ユーザーインターフェースとクライアントサイドロジック。

---

### 3.2. エントリーポイントとグローバル設定

- **`01_Code.js`**
  - **役割**: グローバル定数、UI定義、トリガー関数を集約するプロジェクトのエントリーポイント。
  - **主要機能**:

    | 主要関数         | 役割                                                                                                                                      |
    | :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
    | `doGet`          | Webアプリケーションのエントリーポイント。                                                                                                 |
    | `onOpen`         | スプレッドシート開封時にカスタムメニューを作成。                                                                                          |
    | `addAdminMenu`   | 管理者用メニュー項目を追加。                                                                                                              |
    | `addCacheMenu`   | キャッシュ用メニュー項目を追加。                                                                                                          |
    | `handleOnChange` | シート変更イベントのハンドラ。これらの関数はGASのトリガーから直接呼び出され、実際の処理は`02-2_BusinessLogic_Handlers.js`に委譲されます。 |
    | `handleEdit`     | セル編集イベントのハンドラ。これらの関数はGASのトリガーから直接呼び出され、実際の処理は`02-2_BusinessLogic_Handlers.js`に委譲されます。   |

- **`appsscript.json`**
  - **役割**: プロジェクトのマニフェストファイル。タイムゾーン、依存ライブラリ、実行APIのスコープ（権限）、Webアプリのアクセスレベルなど、プロジェクト全体の動作に関わる設定を定義します。

---

### 3.3. ビジネスロジック

- **`02-1_BusinessLogic_Batch.js`**
  - **役割**: メニューから手動で実行される、重いバッチ処理を集約します。
  - **主要機能**:

    | 主要関数                            | 役割                                                                           |
    | :---------------------------------- | :----------------------------------------------------------------------------- |
    | `processYesterdayData`              | 昨日までのデータを処理します。                                                 |
    | `processTodayData`                  | 今日のデータを処理します。                                                     |
    | `processOldestDate`                 | 最も古い日付のデータを処理します。                                             |
    | `processReservations`               | 予約処理のメイン関数。過去の予約をアーカイブし、売上データを転記する。         |
    | `transferPastReservationsToArchive` | 過去の予約をアーカイブシートに移動し、売上ログと名簿キャッシュを更新。         |
    | `logSalesFromArchivedData`          | アーカイブデータから会計情報を抽出し、売上ログに転記。                         |
    | `updateRosterWithRecordCache`       | アーカイブされた予約データに基づき、生徒名簿の「きろく」キャッシュを更新する。 |
    | `deleteProcessedReservations`       | 処理済みの予約行をシートから削除します。                                       |
    | `setupTestEnvironment`              | 開発用のテスト環境をセットアップ。                                             |

- **`02-2_BusinessLogic_Handlers.js`**
  - **役割**: リアルタイムなシート操作に応答するイベントハンドラ群です。
  - **主要機能**:

    | 主要関数                                   | 役割                                               |
    | :----------------------------------------- | :------------------------------------------------- |
    | `processCellEdit`                          | セル編集イベントを統括し、適切な処理に振り分け。   |
    | `processChange`                            | 行挿入などの変更イベントを処理。                   |
    | `handleReservationSheetEdit`               | 予約シートでの編集イベントを統括。                 |
    | `handleRosterEdit`                         | 名簿シートでの編集イベントを処理。                 |
    | `handleNameEdit`                           | 予約シートで名前列が編集された際の処理。           |
    | `_handleParticipantCountEditInReservation` | 人数列が編集され、キャンセルが入力された際の処理。 |

- **`02-3_BusinessLogic_SheetUtils.js`**
  - **役割**: 予約シートや名簿シートを操作するための、より汎用的なヘルパー関数群です。
  - **主要機能**:

    | 主要関数                                  | 役割                                                                               |
    | :---------------------------------------- | :--------------------------------------------------------------------------------- |
    | `updateAndSortSheet`                      | シートのソートと再採番、および罫線描画。                                           |
    | `sortAndRenumberDateBlock`                | 特定の日付ブロックをソートし、人数列を再採番。                                     |
    | `manuallyReSortAndNumberSheet`            | メニューからシート全体を手動でソート・採番。                                       |
    | `updateBillableTime`                      | 課金対象時間を計算し、「受講時間」列を更新。                                       |
    | `updateGanttChart`                        | 指定された行のガントチャートを更新。                                               |
    | `handleRowInsert`                         | 行が挿入された際に、日付と会場を上の行から自動入力。                               |
    | `insertEmptyRowForCancellation`           | キャンセル処理時に、空の行を挿入。                                                 |
    | `handleReservationNameClear`              | 予約者の名前がクリアされた際に、関連情報をクリア。                                 |
    | `populateReservationWithRosterData`       | 予約シートに名前が入力された際、生徒名簿のデータを参照して関連情報を自動入力。     |
    | `updateFutureReservations`                | 生徒名簿の情報が更新された際、未来の予約にその情報を同期。                         |
    | `getRosterData`                           | 生徒名簿シートからデータを取得し、整形して返す。                                   |
    | `_rebuildFutureBookingsCacheForStudent`   | 指定された生徒IDの将来の予約情報を全シートから再集計し、名簿のキャッシュを再構築。 |
    | `_updateFutureBookingsCacheIncrementally` | キャッシュを差分更新し、その結果を返す。                                           |

- **`03_BusinessLogic_Summary.js`**
  - **役割**: 予約サマリーシートの構築と更新を担当するロジックです。
  - **主要機能**:

    | 主要関数                       | 役割                                                                       |
    | :----------------------------- | :------------------------------------------------------------------------- |
    | `updateSummaryAndForm`         | サマリーシートと、それに関連するGoogleフォームの選択肢を更新する統合関数。 |
    | `triggerSummaryUpdateFromEdit` | 編集イベントを元に、関連する日付のサマリー更新をトリガー。                 |
    | `rebuildSummarySheet`          | 予約サマリーシートをゼロから再構築。                                       |
    | `_updateSummaryForDate`        | 特定の教室・日付の予約状況を再計算し、サマリーシートに書き込む。           |

---

### 3.4. バックエンドAPI

- **`04_Backend_User.js`**
  - **役割**: WebApp連携のうち、ユーザー認証・管理を担当するバックエンド機能です。
  - **主要機能**:

    | 主要関数                     | 役割                                                           |
    | :--------------------------- | :------------------------------------------------------------- |
    | `authenticateUser`           | 電話番号を元にユーザーを認証。                                 |
    | `getUsersWithoutPhoneNumber` | 電話番号が未登録のユーザーリストを取得。                       |
    | `registerNewUser`            | 新規ユーザーを生徒名簿に登録。                                 |
    | `updateUserProfile`          | ユーザーのプロフィール（本名、ニックネーム、電話番号）を更新。 |

- **`05-1_Backend_Read.js`**
  - **役割**: WebAppからのデータ取得要求（Read）に特化したバックエンド機能です。
  - **主要機能**:

    | 主要関数                       | 役割                                                             |
    | :----------------------------- | :--------------------------------------------------------------- |
    | `getSlotsAndMyBookings`        | WebAppに必要な予約枠と自分の予約情報を取得。                     |
    | `getReservationDetails`        | 会計画面に表示する詳細情報を取得。                               |
    | `getReservationDetailsForEdit` | 予約編集画面に必要な、予約の全詳細情報を取得。                   |
    | `getAccountingMasterData`      | 料金・商品マスタのデータを取得。                                 |
    | `getParticipationHistory`      | 指定された生徒の過去の参加履歴を、件数と開始位置を指定して取得。 |

- **`05-2_Backend_Write.js`**
  - **役割**: WebAppからのデータ書き込み・更新要求（Write）と、それに付随する検証ロジックに特化したバックエンド機能です。
  - **主要機能**:

    | 主要関数                        | 役割                                                     |
    | :------------------------------ | :------------------------------------------------------- |
    | `makeReservation`               | 予約を実行。                                             |
    | `cancelReservation`             | 予約をキャンセル。                                       |
    | `updateReservationDetails`      | 予約の詳細情報を一括で更新。                             |
    | `saveAccountingDetails`         | 会計詳細を保存。                                         |
    | `updateMemoAndGetLatestHistory` | 指定された予約の制作メモを更新し、最新の参加履歴を返す。 |

- **`09_Backend_Endpoints.js`**
  - **役割**: WebAppからの呼び出しを集約する統合エンドポイント。通信回数を削減し、UXを向上させます。
  - **主要機能**:

    | 主要関数                                   | 役割                                                           |
    | :----------------------------------------- | :------------------------------------------------------------- |
    | `getInitialWebApp_Data`                    | WebAppの初期化に必要な全てのデータを一度に取得。               |
    | `makeReservationAndGetLatestData`          | 予約を実行し、成功した場合、更新後の最新予約情報を返す。       |
    | `cancelReservationAndGetLatestData`        | 予約をキャンセルし、成功した場合、更新後の最新予約情報を返す。 |
    | `updateReservationDetailsAndGetLatestData` | 予約詳細を更新し、成功した場合、更新後の最新予約情報を返す。   |
    | `searchNoPhoneUsersByFilterForWebApp`      | 電話番号未登録ユーザーを検索するWebアプリ用エンドポイント。    |

---

### 3.5. 外部サービス連携

- **`06_ExternalServices.js`**
  - **役割**: GoogleフォームやGoogleカレンダーといった、スプレッドシートの「外」にあるGoogleサービスとの連携に特化した機能です。
  - **主要機能**:

    | 主要関数                                | 役割                                                                             |
    | :-------------------------------------- | :------------------------------------------------------------------------------- |
    | `setCheckboxChoices`                    | Googleフォームの予約選択肢を、現在の予約状況に基づいて更新。                     |
    | `createStringArrayFromCounts`           | フォーム選択肢用の文字列配列を、新しい定員管理ロジックに基づいて生成。           |
    | `addCalendarEventsToSheetWithSpecifics` | Googleカレンダーから予定を取得し、各教室の予約シートに新しい日付の予約枠を追加。 |

---

### 3.6. キャッシュ管理

- **`07_CacheManager.js`**
  - **役割**: 生徒名簿シートのキャッシュ列（参加回数や最新の制作メモなど）を更新する、重く独立したバッチ処理です。
  - **主要機能**:

    | 主要関数                          | 役割                                                                   |
    | :-------------------------------- | :--------------------------------------------------------------------- |
    | `updateRosterCache`               | メニューから呼び出される、キャッシュ更新プロセスのエントリーポイント。 |
    | `migrateAllRecordsToCache`        | 過去の全データをスキャンし、全生徒の「きろく」キャッシュを生成・更新。 |
    | `migrateAllFutureBookingsToCache` | 現在の全予約シートから、全生徒の「よやくキャッシュ」を生成・更新。     |

---

### 3.7. ユーティリティ

- **`08_Utilities.js`**
  - **役割**: プロジェクト全体で利用される、業務ドメインに依存しない汎用的なヘルパー関数です。
  - **主要機能**:

    | 主要関数                | 役割                                                                                                                             |
    | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
    | `createHeaderMap`       | ヘッダー行の配列から、ヘッダー名をキー、列インデックス(0-based)を値とするマップを作成。                                          |
    | `handleError`           | エラーまたは情報メッセージをログとUIに表示。                                                                                     |
    | `findRowIndexByValue`   | 指定された列の特定の値を持つ行のインデックスを見つける。                                                                         |
    | `include`               | WebAppのファイルをインクルードするためのヘルパー関数（Google Apps ScriptのHTMLサービスにおけるサーバーサイドインクルード機能）。 |
    | `logActivity`           | アプリケーションのアクティビティをログシートに記録。                                                                             |
    | `sendAdminNotification` | 管理者にメールで通知を送信。                                                                                                     |

---

### 3.8. Webアプリケーション (HTML/JavaScript)

- **`10_WebApp.html`**
  - **役割**: Webアプリケーション全体の骨格となるメインHTMLファイル。
  - **主要機能**: 基本的なHTML構造の定義、外部ライブラリの読み込みと設定、他のHTMLファイルのインクルード。

- **`11_WebApp_Config.html`**
  - **役割**: WebAppのフロントエンドで使用される、静的な設定値や定数を集約するファイル。
  - **主要機能**: `DesignConfig`オブジェクトによるUIスタイルの一元管理など。

- **`12_WebApp_Core.html`**
  - **役割**: WebAppのフロントエンドにおける中核的なロジックを担うファイル。状態管理、UIコンポーネント生成、汎用ユーティリティ、計算ロジックなどを集約します。
  - **主要機能**: `appState`による状態管理、`Components`によるUI部品生成、`calculateAccountingDetails`による会計計算。

- **`13_WebApp_Views.html`**
  - **役割**: アプリケーションの各画面（ビュー）のHTML構造を生成する関数群を専門に扱うファイル。
  - **主要機能**: `getLoginView`、`getBookingView`など、`appState`の状態に応じて画面のHTMLを返す。

- **`14_WebApp_Handlers.html`**
  - **役割**: ユーザーの操作（クリックなど）に応じた処理（アクション）と、アプリケーション全体の制御フローを管理するファイル。
  - **主要機能**: `actionHandlers`によるイベント処理、`google.script.run`によるサーバー通信、`setState`と`render`による画面更新。
