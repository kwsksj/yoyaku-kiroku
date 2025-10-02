/**
 * =================================================================
 * 【ファイル名】: types/dto/reservation-dto.d.ts
 * 【役割】: 予約操作用DTO型定義
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="../core/index.d.ts" />

/**
 * 予約作成リクエストDTO
 *
 * 新規予約作成時にフロントエンドからバックエンドへ送信するデータ
 * reservationIdとstatusは含まない（サーバー側で生成）
 *
 * @example
 * ```typescript
 * const createDto: ReservationCreateDto = {
 *   studentId: 'S-001',
 *   classroom: '東京教室',
 *   date: '2025-10-15',
 *   startTime: '13:00',
 *   endTime: '16:00',
 *   user: {
 *     studentId: 'S-001',
 *     displayName: '太郎',
 *     realName: '山田太郎',
 *   },
 *   chiselRental: true,
 *   firstLecture: false,
 *   workInProgress: '仏像制作中',
 * };
 * ```
 */
interface ReservationCreateDto
  extends Omit<ReservationCore, 'reservationId' | 'status'> {
  /** ユーザー情報（API互換性のため） */
  user: UserInfoDto;
}

/**
 * 予約更新リクエストDTO
 *
 * 既存予約の詳細情報を更新する際に使用
 * 更新可能なフィールドのみを含む
 *
 * @example
 * ```typescript
 * const updateDto: ReservationUpdateDto = {
 *   reservationId: 'R-20251003-001',
 *   classroom: '東京教室',
 *   studentId: 'S-001',
 *   startTime: '14:00',
 *   endTime: '17:00',
 *   chiselRental: false,
 *   workInProgress: '仏像完成間近',
 * };
 * ```
 */
interface ReservationUpdateDto
  extends Pick<
    ReservationCore,
    | 'reservationId'
    | 'classroom'
    | 'studentId'
    | 'startTime'
    | 'endTime'
    | 'chiselRental'
    | 'firstLecture'
    | 'workInProgress'
    | 'materialInfo'
    | 'order'
    | 'messageToTeacher'
  > {}

/**
 * 予約キャンセルリクエストDTO
 *
 * 予約をキャンセルする際に使用
 * 検証用にdateを含む
 *
 * @example
 * ```typescript
 * const cancelDto: ReservationCancelDto = {
 *   reservationId: 'R-20251003-001',
 *   classroom: '東京教室',
 *   studentId: 'S-001',
 *   date: '2025-10-15',
 *   cancelMessage: '体調不良のため',
 * };
 * ```
 */
interface ReservationCancelDto {
  /** 予約ID */
  reservationId: string;

  /** 教室名 */
  classroom: string;

  /** 生徒ID */
  studentId: string;

  /** 日付（検証用） */
  date: string;

  /** キャンセル理由（オプション） */
  cancelMessage?: string;
}

/**
 * 予約API応答DTO（軽量版）
 *
 * API応答で返す予約情報（必要最小限のフィールド）
 * 一覧表示や検索結果で使用
 *
 * @example
 * ```typescript
 * const apiDto: ReservationApiDto = {
 *   reservationId: 'R-20251003-001',
 *   studentId: 'S-001',
 *   classroom: '東京教室',
 *   date: '2025-10-15',
 *   status: '確定',
 *   startTime: '13:00',
 *   endTime: '16:00',
 * };
 * ```
 */
type ReservationApiDto = Pick<
  ReservationCore,
  | 'reservationId'
  | 'studentId'
  | 'classroom'
  | 'date'
  | 'status'
  | 'venue'
  | 'startTime'
  | 'endTime'
  | 'chiselRental'
  | 'firstLecture'
>;

/**
 * 予約詳細取得応答DTO
 *
 * 予約詳細を取得する際のAPI応答
 * ReservationCoreの完全な情報を返す
 */
type ReservationDetailDto = ReservationCore;
