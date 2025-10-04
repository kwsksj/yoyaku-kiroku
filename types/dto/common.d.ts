/**
 * =================================================================
 * 【ファイル名】: types/dto/common.d.ts
 * 【役割】: DTO層共通型定義（API通信用）
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="../core/index.d.ts" />

/**
 * API汎用レスポンス型
 *
 * 全バックエンド関数の統一返り値形式
 *
 * @example
 * ```typescript
 * const response: ApiResponse<ReservationCore> = {
 *   success: true,
 *   data: reservation,
 *   message: '予約を作成しました'
 * };
 * ```
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
 * API汎用レスポンス型（型付き）
 *
 * @deprecated ApiResponse<T>を使用してください
 */
type ApiResponseGeneric<T = any> = ApiResponse<T>;

/**
 * APIエラーレスポンス型
 *
 * エラー発生時の統一形式
 */
interface ApiError {
  /** 成功フラグ（常にfalse） */
  success: false;

  /** エラーメッセージ */
  message: string;

  /** エラーコード */
  code?: string;

  /** 詳細情報 */
  details?: any;
}

/**
 * アプリ初期化データDTO
 *
 * ログイン時にフロントエンドへ送信される全データ
 */
interface AppInitialDataDto {
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
 * バッチデータ取得リクエスト
 *
 * 複数種類のデータを一括取得
 */
interface BatchDataRequest {
  /** 取得するデータ種類（'reservations', 'lessons', 'accounting'等） */
  dataTypes: string[];

  /** 日付（オプション） */
  date?: string;

  /** 生徒ID（オプション） */
  studentId?: string;
}

/**
 * バッチデータ取得レスポンス
 */
interface BatchDataResponse {
  /** 予約データ */
  reservations?: ReservationCore[];

  /** 自分の予約データ */
  myReservations?: ReservationCore[];

  /** レッスンデータ */
  lessons?: SessionCore[];

  /** 会計マスターデータ */
  accountingMaster?: AccountingMasterItemCore[];

  /** その他の動的データ */
  [key: string]: any;
}

/**
 * ページネーション設定
 */
interface PaginationParams {
  /** ページ番号（1始まり） */
  page?: number;

  /** 1ページあたりの件数 */
  limit?: number;

  /** オフセット */
  offset?: number;
}

/**
 * ページネーション付きレスポンス
 */
interface PaginatedResponse<T> {
  /** データ配列 */
  items: T[];

  /** 総件数 */
  total: number;

  /** 現在のページ */
  page: number;

  /** 1ページあたりの件数 */
  limit: number;

  /** 総ページ数 */
  totalPages: number;

  /** 次のページがあるか */
  hasNext: boolean;

  /** 前のページがあるか */
  hasPrev: boolean;
}

/**
 * ソート設定
 */
interface SortParams {
  /** ソートフィールド */
  field: string;

  /** ソート順（'asc' | 'desc'） */
  order: 'asc' | 'desc';
}

/**
 * フィルター設定
 */
interface FilterParams {
  /** フィルターフィールドと値 */
  [field: string]: any;
}
