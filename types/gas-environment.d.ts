/**
 * GAS環境用グローバル型定義
 * GASの特殊な実行環境（全ファイルがグローバルスコープ）に対応
 */

// GAS環境では全てのファイルがグローバルスコープで実行される
// 同名の定数・関数・クラスは意図的にグローバル共有される

// SpreadsheetManagerクラス（バックエンド・フロントエンド共通）
declare class SpreadsheetManager {
  constructor();
  getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
  getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
  clearCache(): void;
}

// GAS型の正しい定義（重複エラー解消）
declare type Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;
declare type Sheet = GoogleAppsScript.Spreadsheet.Sheet;

// グローバルインスタンス
declare var SS_MANAGER: SpreadsheetManager;

// 定数群はtypes/constants.d.tsで統一管理されています
// GAS環境では00_Constants.jsで実際に定義されます
declare var SCHEDULE_STATUS_CANCELLED: string;
declare var SCHEDULE_STATUS_COMPLETED: string;
declare var SCHEDULE_STATUS_SCHEDULED: string;
declare var DEBUG_ENABLED: boolean;

// Logger関数（GAS環境用拡張）
declare namespace Logger {
  function log(
    message: unknown,
    level?: string,
    context?: string,
    timestamp?: Date,
  ): void;
}

// HTML内JavaScript用グローバル関数宣言
declare function showToast(message: string, title?: string): void;
declare function showError(message: string, title?: string): void;

// GAS特有のグローバルオブジェクト
declare var global: Record<string, unknown>;

// 関数重複定義の許可（意図的な場合）
declare function getUserHistoryFromCache(): ReservationDataArray;
declare function getUserReservationsFromCache(): ReservationDataArray;
declare function createSampleScheduleData(): ScheduleDataArray;

