/**
 * =================================================================
 * 【ファイル名】: types/dto/index.d.ts
 * 【役割】: DTO型定義の統合エクスポート
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="./reservation-dto.d.ts" />
/// <reference path="./user-dto.d.ts" />
/// <reference path="./accounting-dto.d.ts" />

/**
 * DTO型定義の統合エクスポート
 *
 * 使用方法:
 * /// <reference path="../../types/dto/index.d.ts" />
 *
 * これにより以下の型が利用可能:
 *
 * 【予約関連DTO】
 * - ReservationCreateDto - 予約作成リクエスト
 * - ReservationUpdateDto - 予約更新リクエスト
 * - ReservationCancelDto - 予約キャンセルリクエスト
 * - ReservationApiDto - 予約API応答（軽量版）
 * - ReservationDetailDto - 予約詳細応答
 *
 * 【ユーザー関連DTO】
 * - UserRegistrationDto - 新規ユーザー登録リクエスト
 * - UserUpdateDto - ユーザー情報更新リクエスト
 * - UserInfoDto - ユーザー情報API応答（最小限）
 * - UserProfileDto - プロフィール編集用
 * - UserAuthResponseDto - 認証応答
 *
 * 【会計関連DTO】
 * - AccountingFormDto - 会計フォーム入力
 * - AccountingSaveDto - 会計詳細保存リクエスト
 * - AccountingCalculationResultDto - 会計計算結果応答
 * - AccountingMasterItemDto - 会計マスターアイテム応答
 * - ClassifiedAccountingItemsDto - 会計マスター分類応答
 */
