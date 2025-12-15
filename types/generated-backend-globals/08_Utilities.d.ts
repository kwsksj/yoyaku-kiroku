/**
 * ScriptPropertiesの取得を共通化
 * @returns {GoogleAppsScript.Properties.Properties}
 */
export function getScriptProperties(): GoogleAppsScript.Properties.Properties;
/**
 * 予約データの事前バリデーション（パフォーマンス最適化）
 * 冗長なデータ検証を削減するため、一度だけ全体構造を検証
 * @param {any[]} reservations - 予約データ配列
 * @returns {any[]} 有効な予約データのみを含む配列
 */
export function validateReservationsStructure(reservations: any[]): any[];
/**
 * ヘッダー行の配列から、ヘッダー名をキー、列インデックス(0-based)を値とするマップを作成します。
 * @param {string[]} headerRow - ヘッダーの行データ
 * @returns {HeaderMapType}
 */
export function createHeaderMap(headerRow: string[]): HeaderMapType;
/**
 * エラーまたは情報メッセージをログとUIに表示します。
 * @param {string} message - 表示する
 * @param {boolean} isError - エラーかどうか
 */
export function handleError(message: string, isError: boolean): void;
/**
 * 指定された列の特定の値を持つ行のインデックスを見つけます。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象シート
 * @param {number} col - 検索対象の列番号 (1-based)
 * @param {*} value - 検索する値
 * @returns {number} - 見つかった行のインデックス (1-based)。見つからない場合は-1。
 */
export function findRowIndexByValue(sheet: GoogleAppsScript.Spreadsheet.Sheet, col: number, value: any): number;
/**
 * 売上表に書き込むための単一の行データを作成する。
 * @param {SalesBaseInfo} baseInfo - 日付、名前などの基本情報。
 * @param {string} category - '授業料' or '物販'
 * @param {string} itemName - 商品名や授業内容。
 * @param {number} price - 金額。
 * @returns {SalesRowArray} 売上表の1行分の配列。
 */
export function createSalesRow(baseInfo: SalesBaseInfo, category: string, itemName: string, price: number): SalesRowArray;
/**
 * アプリケーションのアクティビティをログシートに記録します（新フォーマット）。
 * 新しい行は常に2行目に挿入されます。
 * 本名とニックネームはスプレッドシートのARRAYFORMULAによって自動的に表示されます。
 *
 * 【新フォーマット列構成】
 * A: タイムスタンプ, B: ユーザーID, C: 本名（ARRAYFORMULA）, D: ニックネーム（ARRAYFORMULA）,
 * E: アクション, F: 結果, G: 教室名, H: 予約ID, I: 日付, J: メッセージ, K: 詳細情報
 *
 * @param {string} userId - 操作を行ったユーザーのID。'system'なども可。
 * @param {string} action - 操作の種類（CONSTANTS.LOG_ACTIONSを使用）。
 * @param {string} result - 操作の結果 ('成功' or '失敗')。
 * @param {Object|string} [optionsOrDetails] - オプションオブジェクトまたは詳細文字列（後方互換性のため）
 */
export function logActivity(userId: string, action: string, result: string, optionsOrDetails?: any | string): void;
/**
 * ログシートシートに、定義済みの条件付き書式を一括で設定します。
 * F列は自身の値、G列はE列の値に基づいて背景色が設定されます。
 * 実行前に既存のルールはすべてクリアされるため、常に新しい状態でルールが適用されます。
 */
export function setupConditionalFormattingForLogSheet(): void;
/**
 * 予約操作の権限バリデーションを行う共通関数
 * @param {ReservationCore | null} reservation - 対象の予約オブジェクト
 * @param {string} studentId - 操作を実行しようとしているユーザーのID
 * @param {boolean} [isByAdmin=false] - 管理者による操作かどうか
 * @param {string | null} [adminToken=null] - 管理者トークン
 * @throws {Error} 権限がない場合や予約が存在しない場合にエラーをスロー
 */
export function validateUserOperation(reservation: ReservationCore | null, studentId: string, isByAdmin?: boolean, adminToken?: string | null): void;
/**
 * 配列形式の予約データをオブジェクト形式に変換
 * フロントエンドの transformReservationArrayToObject と同じロジック
 * @param {RawSheetRow} resArray - 配列形式の予約データ
 * @returns {ReservationCore|null} オブジェクト形式の予約データ（生データ）
 */
