# データモデル定義

- **ファイル名:** `00-2_Data_Model.md`
- **バージョン:** 1.1
- **役割:** このプロジェクトで扱う主要なデータモデル（スプレッドシートの構造）を定義する。各シートの各列が持つ意味、データ型、制約、関連性を明文化する。
- **備考:** このファイルはコードとしての実行を目的としない、プロジェクトの「設計図」である。
- **v1.1での変更点:**
  - 「料金・商品マスタシート」の定義を、実際のヘッダーに合わせて修正。

---

## 1. 予約シート (例: 東京教室, つくば教室, 沼津教室)

各教室の予約情報を時系列で記録する主要なデータテーブル。

| ヘッダー名 (定数) | データ型 | 説明 |
|---|---|---|
| `予約ID` (`HEADER_RESERVATION_ID`) | `UUID (String)` | 各予約行を一位に特定するID。行挿入時に自動採番される。 |
| `生徒ID` (`HEADER_STUDENT_ID`) | `UUID (String)` | 予約者を示すID。「生徒名簿」シートの`生徒ID`と関連する。 |
| `日付` (`HEADER_DATE`) | `Date` | 予約日。この列を基準にソートされる。**必須項目**。 |
| `会場` (`HEADER_VENUE`) | `String` | 東京教室の場合のみ、カレンダーから自動入力される。 |
| `人数` (`HEADER_PARTICIPANT_COUNT`)| `Number` or `String`| 予約者の出席番号（1, 2, ...）。`waiting`, `cancel`という文字列も入る。 |
| `名前` (`HEADER_NAME`) | `String` | 予約者の名前（本名またはニックネーム）。入力されると`生徒ID`が自動補完される。**必須項目**。 |
| `回数` (`HEADER_CLASS_COUNT`) | `Number` | その予約時点での、その生徒の累計参加回数。名簿から自動入力される。 |
| `初講` (`HEADER_FIRST_LECTURE`) | `Boolean` | 初回講習の参加者であるかを示すフラグ (`TRUE`または空欄)。 |
| `早出` (`HEADER_EARLY_ARRIVAL`) | `Boolean` | 早出オプションの利用者であるかを示すフラグ (`TRUE`または空欄)。 |
| `彫刻刀レンタル` (`HEADER_CHISEL_RENTAL`)| `Boolean` | 彫刻刀レンタルの利用者であるかを示すフラグ (`TRUE`または空欄)。 |
| `受講時間` (`HEADER_TIME`) | `Number` | 時間制教室での課金対象時間。`開始時刻`と`終了時刻`から自動計算される。 |
| `制作メモ` (`HEADER_WORK_IN_PROGRESS`)| `String` | その日の作業内容のメモ。WebAppから編集可能。 |
| `order` (`HEADER_ORDER`) | `String` | 物販の購入希望など。WebAppから編集可能。 |
| `会計詳細` (`HEADER_ACCOUNTING_DETAILS`)| `JSON (String)` | WebAppの会計機能で記録された詳細な会計情報。JSON形式で保存される。 |
| `LINE`, `in the future`, `notes`, `from` | `String` | 生徒名簿と同期される、各種メモ情報。 |
| `開始時刻` (`HEADER_START_TIME`) | `Time` | 時間制教室での講座開始時刻。 |
| `終了時刻` (`HEADER_END_TIME`) | `Time` | 時間制教室での講座終了時刻。 |
| `休憩開始` (`HEADER_BREAK_START`) | `Time` | 時間制教室での休憩開始時刻（マスタ参照用）。 |
| `休憩終了` (`HEADER_BREAK_END`) | `Time` | 時間制教室での休憩終了時刻（マスタ参照用）。 |

## 2. 生徒名簿シート (`ROSTER_SHEET_NAME`)

全ての生徒の基本情報と、予約シートから同期されるキャッシュ情報を管理する。

