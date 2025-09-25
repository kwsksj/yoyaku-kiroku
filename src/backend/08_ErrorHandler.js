/// <reference path="../../types/gas-environment.d.ts" />
/// <reference path="../../types/constants.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 08_ErrorHandler.js
 * 【バージョン】: 1.0
 * 【役割】: プロジェクト全体で使用する統一エラーハンドリングシステム
 * - フロントエンド・バックエンド共通のエラー処理
 * - 構造化されたエラーログ出力
 * - 統一されたユーザー通知
 * 【構成】: 18ファイル構成のうちの8番目（08_Utilities.jsから分離）
 * =================================================================
 */

/**
 * 統一エラーハンドラークラス（バックエンド用）
 * Google Apps Script環境でのエラー処理を統一
 */
class BackendErrorHandler {
  /**
   * エラーを処理し、軽量ログを出力（パフォーマンス最適化版）
   * @param {Error} error - 処理するエラーオブジェクト
   * @param {string} context - エラーが発生したコンテキスト
   * @param {Record<string, unknown>} additionalInfo - 追加情報（オプション）
   * @returns {ApiErrorResponse} 統一APIレスポンス形式のエラーオブジェクト
   */
  static handle(error, context = '', additionalInfo = {}) {
    // 軽量ログ出力（本番環境では最小限の情報のみ）
    PerformanceLog.error(`${context}: ${error.message}`);

    // デバッグ環境でのみ詳細情報を出力
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      const errorInfo = {
        message: error.message || 'Unknown error',
        context: context,
        type: error.constructor.name || 'Error',
        additionalInfo: additionalInfo,
      };
      PerformanceLog.debug(`詳細エラー情報: ${JSON.stringify(errorInfo)}`);
    }

    // 統一APIレスポンス形式で返却
    return this.createErrorResponse(error.message, context, {
      type: error.constructor.name,
    });
  }

  /**
   * 従来の詳細エラーハンドリング（重要なエラーのみで使用）
   * @param {Error} error - 処理するエラーオブジェクト
   * @param {string} context - エラーが発生したコンテキスト
   * @param {Record<string, unknown>} additionalInfo - 追加情報（オプション）
   * @returns {ApiErrorResponse} 統一APIレスポンス形式のエラーオブジェクト
   */
  static handleDetailed(error, context = '', additionalInfo = {}) {
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      context: context,
      timestamp: new Date().toISOString(),
      additionalInfo: additionalInfo,
      type: error.constructor.name || 'Error',
    };

    // 重要なエラーの場合は常に詳細ログを出力
    Logger.log(`[CRITICAL_ERROR] ${context}: ${JSON.stringify(errorInfo)}`);

    // 統一APIレスポンス形式で返却
    return this.createErrorResponse(error.message, context, errorInfo);
  }

  /**
   * 統一APIレスポンス形式のエラーレスポンスを作成
   * @param {string} message - ユーザー向けエラーメッセージ
   * @param {string} context - エラーコンテキスト
   * @param {ErrorInfo} errorInfo - エラー詳細情報
   * @returns {ApiErrorResponse} 統一APIレスポンス
   */
  static createErrorResponse(message, context, errorInfo) {
    return {
      success: false,
      message: message || 'エラーが発生しました',
      meta: {
        timestamp: new Date().toISOString(),
        context: context,
        errorId: this.generateErrorId(),
      },
      // 開発環境でのみエラー詳細を含める
      ...(this.isDevelopmentMode() && {
        debug: {
          stack: errorInfo.stack,
          type: errorInfo.type,
          additionalInfo: errorInfo.additionalInfo,
        },
      }),
    };
  }

  /**
   * 開発モードかどうかを判定
   * @returns {boolean}
   */
  static isDevelopmentMode() {
    // PropertiesServiceでDEV_MODEフラグを確認
    const devMode =
      PropertiesService.getScriptProperties().getProperty('DEV_MODE');
    return devMode === 'true';
  }

  /**
   * エラーIDを生成（トラッキング用）
   * @returns {string} エラーID
   */
  static generateErrorId() {
    return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * 重要なエラーについて管理者に通知
   * @param {ErrorInfo} errorInfo - エラー情報
   * @param {boolean} isCritical - 重要なエラーかどうか
   */
  static notifyAdmin(errorInfo, isCritical = false) {
    if (!ADMIN_EMAIL) return;

    const subject = isCritical
      ? `🚨 [重要] システムエラー: ${errorInfo.context}`
      : `⚠️ システムエラー: ${errorInfo.context}`;

    const body = `
システムエラーが発生しました。

【発生日時】: ${errorInfo.timestamp}
【コンテキスト】: ${errorInfo.context}
【エラーメッセージ】: ${errorInfo.message}
【エラータイプ】: ${errorInfo.type}

【スタックトレース】:
${errorInfo.stack}

【追加情報】:
${JSON.stringify(errorInfo.additionalInfo, null, 2)}

このメールは自動送信されています。
    `;

    try {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: subject,
        body: body,
      });
    } catch (mailError) {
      Logger.log(`[ERROR] Admin notification failed: ${mailError.message}`);
    }
  }
}

/**
 * 既存のhandleServerError関数との互換性を保つラッパー関数
 * 段階的移行のため既存コードとの互換性を維持
 * @param {Error} error - エラーオブジェクト
 * @param {string} context - エラーコンテキスト
 * @returns {ApiErrorResponse} エラーレスポンス
 */
function handleServerError(error, context = 'server-error') {
  return BackendErrorHandler.handle(error, context);
}

/**
 * 統一APIレスポンス作成関数
 * @param {boolean} success - 成功フラグ
 * @param {ApiResponseData} data - レスポンスデータまたはエラー情報
 * @returns {UnifiedApiResponse} 統一APIレスポンス
 */
function createApiResponse(success, data = {}) {
  if (success) {
    /** @type {ApiSuccessResponse} */
    return {
      success: true,
      data: data.data || data,
      message: data.message || 'Success',
      meta: {
        timestamp: new Date().toISOString(),
        version: 1,
      },
    };
  } else {
    /** @type {ApiErrorResponse} */
    return {
      success: false,
      message: data.message || 'Error occurred',
      meta: {
        timestamp: new Date().toISOString(),
        context: data.context || 'unknown',
        errorId: BackendErrorHandler.generateErrorId(),
      },
      ...(data.debug && { debug: data.debug }),
    };
  }
}

// グローバル例外ハンドラーの設定（Google Apps Script環境用）
// Google Apps Script環境では関数は自動的にグローバルスコープで利用可能となるため
// 明示的なグローバル設定は不要
