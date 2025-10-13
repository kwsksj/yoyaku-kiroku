/**
 * =================================================================
 * 【ファイル名】: types/core/common.d.ts
 * 【役割】: Core層共通型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/**
 * 生シート行データ型
 *
 * Google Sheetsから取得した1行のデータ
 * convertRowToReservation()やconvertRowToUser()で各Core型に変換する
 */
type RawSheetRow = Array<string | Date | boolean | number | null>;

/**
 * ヘッダーマップ型
 *
 * カラム名とインデックスの対応マップ
 * RecordまたはMapとして使用可能
 *
 * @example
 * ```typescript
 * const headerMap: HeaderMapType = {
 *   '予約ID': 0,
 *   '生徒ID': 1,
 *   '教室名': 2,
 * };
 * ```
 */
type HeaderMapType = Record<string, number> | Map<string, number>;

/**
 * AppInitialData（アプリ初期化データ）
 *
 * ログイン時にフロントエンドへ送信される全データ
 */
interface AppInitialData {
  /** 全生徒データ（生徒ID → UserCore） */
  allStudents: Record<string, UserCore>;

  /** 開催セッション一覧 */
  sessions?: SessionCore[];

  /** 自分の予約一覧 */
  myReservations?: ReservationCore[];

  /** 会計マスターデータ */
  accountingMaster?: AccountingMasterItemCore[];

  /** キャッシュバージョン情報 */
  cacheVersions?: Record<string, string>;

  /** 今日の日付（YYYY-MM-DD） */
  today?: string;
}

/**
 * ApiResponse（汎用APIレスポンス）
 *
 * バックエンド関数の返り値として使用
 */
interface ApiResponse<T = any> {
  /** 成功フラグ */
  success: boolean;

  /** レスポンスデータ */
  data?: T;

  /** メッセージ */
  message?: string;
}

/**
 * ApiResponseGeneric（型付きAPIレスポンス）
 *
 * @deprecated ApiResponse<T>を使用してください
 */
type ApiResponseGeneric<T = any> = ApiResponse<T>;

// --- Cache-related types ---

interface CacheDataStructure {
  version: number;
  [key: string]: unknown;
}

interface ReservationCacheData extends CacheDataStructure {
  reservations: RawSheetRow[];
  headerMap?: { [key: string]: number };
  reservationIdIndexMap?: { [key: string]: number };
  metadata?: {
    totalCount: number;
    lastUpdated: string;
    isChunked?: boolean;
    totalChunks?: number;
  };
}

interface ScheduleCacheData extends CacheDataStructure {
  schedule: LessonCore[];
  dateRange?: {
    from: string;
    to: string;
    cached: string;
  };
}

interface AccountingCacheData extends CacheDataStructure {
  items: AccountingMasterItemCore[];
}

interface StudentCacheData extends CacheDataStructure {
  students: { [studentId: string]: UserCore };
  metadata?: {
    totalCount: number;
    lastUpdated: string;
  };
}

// --- 旧型定義（後方互換性のため一時的に維持） ---

/**
 * @deprecated ReservationCoreを使用してください
 */
type ReservationData = ReservationCore;

/**
 * @deprecated ReservationCoreを使用してください
 */
type ReservationObject = ReservationCore;

/**
 * @deprecated AccountingDetailsCoreを使用してください
 */
type AccountingDetails = AccountingDetailsCore;

/**
 * @deprecated UserCoreを使用してください
 */
type StudentData = UserCore;

/**
 * @deprecated LessonCoreを使用してください
 */
type ScheduleMasterData = LessonCore;

/**
 * @deprecated AccountingMasterItemCoreを使用してください
 */
type AccountingMasterItem = AccountingMasterItemCore;

/**
 * @deprecated RawSheetRow[]を使用してください
 */
type ReservationRawDataArray = RawSheetRow[];

/**
 * @deprecated RawSheetRow[]を使用してください
 */
type ReservationArrayData = RawSheetRow[];

/**
 * @deprecated RawSheetRowを使用してください
 */
type SalesRowArray = RawSheetRow;

/**
 * 売上情報の基本型
 */
interface SalesBaseInfo {
  /** 予約ID (optional) */
  reservationId?: string;
  /** 生徒ID */
  studentId: string;
  /** 教室名 */
  classroom: string;
  /** 日付 */
  date: string | Date;
  /** 生徒名 */
  studentName?: string;
  /** 名前（表示用） */
  name?: string;
  /** 会場 */
  venue?: string;
  /** 授業料 (optional) */
  tuitionTotal?: number;
  /** 物販合計 (optional) */
  salesTotal?: number;
  /** 合計金額 (optional) */
  grandTotal?: number;
  /** 支払方法 */
  paymentMethod: string;
  /** 備考 */
  notes?: string;
}