// スケジュールマスタデータ型定義（グローバルスコープ）
declare global {
  interface ScheduleMasterData {
    date: Date | string;
    classroom: string;
    venue?: string;
    classroomType?: string;
    status?: string;
    firstStart?: string | Date;
    firstEnd?: string | Date;
    secondStart?: string | Date;
    secondEnd?: string | Date;
    beginnerStart?: string | Date;
    totalCapacity?: number | string;
    beginnerCapacity?: number | string;
    [key: string]: unknown;
  }

  type ScheduleDataArray = Array<ScheduleMasterData>;

  interface ReservationData {
    reservationId: string;
    studentId: string;
    date: string;
    classroom: string;
    venue?: string;
    startTime: string;
    endTime: string;
    status: string;

    // 実際に使用される動的プロパティ
    discountApplied?: boolean | string;
    計算時間?: number;

    // 限定的なインデックスシグネチャ（materialTypeN等用）
    [key: `material${string}`]: unknown;
    [key: `otherSales${string}`]: unknown;
  }

  type ReservationDataArray = Array<ReservationData>;

  // Google Sheets由来の生データ型（2次元配列）
  type ReservationRawDataArray = Array<Array<string | number | Date | boolean | null>>;

  // キャッシュ関連型定義
  interface CacheDataStructure {
    version: number;
    [key: string]: unknown;
  }

  interface ReservationCacheData extends CacheDataStructure {
    reservations: ReservationRawDataArray;
    headerMap?: { [key: string]: number };
    metadata?: {
      totalCount: number;
      lastUpdated: string;
      isChunked?: boolean;
      totalChunks?: number;
    };
  }

  interface ScheduleCacheData extends CacheDataStructure {
    schedule: ScheduleDataArray;
    dateRange?: {
      from: string;
      to: string;
      cached: string;
    };
  }

  interface AccountingCacheData extends CacheDataStructure {
    items: AccountingMasterItem[];
  }

  interface StudentCacheData extends CacheDataStructure {
    students: { [studentId: string]: StudentData };
    metadata?: {
      totalCount: number;
      lastUpdated: string;
    };
  }

  // 分割キャッシュ用型定義
  interface ChunkedCacheMetadata {
    version: number;
    totalChunks: number;
    totalCount: number;
    headerMap?: { [key: string]: number };
    isChunked: true;
    lastUpdated: string;
  }

  interface ChunkData {
    chunkIndex: number;
    data: any[];
    version: number;
  }

  // キャッシュ情報型定義
  interface CacheInfo {
    exists: boolean;
    version: number | null;
    dataCount: number | null;
    isChunked?: boolean;
    totalChunks?: number | null;
    error?: string;
  }

  interface PersonalDataResult {
    myReservations: ReservationDataArray;
  }

  interface UserRegistrationResult {
    studentId: string;
    displayName: string;
    message: string;
  }

  interface UserProfileUpdateResult {
    updatedUser: {
      studentId: string;
      displayName: string;
      realName: string;
      phone: string;
      [key: string]: unknown;
    };
  }

  // シートデータ検索結果型定義
  interface SheetSearchResult {
    header: string[];
    headerMap: Map<string, number>;
    allData: (string | number | Date | boolean | null)[][];
    dataRows: (string | number | Date | boolean | null)[][];
    foundRow: (string | number | Date | boolean | null)[] | undefined;
    rowIndex: number;
    searchColIdx: number;
  }

  // シートデータ取得結果型定義
  interface SheetDataResult {
    header: string[];
    headerMap: Map<string, number>;
    allData: (string | number | Date | boolean | null)[][];
    dataRows: (string | number | Date | boolean | null)[][];
  }

  // 日程マスタルール型定義
  interface ScheduleRule {
    [key: string]: unknown;
    type?: string;
    classroomType?: string;
    firstEnd?: string;
    secondStart?: string;
  }

  // 売上ログ基本情報型定義
  interface SalesBaseInfo {
    date: Date | string;
    studentId: string;
    name: string;
    classroom: string;
    venue: string;
    paymentMethod: string;
  }

  // 会計マスタデータ型定義（実際のスプレッドシート構造に対応）
  interface AccountingMasterItem {
    // 英語プロパティ（将来的に移行予定）
    item?: string;
    price?: number;
    unit?: string;
    type?: string;
    classroom?: string;

    // 日本語プロパティ（現在実際に使用されている - CONSTANTS.HEADERS.ACCOUNTINGに対応）
    '種別': string;        // CONSTANTS.HEADERS.ACCOUNTING.TYPE
    '項目名': string;      // CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME
    '対象教室': string;    // CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM
    '単価': number;       // CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE
    '単位': string;       // CONSTANTS.HEADERS.ACCOUNTING.UNIT
    '備考'?: string;      // CONSTANTS.HEADERS.ACCOUNTING.NOTES

    // インデックス シグネチャでCONSTANTS.HEADERS.ACCOUNTINGアクセスに対応
    [key: string]: any;
  }

  // 生徒データ型定義
  interface StudentData {
    studentId: string;
    displayName: string;
    realName?: string;
    phone?: string;
    email?: string;
    wantsEmail?: boolean;
    rowIndex?: number;
    [key: string]: unknown;
  }

  // 操作結果型定義
  interface OperationResult {
    success: boolean;
    message?: string;
    data?: unknown;
  }

  // API応答型定義
  interface ApiResponseGeneric<T = any> {
    success: boolean;
    data?: T;
    message?: string;
  }

  // バッチデータ結果型定義
  interface BatchDataResult {
    success: boolean;
    data: {
      initial?: unknown;
      lessons?: ScheduleMasterData[];
      myReservations?: ReservationDataArray[];
      [key: string]: unknown;
    };
    userFound?: boolean;
    user?: StudentData | null;
    commandRecognized?: boolean | string;
  }

  // 予約情報型定義
  interface ReservationInfo {
    studentId: string;
    options?: {
      firstLecture?: boolean;
    };
    [key: string]: unknown;
  }

  // キャンセル情報型定義
  interface CancelInfo {
    studentId: string;
    [key: string]: unknown;
  }

  // 予約詳細更新型定義
  interface ReservationDetails {
    studentId: string;
    reservationId?: string;
    workInProgress?: string;
    [key: string]: unknown;
  }

  // エラーメッセージマップ型定義
  interface ErrorMessages {
    makeReservation: string;
    cancelReservation: string;
    updateReservation: string;
    [key: string]: string;
  }

  // スケジュール情報パラメータ型定義
  interface ScheduleInfoParams {
    date: string;
    classroom: string;
  }

  // 会計詳細型定義
  interface AccountingDetails {
    tuition: {
      items: AccountingMasterItem[];
      subtotal: number;
    };
    sales: {
      items: AccountingMasterItem[];
      subtotal: number;
    };
    grandTotal: number;
    paymentMethod: string;
  }

  // 会計処理ペイロード型定義
  interface AccountingPayload {
    studentId: string;
    reservationId?: string;
    classroom?: string;
    userInput?: Record<string, unknown>;
    [key: string]: unknown;
  }
}

