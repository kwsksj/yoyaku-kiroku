/**
 * =================================================================
 * 【ファイル名】: types/core/common.d.ts
 * 【役割】: Core層共通型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

import type { LessonCore, SessionCore } from './lesson';
import type { ReservationCore } from './reservation';
import type { AccountingMasterItemCore, AccountingDetailsCore } from './accounting';
import type { UserCore } from './user';

/**
 * 生シート行データ型
 *
 * Google Sheetsから取得した1行のデータ
 * convertRowToReservation()やconvertRowToUser()で各Core型に変換する
 */
export type RawSheetRow = Array<string | Date | boolean | number | null>;

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
export type HeaderMapType = Record<string, number> | Map<string, number>;

/**
 * AppInitialData（アプリ初期化データ）
 *
 * ログイン時にフロントエンドへ送信される全データ
 */
export interface AppInitialData {
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
export interface ApiResponse<T = any> {
  /** 成功フラグ */
  success: boolean;

  /** レスポンスデータ */
  data?: T;

  /** メッセージ */
  message?: string;

  /** ユーザーデータ（必要なレスポンスで使用） */
  user?: UserCore | null;

  /** エラー情報（失敗時のみ） */
  error?: ErrorInfo;

  /** メタ情報 */
  meta?: Record<string, unknown>;

