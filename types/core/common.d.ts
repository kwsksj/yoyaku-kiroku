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