// キャッシュ関連の関数宣言
declare function getCachedData(key: string): CacheDataStructure | null;
declare var CACHE_KEYS: {
  MASTER_SCHEDULE_DATA: string;
  ALL_RESERVATIONS: string;
  ALL_STUDENTS_BASIC: string;
  MASTER_ACCOUNTING_DATA: string;
  [key: string]: string;
};

// GASイベント型定義（トリガー関数用）
declare namespace GoogleAppsScript {
  namespace Events {
    // シート変更イベント
    interface SheetsOnChange {
      changeType: string;
      source: GoogleAppsScript.Spreadsheet.Spreadsheet;
      user?: GoogleAppsScript.Base.User;
    }

    // シート編集イベント
    interface SheetsOnEdit {
      source: GoogleAppsScript.Spreadsheet.Spreadsheet;
      range: GoogleAppsScript.Spreadsheet.Range;
      user?: GoogleAppsScript.Base.User;
      value?: string | number | Date | boolean | null;
      oldValue?: string | number | Date | boolean | null;
    }
  }
}

// バッチ処理・データ移行用型定義
declare global {
  // データ移行用行データ型定義
  interface MigratedRowData
    extends Array<string | Date | boolean | number | null> {
    [index: number]: string | Date | boolean | number | null;
  }

  // 移行データ配列型定義
  type MigratedDataArray = MigratedRowData[];

  // ヘッダーマップ型定義
  interface HeaderMap extends Map<string, number> {}

  // バッチ処理結果型定義
  interface BatchProcessResult {
    success: boolean;
    processedCount: number;
    errorCount: number;
    message?: string;
  }

  // データ検証結果型定義
  interface DataVerificationResult {
    isValid: boolean;
    originalCount: number;
    migratedCount: number;
    message: string;
  }
}

// エラーハンドリングシステム用型定義
declare global {
  // エラー情報構造型定義
  interface ErrorInfo {
    message: string;
    stack: string;
    context: string;
    timestamp: string;
    additionalInfo: Record<string, unknown>;
    type: string;
  }

  // APIレスポンス用型定義（詳細版）
  interface ApiErrorResponse {
    success: false;
    message: string;
    meta: {
      timestamp: string;
      context: string;
      errorId: string;
    };
    debug?: Record<string, unknown>;
  }

  interface ApiSuccessResponse<T = any> {
    success: true;
    data: T;
    message: string;
    meta: {
      timestamp: string;
      version: number;
    };
  }

  // 統一APIレスポンス型
  type UnifiedApiResponse<T = unknown> =
    | ApiSuccessResponse<T>
    | ApiErrorResponse;

  // エラーハンドラー関数型定義
  interface BackendErrorHandler {
    handle(
      error: Error,
      context?: string,
      additionalInfo?: Record<string, unknown>,
    ): ApiErrorResponse;
    createErrorResponse(
      message: string,
      context: string,
      errorInfo: ErrorInfo,
    ): ApiErrorResponse;
    isDevelopmentMode(): boolean;
    generateErrorId(): string;
    notifyAdmin(errorInfo: ErrorInfo, isCritical?: boolean): void;
  }

  // createApiResponse用データ型定義
  interface ApiResponseData {
    data?: unknown;
    message?: string;
    context?: string;
    debug?: Record<string, unknown>;
  }
}

