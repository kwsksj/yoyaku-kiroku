/**
 * =================================================================
 * 【ファイル名】: types/core/index.d.ts
 * 【役割】: Core型定義の統合エクスポート
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="./common.d.ts" />
/// <reference path="./session.d.ts" />
/// <reference path="./reservation.d.ts" />
/// <reference path="./user.d.ts" />
/// <reference path="./accounting.d.ts" />

/**
 * Core型定義の統合エクスポート
 *
 * 使用方法:
 * /// <reference path="../../types/core/index.d.ts" />
 *
 * これにより以下の型が利用可能:
 *
 * 【共通型】(common.d.ts)
 * - RawSheetRow
 * - HeaderMapType
 * - AppInitialData
 * - ApiResponse<T>
 *
 * 【セッション】(session.d.ts)
 * - SessionCore
 *
 * 【予約】(reservation.d.ts)
 * - ReservationCore
 *
 * 【ユーザー】(user.d.ts)
 * - UserCore
 *
 * 【会計】(accounting.d.ts)
 * - AccountingDetailsCore
 * - AccountingMasterItemCore
 * - ClassifiedAccountingItemsCore
 */