| ヘッダー名 (定数) | データ型 | 説明 |
|---|---|---|
| `生徒ID` (`HEADER_STUDENT_ID`) | `UUID (String)` | 全ての生徒を一位に特定するID。**主キー**。初回予約時または新規登録時に自動採番。 |
| `本名` (`HEADER_REAL_NAME`) | `String` | 生徒の本名。 |
| `ニックネーム` (`HEADER_NICKNAME`) | `String` | WebApp上での表示名。空欄の場合は本名が使用される。 |
| `電話番号` (`HEADER_PHONE`) | `String` | WebAppのログイン認証に使用。先頭ゼロが消えないよう文字列として保存。 |
| `参加回数` (`HEADER_UNIFIED_CLASS_COUNT`)| `Number` | 全教室の累計参加回数。アーカイブ処理時に自動で加算される。 |
| `よやくキャッシュ` | `JSON (String)` | 未来の予約情報オブジェクトの配列をJSON文字列として保存するキャッシュ列。 |
| `きろく_YYYY` | `JSON (String)` | その年の参加日時、教室名、会場、制作メモ、会計詳細の配列をJSON文字列として保存するキャッシュ列。  **[設計思想]** 会計詳細は`予約シート`や`売上ログ`にも記録されるためデータとしては冗長だが、WebAppの「きろく」画面での会計詳細表示を高速化（サーバー通信を不要に）し、エラー発生リスクを最小化するため、意図的にキャッシュに含めている（非正規化）。 |
| `LINE`, `in the future`, `notes`, `from` | `String` | 各生徒に関する最新のメモ情報。予約シートから同期されるキャッシュデータ。 |

## 3. 料金・商品マスタシート (`ACCOUNTING_MASTER_SHEET_NAME`)

WebAppの会計機能で使用される、全ての料金体系と販売商品を定義する。

| ヘッダー名 | データ型 | 説明 |
|---|---|---|
| `種別` | `String` | `授業料`, `物販`, `材料`のいずれか。WebAppの会計画面の表示分類に使用。 |
| `項目名` | `String` | 料金や商品の名前（例：「本講座」「彫刻刀レンタル」「クスノキ」）。**主キー**。 |
| `単価` | `Number` | 料金または商品の単価。 |
| `単位` | `String` | 料金の単位（例：「30分」「cm³」）。時間制や体積計算のロジック分岐に使用。 |
| `対象教室` | `String` | その項目が適用される教室名。`共通`または特定の教室名を記述。 |
| `備考` | `String` | 割引の条件など、補足的な説明。旧`説明`列。 |
| `講座開始` | `Time` | 授業料タイプの項目における、講座の公式な開始時刻。 |
| `講座終了` | `Time` | 授業料タイプの項目における、講座の公式な終了時刻。 |
| `休憩開始` | `Time` | 時間制教室における、課金対象から除外する休憩時間の開始時刻。 |
| `休憩終了` | `Time` | 時間制教室における、課金対象から除外する休憩時間の終了時刻。 |

## 4. 予約サマリーシート (`SUMMARY_SHEET_NAME`)

WebAppの空席表示を高速化するための、集計済みデータ。`rebuildSummarySheet`または`updateSummarySheet`によって自動更新される。

| ヘッダー名 (定数) | データ型 | 説明 |
|---|---|---|
| `ユニークキー` (`HEADER_SUMMARY_UNIQUE_KEY`)| `String` | `日付_教室名_セッション`の形式。この行を一位に特定するID。 |
| `日付` (`HEADER_DATE`) | `Date` | 予約日。 |
| `教室名` (`HEADER_SUMMARY_CLASSROOM`)| `String` | 教室名。 |
| `セッション` (`HEADER_SUMMARY_SESSION`)| `String` | `午前`, `午後`, `全日`, `本講座`, `初回講習`のいずれか。 |
| `会場` (`HEADER_SUMMARY_VENUE`) | `String` | 教室の開催場所。 |
| `定員` (`HEADER_SUMMARY_CAPACITY`) | `Number` | そのセッションの定員。 |
| `予約数` (`HEADER_SUMMARY_RESERVATION_COUNT`)| `Number` | 現在の予約者数。 |
| `空席数` (`HEADER_SUMMARY_AVAILABLE_COUNT`)| `Number` | `定員 - 予約数`で算出される空席数。 |
| `最終更新日時` (`HEADER_SUMMARY_LAST_UPDATED`)| `Timestamp` | この行が最後に更新された日時。 |
