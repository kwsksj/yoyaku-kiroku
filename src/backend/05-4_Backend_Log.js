/**
 * =================================================================
 * 【ファイル名】  : 05-4_Backend_Log.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : ログシートからのデータ取得を行う。
 *
 * 【主な責務】
 *   - ログシートからの直近ログデータ取得
 *   - ヘッダーマップを利用したデータ構造化
 *
 * 【関連モジュール】
 *   - 08_Utilities.js: getSheetData, createHeaderMap など共通関数
 *   - 09_Backend_Endpoints.js: getRecentLogs を公開
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { CONSTANTS } from '../shared/00_Constants.js';
import { SS_MANAGER } from './00_SpreadsheetManager.js';
import { createApiResponse } from './08_ErrorHandler.js';
import { getSheetData, PerformanceLog } from './08_Utilities.js';

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - タイムスタンプ (ISO形式)
 * @property {string} userId - ユーザーID
 * @property {string} realName - 本名
 * @property {string} nickname - ニックネーム
 * @property {string} action - アクション
 * @property {string} result - 結果
 * @property {string} classroom - 教室名
 * @property {string} reservationId - 予約ID
 * @property {string} date - 日付
 * @property {string} message - メッセージ
 * @property {string} details - 詳細情報
 */

/**
 * ログシートから直近のログデータを取得します。
 * 管理者専用のエンドポイントから呼び出されます。
 *
 * @param {number} [daysBack=30] - 取得する日数（デフォルト30日）
 * @returns {ApiResponseGeneric<LogEntry[]>} ログデータの配列
 */
export function getRecentLogs(daysBack = 30) {
  try {
    const startTime = Date.now();
    PerformanceLog.info(`[getRecentLogs] 開始: 直近${daysBack}日分のログ取得`);

    const sheet = SS_MANAGER.getSheet(CONSTANTS.SHEET_NAMES.LOG);
    if (!sheet) {
      return createApiResponse(false, {
        message: 'ログシートが見つかりません。',
      });
    }

    // シートデータを一括取得
    const sheetData = getSheetData(sheet);
    const headerMap = sheetData.headerMap;
    const dataRows = sheetData.dataRows;

    // ヘッダーインデックスを取得
    const H = CONSTANTS.HEADERS.LOG;
    const timestampIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.TIMESTAMP,
    );
    const userIdIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.USER_ID,
    );
    const realNameIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.REAL_NAME,
    );
    const nicknameIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.NICKNAME,
    );
    const actionIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.ACTION,
    );
    const resultIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.RESULT,
    );
    const classroomIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.CLASSROOM,
    );
    const reservationIdIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.RESERVATION_ID,
    );
    const dateIdx = /** @type {Map<string, number>} */ (headerMap).get(H.DATE);
    const messageIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.MESSAGE,
    );
    const detailsIdx = /** @type {Map<string, number>} */ (headerMap).get(
      H.DETAILS,
    );

    // 必須列の存在チェック
    if (timestampIdx === undefined) {
      return createApiResponse(false, {
        message:
          'ログシートのフォーマットが不正です（タイムスタンプ列が見つかりません）。',
      });
    }

    // フィルタリング用の日付を計算
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);

    /** @type {LogEntry[]} */
    const logs = [];

    for (const row of dataRows) {
      // タイムスタンプでフィルタリング
      const timestamp = row[timestampIdx];
      if (!timestamp) continue;

      const logDate =
        timestamp instanceof Date ? timestamp : new Date(String(timestamp));
      if (isNaN(logDate.getTime()) || logDate < cutoffDate) continue;

      /** @type {LogEntry} */
      const entry = {
        timestamp: logDate.toISOString(),
        userId: userIdIdx !== undefined ? String(row[userIdIdx] || '') : '',
        realName:
          realNameIdx !== undefined ? String(row[realNameIdx] || '') : '',
        nickname:
          nicknameIdx !== undefined ? String(row[nicknameIdx] || '') : '',
        action: actionIdx !== undefined ? String(row[actionIdx] || '') : '',
        result: resultIdx !== undefined ? String(row[resultIdx] || '') : '',
        classroom:
          classroomIdx !== undefined ? String(row[classroomIdx] || '') : '',
        reservationId:
          reservationIdIdx !== undefined
            ? String(row[reservationIdIdx] || '')
            : '',
        date: dateIdx !== undefined ? String(row[dateIdx] || '') : '',
        message: messageIdx !== undefined ? String(row[messageIdx] || '') : '',
        details: detailsIdx !== undefined ? String(row[detailsIdx] || '') : '',
      };

      logs.push(entry);
    }

    // 新しい順（降順）でソート
    logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    PerformanceLog.performance('getRecentLogs', startTime);
    PerformanceLog.info(`[getRecentLogs] 完了: ${logs.length}件のログを取得`);

    return createApiResponse(true, logs);
  } catch (error) {
    PerformanceLog.error(
      `[getRecentLogs] エラー: ${/** @type {Error} */ (error).message}`,
    );
    return createApiResponse(false, {
      message: `ログ取得中にエラーが発生しました: ${/** @type {Error} */ (error).message}`,
    });
  }
}