export function transformReservationArrayToObject(resArray: RawSheetRow): ReservationCore | null;
/**
 * ヘッダーマップを使用して予約配列データをオブジェクトに変換します
 * @param {RawSheetRow} resArray - 予約データの配列
 * @param {Map<string, number>} headerMap - ヘッダー名とインデックスのマッピング
 * @param {Record<string, UserCore>} [studentsMap={}] - 全生徒のマップ（パフォーマンス最適化用）
 * @returns {ReservationCore|null} - 変換された予約オブジェクト、失敗時はnull
 */
export function transformReservationArrayToObjectWithHeaders(resArray: RawSheetRow, headerMap: Map<string, number>, studentsMap?: Record<string, UserCore>): ReservationCore | null;
/**
 * 生データの予約オブジェクトを正規化済みオブジェクトに変換
 * @param {RawReservationObject} rawReservation - 生データの予約オブジェクト
 * @returns {ReservationObject|null} 正規化済み予約オブジェクト
 */
export function normalizeReservationObject(rawReservation: RawReservationObject): ReservationObject | null;
/**
 * スクリプトロックを利用して処理をアトミックに実行する
 * @template T
 * @param {TransactionCallback<T>} callback - 実行する処理
 * @returns {T} callbackの戻り値
 */
export function withTransaction<T>(callback: TransactionCallback<T>): T;
/**
 * シートからヘッダーとデータを一度に取得する共通関数。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のシート
 * @returns {SheetDataResult} - { header, headerMap, allData, dataRows }
 */
export function getSheetData(sheet: GoogleAppsScript.Spreadsheet.Sheet): SheetDataResult;
/**
 * シートからヘッダーとデータを一度に取得し、指定した条件でレコードを検索する共通関数。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のシート
 * @param {string} searchColumn - 検索対象のヘッダー名
 * @param {string|number|Date|boolean|null} searchValue - 検索する値
 * @returns {SheetSearchResult} - { header, headerMap, allData, dataRows, foundRow, rowIndex, searchColIdx }
 */
export function getSheetDataWithSearch(sheet: GoogleAppsScript.Spreadsheet.Sheet, searchColumn: string, searchValue: string | number | Date | boolean | null): SheetSearchResult;
/**
 * 特定日・教室の正規化済み予約データを取得する（推奨API）
 * @param {string} date - 検索対象の日付（yyyy-MM-dd形式）
 * @param {string} classroom - 教室名
 * @param {string} status - ステータス（省略可、デフォルトは確定済み予約のみ）
 * @returns {ReservationCore[]} 条件に合致する正規化済み予約配列
 */
export function getNormalizedReservationsFor(date: string, classroom: string, status?: string): ReservationCore[];
/**
 * 生徒IDから生徒情報を取得する
 * @param {string} studentId - 生徒ID
 * @returns {StudentData|null} 生徒オブジェクト、見つからない場合はnull
 */
export function getCachedStudentById(studentId: string): StudentData | null;
/**
 * 予約配列データを統一的にオブジェクト配列に変換する
 * @param {RawSheetRow[]} reservations - 予約配列データ
 * @param {Map<string, number>} headerMap - ヘッダーマップ
 * @param {Record<string, UserCore>} [studentsMap={}] - 全生徒のマップ（パフォーマンス最適化用）
 * @returns {ReservationCore[]} 変換済み予約オブジェクト配列
 */
export function convertReservationsToObjects(reservations: RawSheetRow[], headerMap: Map<string, number>, studentsMap?: Record<string, UserCore>): ReservationCore[];
/**
 * キャッシュから全ての予約データを取得し、オブジェクトの配列として返す
 * @param {Record<string, UserCore>=} studentsMapOverride - 事前取得済みの生徒マップ。
 *   指定時はキャッシュ読み込みを省略して再利用する（パフォーマンス最適化）。
 *   未指定の場合は内部でgetStudentCacheSnapshotを呼び出す。
 * @returns {ReservationCore[]} 変換済みの予約オブジェクト配列
 */
export function getCachedReservationsAsObjects(studentsMapOverride?: Record<string, UserCore> | undefined): ReservationCore[];
/**
 * 予約IDを指定して、キャッシュから単一のReservationCoreオブジェクトを取得する
 * @param {string} reservationId - 取得する予約のID
 * @returns {ReservationCore | null} ReservationCoreオブジェクト、見つからない場合はnull
 */