  /** デバッグ情報 */
  debug?: Record<string, unknown>;
}

/**
 * ApiResponseGeneric（型付きAPIレスポンス）
 *
 * @deprecated ApiResponse<T>を使用してください
 */
export type ApiResponseGeneric<T = any> = ApiResponse<T>;

// --- Cache-related types ---

export interface CacheDataStructure {
  version: number;
  [key: string]: unknown;
}

export interface ReservationCacheData extends CacheDataStructure {
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

export interface ScheduleCacheData extends CacheDataStructure {
  schedule: LessonCore[];
  dateRange?: {
    from: string;
    to: string;
    cached: string;
  };
}

export interface AccountingCacheData extends CacheDataStructure {
  items: AccountingMasterItemCore[];
}

export interface StudentCacheData extends CacheDataStructure {
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
export type ReservationData = ReservationCore;

/**
 * @deprecated ReservationCoreを使用してください
 */
export type ReservationObject = ReservationCore;

/**
 * @deprecated AccountingDetailsCoreを使用してください
 */
export type AccountingDetails = AccountingDetailsCore;

/**
 * @deprecated UserCoreを使用してください
 */
export type StudentData = UserCore;

/**
 * @deprecated LessonCoreを使用してください
 */
export type ScheduleMasterData = LessonCore;

/**
 * @deprecated AccountingMasterItemCoreを使用してください
 */
export type AccountingMasterItem = AccountingMasterItemCore;

/**
 * @deprecated RawSheetRow[]を使用してください
 */
export type ReservationRawDataArray = RawSheetRow[];

/**
 * @deprecated RawSheetRow[]を使用してください
 */
export type ReservationArrayData = RawSheetRow[];

/**
 * @deprecated RawSheetRowを使用してください
 */
export type SalesRowArray = RawSheetRow;

/**
 * 売上情報の基本型
 */
export interface SalesBaseInfo {
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
export interface RawReservationObject {
  [key: string]: any;
}

/**
 * トランザクションコールバック型
 */
export type TransactionCallback<T> = () => T;

/**
 * シートデータ取得結果
 */
export interface SheetDataResult<T = RawSheetRow> {
  /** ヘッダー行 */
  header: string[];
  /** ヘッダーマップ */
  headerMap: HeaderMapType;
  /** ヘッダーを含む全データ */
  allData: T[];
  /** データ行（ヘッダー除外） */
  dataRows: T[];
}

/**
 * シート検索結果
 */
export interface SheetSearchResult<T = RawSheetRow> extends SheetDataResult<T> {
  /** 検索で見つかった行 */
  foundRow?: T;
  /** 行番号（1-based） */
  rowIndex?: number;
  /** 検索した列インデックス */
  searchColIdx?: number;
}

/**
 * 電話番号正規化結果
 */
export interface PhoneNormalizationResult {
  /** 正規化された電話番号 */
  normalized: string;
  /** バリデーション結果 */
  isValid: boolean;
  /** エラーメッセージ（無効時のみ） */
  error?: string;
}

/**
 * @deprecated PhoneNormalizationResultを使用してください
 */
export type PhoneNumberNormalizationResult = PhoneNormalizationResult;

/**
 * ユーザープロフィール更新結果
 */
export interface UserProfileUpdateResult {
  /** メッセージ */
  message: string;
  /** 更新されたユーザー情報 */
  updatedUser: UserCore;
}

/**
 * スケジュール情報パラメータ
 */
export interface ScheduleInfoParams {
  /** 教室名 */
  classroom: string;
  /** 日付 */
  date: string;
}

/**
 * チャンクキャッシュメタデータ
 */
export interface ChunkedCacheMetadata {
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
export interface CacheInfo {
  /** キャッシュキー */
  key?: string;
  /** 存在フラグ */
  exists: boolean;
  /** サイズ（バイト） */
  size?: number;
  /** データカウント */
  dataCount?: number | null;
  /** バージョン */
  version?: number | null;
  /** 最終更新日時 */
  lastUpdated?: string;
  /** チャンク形式フラグ */
  isChunked?: boolean;
  /** 総チャンク数 */
  totalChunks?: number | null;
  /** エラーメッセージ */
  error?: string;
}

// --- エラー関連型 ---

/**
 * エラー情報
 */
export interface ErrorInfo {
  /** エラーコード（任意） */
  code?: string | undefined;
  /** エラーメッセージ */
  message: string;
  /** スタックトレース */
  stack?: string | undefined;
  /** 発生コンテキスト */
  context?: string | undefined;
  /** 発生時刻（ISO8601） */
  timestamp?: string | undefined;
  /** エラータイプ（例: TypeError） */
  type?: string | undefined;
  /** 追加情報 */
  additionalInfo?: Record<string, unknown> | undefined;
  /** 詳細情報（後方互換用） */
  details?: any;
}

/**
 * APIエラーレスポンス
 */
export interface ApiErrorResponse {
  /** 成功フラグ（常にfalse） */
  success: false;
  /** メッセージ */
  message: string;
  /** エラー情報 */
  error?: ErrorInfo;
  /** メタ情報（タイムスタンプやコンテキストなど） */
  meta?: {
    timestamp: string;
    context?: string;
    errorId?: string;
  } | undefined;
  /** デバッグ情報（開発モードのみ） */
  debug?: {
    stack?: string;
    type?: string;
    additionalInfo?: Record<string, unknown>;
  } | undefined;
}

/**
 * API成功レスポンス
 */
export interface ApiSuccessResponse<T = any> {
  /** 成功フラグ（常にtrue） */
  success: true;
  /** レスポンスデータ */
  data: T;
  /** メッセージ */
  message?: string | undefined;
  /** メタ情報（レスポンス生成時刻など） */
  meta?: {
    timestamp: string;
    version?: number;
  } | undefined;
}

/**
 * 統一APIレスポンス型
 */
export type UnifiedApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * APIレスポンスデータ型（レガシー）
 */
export type ApiResponseData<T = any> = T;

// --- バッチデータ関連型 ---

/**
 * バッチデータ結果
 */
export interface BatchDataPayload {
  accounting?: AccountingMasterItemCore[];
  lessons?: LessonCore[];
  myReservations?: ReservationCore[];
  [key: string]: unknown;
}

export interface BatchDataResult {
  /** 処理結果 */
  success: boolean;
  /** データペイロード */
  data: BatchDataPayload;
  /** ユーザーを特定できたか */
  userFound: boolean;
  /** 認識されたユーザー */
  user: UserCore | null;
  /** メッセージ */
  message?: string;
}

/**
 * 初期アプリデータペイロード
 *
 * ログインまたは新規登録時にクライアントに返される初期データ
 */
export interface InitialAppDataPayload {
  /** 会計マスターデータ */
  accountingMaster: AccountingMasterItemCore[];
  /** キャッシュバージョン情報 */
  cacheVersions: Record<string, unknown>;
  /** レッスン情報 */
  lessons: LessonCore[];
  /** ユーザーの予約情報 */
  myReservations: ReservationCore[];
}

/**
 * 認証レスポンス（ログイン・新規登録共通）
 *
 * ユーザー認証とアプリケーション初期データを含む統合レスポンス
 */
export interface AuthenticationResponse {
  /** 処理成功フラグ */
  success: boolean;
  /** ユーザーが見つかったか（認証成功したか） */
  userFound: boolean;
  /** 認証されたユーザー情報 */
  user: UserCore | null;
  /** アプリケーション初期データ */
  data: InitialAppDataPayload;
  /** メッセージ（エラー時など） */
  message?: string;
}

/**
 * ユーザー登録結果
 *
 * registerNewUser関数の返り値型（内部使用）
 */
export interface UserRegistrationResult {
  /** 処理成功フラグ */
  success: boolean;
  /** ユーザー登録成功フラグ */
  userFound: boolean;
  /** 登録されたユーザー情報 */
  user: UserCore;
  /** 生成された生徒ID */
  studentId: string;
  /** メッセージ（エラー時） */
  message?: string;
}

/**
 * @deprecated BatchDataResultを使用してください
 */
export type BatchDataResponse = BatchDataResult;

/**
 * サーバーレスポンス（レガシー）
 */
export interface ServerResponse<T = any> {
  /** 成功フラグ */
  success: boolean;
  /** レスポンスデータ */
  data?: T;
  /** エラーメッセージ */
  message?: string;
}