// 外部サービス連携（メール送信）用型定義
declare global {
  // メールテンプレートデータ型定義
  interface EmailTemplate {
    subject: string;
    htmlBody?: string;
    textBody: string;
  }

  // 予約情報（メール用）型定義
  interface ReservationForEmail {
    date: string | Date;
    classroom: string;
    venue?: string;
    startTime?: string | Date;
    endTime?: string | Date;
    options?: {
      firstLecture?: boolean;
      [key: string]: unknown;
    };
    isWaiting?: boolean;
  }

  // 生徒情報（メール送信用）型定義
  interface StudentWithEmail extends StudentData {
    email: string;
    wantsEmail?: boolean;
  }

  // 予約情報（システム内部用）型定義
  interface ReservationInfo {
    studentId: string;
    date: string;
    classroom: string;
    venue?: string;
    startTime?: string | Date;
    endTime?: string | Date;
    isWaiting?: boolean;
    options?: {
      firstLecture?: boolean;
      [key: string]: unknown;
    };
  }

  // 会計マスタキャッシュデータ型定義
  interface AccountingCacheData extends CacheDataStructure {
    items: AccountingMasterItem[];
  }

  // 授業料金表示情報型定義
  interface TuitionInfo {
    itemName: string;
    price: number;
    unit?: string;
    displayText: string;
  }
}

// ユーティリティ関数宣言
declare function getCachedReservationsFor(
  date: string,
  classroom: string,
  status: string,
): CachedReservationResult[];
declare function getHeaderIndex(
  headerMap: HeaderMapType,
  headerName: string,
): number | undefined;
declare function getCachedStudentById(studentId: string): StudentData | null;
declare function createSalesRow(
  baseInfo: SalesBaseInfo,
  type: string,
  name: string,
  price: number,
): SalesRowArray;

// 08_Utilities.js用追加型定義
declare global {
  // 電話番号正規化結果型定義
  interface PhoneNormalizationResult {
    normalized: string;
    isValid: boolean;
    error?: string;
  }

  // ヘッダーマップ型定義（主にRecord型として使用、Mapも許可）
  type HeaderMapType = Record<string, number> | Map<string, number>;

  // 予約配列データ型定義
  type ReservationArrayData = Array<string | Date | boolean | number | null>;

  // 生データ（Google Sheets由来）の予約オブジェクト型定義
  // Google Sheetsの実際のデータ形式に基づく適切な型定義
  interface RawReservationObject {
    reservationId?: string | null; // IDは文字列
    studentId?: string | null; // IDは文字列
    date?: string | Date | null; // 日付は文字列またはDate
    classroom?: string | null; // 教室名は文字列
    venue?: string | null; // 会場は文字列
    startTime?: string | Date | null; // 時間は文字列またはDate
    endTime?: string | Date | null; // 時間は文字列またはDate
    status?: string | null; // ステータスは文字列
    chiselRental?: string | boolean | null; // 彫刻刀レンタルは文字列またはboolean
    firstLecture?: string | boolean | null; // 初回講義は文字列またはboolean
    workInProgress?: string | null; // 作業中は文字列
    order?: string | null; // 販売品注文内容は文字列
    messageToTeacher?: string | null; // メッセージは文字列
  }

  // 正規化済み予約オブジェクト型定義（アプリケーション内部で使用）
  interface ReservationObject {
    reservationId: string;
    studentId: string;
    date: string;
    classroom: string;
    venue?: string;
    startTime: string;
    endTime: string;
    status: string;
    chiselRental: boolean;
    firstLecture: boolean;
    workInProgress?: string;
    order?: string;
    messageToTeacher?: string;

    // 実際に使用される動的プロパティ
    discountApplied?: boolean | string;
    計算時間?: number;

    // 限定的なインデックスシグネチャ（materialTypeN等用）
    [key: `material${string}`]: unknown;
    [key: `otherSales${string}`]: unknown;
  }

  // 予約キャッシュ検索結果型定義
  interface CachedReservationResult {
    data: ReservationArrayData;
  }

  // 売上ログ行型定義
  type SalesRowArray = Array<string | Date | number>;

  // キャッシュ内予約データ構造型定義
  interface CachedReservationData {
    reservations: ReservationArrayData[];
    headerMap: { [key: string]: number };
    metadata?: {
      totalCount: number;
      lastUpdated: string;
    };
  }

  // キャッシュ内生徒データ構造型定義
  interface CachedStudentData {
    students: { [studentId: string]: StudentData };
    metadata?: {
      totalCount: number;
      lastUpdated: string;
    };
  }

  // ヘッダーマップアクセス関数型定義
  interface HeaderMapAccessor {
    (headerName: string): number | undefined;
  }

  // withTransaction用コールバック型定義
  interface TransactionCallback<T = unknown> {
    (): T;
  }
}

export {};