export function getReservationCoreById(reservationId: string): ReservationCore | null;
/**
 * ヘッダーマップから安全にインデックスを取得する
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @param {string} headerName - ヘッダー名
 * @returns {number|undefined} 列インデックス
 */
export function getHeaderIndex(headerMap: HeaderMapType, headerName: string): number | undefined;
/**
 * 電話番号を正規化します（全角→半角、ハイフン削除、バリデーション）
 * @param {string} phoneInput - 入力された電話番号
 * @returns {PhoneNormalizationResult} 正規化結果
 */
export function normalizePhoneNumber(phoneInput: string): PhoneNormalizationResult;
/**
 * 電話番号を表示用にフォーマットします（3-4-4桁区切り）
 * @param {string} phoneNumber - 正規化済み電話番号
 * @returns {string} フォーマット済み電話番号
 */
export function formatPhoneNumber(phoneNumber: string): string;
/**
 * Sheets生データ（配列）→ UserCore に変換
 *
 * Google Sheetsから取得した配列データを統一Core型に変換
 * Phase 3: 型システム統一の一環として実装
 *
 * @param {RawSheetRow} row - Sheets生データ（配列）
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @returns {UserCore} 統一Core型のユーザーデータ
 */
export function convertRowToUser(row: RawSheetRow, headerMap: HeaderMapType): UserCore;
/**
 * UserCore → Sheets行データ（配列）に変換
 *
 * 統一Core型からSheets書き込み用の配列データに変換
 * Phase 3: 型システム統一の一環として実装
 *
 * @param {UserCore} user - 統一Core型のユーザーデータ
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @returns {RawSheetRow} Sheets書き込み用配列データ
 */
export function convertUserToRow(user: UserCore, headerMap: HeaderMapType): RawSheetRow;
/**
 * ReservationCore → Sheets行データ（配列）に変換
 *
 * 統一Core型からSheets書き込み用の配列データに変換
 *
 * @param {ReservationCore} reservation - 統一Core型の予約データ
 * @param {HeaderMapType} headerMap - ヘッダーマップ
 * @param {string[]} header - ヘッダー配列（列数決定用）
 * @returns {RawSheetRow} Sheets書き込み用配列データ
 */
export function convertReservationToRow(reservation: ReservationCore, headerMap: HeaderMapType, header: string[]): RawSheetRow;
/**
 * 予約データの行配列を多段階ソートします
 *
 * ソート順序:
 * 1. 日付順（降順: 新しい日付が上）
 * 2. ステータス順（完了=確定 > 待機 > 取消）
 * 3. 開始時間順（昇順: 早い時間が上）
 * 4. 終了時間順（昇順: 早い時間が上）
 * 5. 初回順（初回=true > 空白/false）
 *
 * @param {Array<Array<string|number|Date>>} rows - ソート対象の行配列
 * @param {Map<string, number>|Record<string, number>} headerMap - ヘッダー列マップ
 * @returns {Array<Array<string|number|Date>>} ソート済み行配列
 */
export function sortReservationRows(rows: Array<Array<string | number | Date>>, headerMap: Map<string, number> | Record<string, number>): Array<Array<string | number | Date>>;
/**
 * 生徒名簿の特定のフィールドを更新するヘルパー関数
 * @param {string} studentId - 生徒ID
 * @param {string} headerName - 更新する列のヘッダー名（CONSTANTS.HEADERS.ROSTER.* を使用）
 * @param {string | number | boolean} value - 新しい値
 * @returns {{success: boolean, message: string}}
 */
export function updateStudentField(studentId: string, headerName: string, value: string | number | boolean): {
    success: boolean;
    message: string;
};
export namespace PerformanceLog {
    /**
     * デバッグログ（開発環境でのみ出力）
     */
    function debug(message: string, ...args: any[]): void;
    /**
     * 情報ログ（重要な処理完了時のみ出力）
     */
    function info(message: string, ...args: any[]): void;
    /**
     * エラーログ（常に出力）
     */
    function error(message: string, ...args: any[]): void;
    /**
     * パフォーマンス測定
     */
    function performance(operation: string, startTime: number): void;
}