/**
 * 未定義オブジェクトの型（一時的な互換性対応）
 */
interface RawReservationObject {
  [key: string]: any;
}

/**
 * トランザクションコールバック型
 */
type TransactionCallback<T> = () => T;

/**
 * シートデータ取得結果
 */
interface SheetDataResult<T = any> {
  /** 成功フラグ */
  success: boolean;
  /** データ */
  data?: T;
  /** エラーメッセージ */
  message?: string;
}

/**
 * シート検索結果
 */
interface SheetSearchResult<T = any> {
  /** 成功フラグ */
  success: boolean;
  /** 検索結果 */
  results?: T[];
  /** エラーメッセージ */
  message?: string;
}

/**
 * 電話番号正規化結果
 */
interface PhoneNormalizationResult {
  /** 正規化された電話番号 */
  normalized: string;
  /** 元の電話番号 */
  original: string;
  /** 成功フラグ */
  success: boolean;
}

/**
 * @deprecated PhoneNormalizationResultを使用してください
 */
type PhoneNumberNormalizationResult = PhoneNormalizationResult;

/**
 * ユーザープロフィール更新結果
 */
interface UserProfileUpdateResult {
  /** メッセージ */
  message: string;
  /** 更新されたユーザー情報 */
  updatedUser: UserCore;
}

/**
 * スケジュール情報パラメータ
 */
interface ScheduleInfoParams {
  /** 教室名 */
  classroom: string;
  /** 日付 */
  date: string;
}

/**
 * チャンクキャッシュメタデータ
 */
interface ChunkedCacheMetadata {
  /** バージョン */
  version: number;
  /** データ数 */
  dataCount?: number;
  /** データ総数 */
  totalCount?: number;
  /** チャンク数 */
  totalChunks: number;
  /** 最終更新日時 */
  lastUpdated: string;
  /** ヘッダーマップ */
  headerMap?: any;
  /** 予約IDインデックスマップ */
  reservationIdIndexMap?: any;
  /** チャンク形式フラグ */
  isChunked?: boolean;
  [key: string]: any;
}

/**
 * キャッシュ情報
 */
interface CacheInfo {
  /** キャッシュキー */
  key: string;
  /** 存在フラグ */
  exists: boolean;
  /** サイズ（バイト） */
  size?: number;
  /** データカウント */
  dataCount?: number;
  /** バージョン */
  version?: number;
  /** 最終更新日時 */
  lastUpdated?: string;
}

// --- エラー関連型 ---

/**
 * エラー情報
 */
interface ErrorInfo {
  /** エラーコード */
  code: string;
  /** エラーメッセージ */
  message: string;
  /** 詳細情報 */
  details?: any;
  /** スタックトレース */
  stack?: string;
}

/**
 * APIエラーレスポンス
 */
interface ApiErrorResponse {
  /** 成功フラグ（常にfalse） */
  success: false;
  /** エラー情報 */
  error: ErrorInfo;
  /** メッセージ */
  message: string;
}

/**
 * API成功レスポンス
 */
interface ApiSuccessResponse<T = any> {
  /** 成功フラグ（常にtrue） */
  success: true;
  /** レスポンスデータ */
  data: T;
  /** メッセージ */
  message?: string;
}

/**
 * 統一APIレスポンス型
 */
type UnifiedApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * APIレスポンスデータ型（レガシー）
 */
type ApiResponseData<T = any> = T;

// --- バッチデータ関連型 ---

/**
 * バッチデータ結果
 */
interface BatchDataResult {
  /** 全生徒データ */
  allStudents?: Record<string, UserCore>;
  /** セッション一覧 */
  sessions?: LessonCore[];
  /** 自分の予約一覧 */
  myReservations?: ReservationCore[];
  /** 会計マスターデータ */
  accountingMaster?: AccountingMasterItemCore[];
  /** キャッシュバージョン */
  cacheVersions?: Record<string, string>;
  /** 今日の日付 */
  today?: string;
}

/**
 * @deprecated BatchDataResultを使用してください
 */
type BatchDataResponse = BatchDataResult;

/**
 * サーバーレスポンス（レガシー）
 */
interface ServerResponse<T = any> {
  /** 成功フラグ */
  success: boolean;
  /** レスポンスデータ */
  data?: T;
  /** エラーメッセージ */
  message?: string;
}