/**
 * =================================================================
 * 【ファイル名】  : 08_ErrorHandler.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : プロジェクト全体の統一エラーハンドリングを担い、API レスポンスとログの双方を整備する。
 *
 * 【主な責務】
 *   - `BackendErrorHandler` で例外を捕捉し、API 互換のエラーレスポンスへ変換
 *   - 重要度に応じてログ出力（PerformanceLog / Logger）と管理者通知を制御
 *   - 既存の `handleServerError` や `createApiResponse` などレガシー互換 API を提供
 *
 * 【関連モジュール】
 *   - `01_Code.gs`: 管理者メールアドレスの取得
 *   - `08_Utilities.js`: パフォーマンスログ機能を共有
 *   - 全バックエンド API (`05-2_Backend_Write.js`, `09_Backend_Endpoints.js` など) がエラー処理で利用
 *
 * 【利用時の留意点】
 *   - 返却するレスポンスは `ApiErrorResponse` 互換となるため、呼び出し側での型注釈を合わせる
 *   - メール通知は本番環境のみを想定。DEV モード時は詳細ログのみを出力
 *   - 新しいエラーコードやメタ情報を追加する場合は、型定義（`types/core/common.d.ts`）側も更新する
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { ADMIN_EMAIL } from './01_Code.js';
import { PerformanceLog } from './08_Utilities.js';

/**
 * 統一エラーハンドラークラス（バックエンド用）
 * Google Apps Script環境でのエラー処理を統一
 */
export class BackendErrorHandler {
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
    const errorInfo = this.buildErrorInfo(error, context, additionalInfo);

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      PerformanceLog.debug(`詳細エラー情報: ${JSON.stringify(errorInfo)}`);
    }

    // 統一APIレスポンス形式で返却
    return this.createErrorResponse(error.message, context, errorInfo);
  }

  /**
   * 従来の詳細エラーハンドリング（重要なエラーのみで使用）
   * @param {Error} error - 処理するエラーオブジェクト
   * @param {string} context - エラーが発生したコンテキスト
   * @param {Record<string, unknown>} additionalInfo - 追加情報（オプション）
   * @returns {ApiErrorResponse} 統一APIレスポンス形式のエラーオブジェクト
   */
  static handleDetailed(error, context = '', additionalInfo = {}) {
    const errorInfo = this.buildErrorInfo(error, context, {
      ...additionalInfo,
      stack: error.stack || 'No stack trace available',
    });

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
    const debugInfo = this.isDevelopmentMode()
      ? {
          ...(errorInfo.stack ? { stack: errorInfo.stack } : {}),
          ...(errorInfo.type ? { type: errorInfo.type } : {}),
          ...(errorInfo.additionalInfo &&
          Object.keys(errorInfo.additionalInfo).length > 0
            ? { additionalInfo: errorInfo.additionalInfo }
            : {}),
        }
      : undefined;

    return {
      success: false,
      message: message || 'エラーが発生しました',
      error: errorInfo,
      meta: {
        timestamp: new Date().toISOString(),
        context: context,
        errorId: this.generateErrorId(),
      },
      ...(debugInfo ? { debug: debugInfo } : {}),
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
   * ErrorInfoオブジェクトを生成
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - 発生コンテキスト
   * @param {Record<string, unknown>} [additionalInfo={}] - 追加情報
   * @returns {ErrorInfo}
   */
  static buildErrorInfo(error, context = '', additionalInfo = {}) {
    /** @type {Record<string, unknown>} */
    const safeAdditionalInfo =
      additionalInfo && typeof additionalInfo === 'object'
        ? additionalInfo
        : {};

    return {
      code: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      context: context || '',
      timestamp: new Date().toISOString(),
      type: error.constructor.name || 'Error',
      additionalInfo: safeAdditionalInfo,
    };
  }

  /**
   * 重要なエラーについて管理者に通知
   * @param {ErrorInfo} errorInfo - エラー情報
   * @param {boolean} isCritical - 重要なエラーかどうか
   */
  static notifyAdmin(errorInfo, isCritical = false) {
    if (!ADMIN_EMAIL) return;

    // 件名（テスト環境では[テスト]プレフィックス追加）
    const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
      ? ''
      : '[テスト]';
    const baseSubject = isCritical
      ? `🚨 [重要] システムエラー: ${errorInfo.context || ''}`
      : `⚠️ システムエラー: ${errorInfo.context || ''}`;
    const subject = `${subjectPrefix}${baseSubject}`;

    const body = `
システムエラーが発生しました。

【発生日時】: ${errorInfo.timestamp || 'N/A'}
【コンテキスト】: ${errorInfo.context || 'N/A'}
【エラーメッセージ】: ${errorInfo.message}
【エラータイプ】: ${errorInfo.type || 'Error'}

【スタックトレース】:
${errorInfo.stack || 'N/A'}

【追加情報】:
${JSON.stringify(errorInfo.additionalInfo || {}, null, 2)}

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
export function handleServerError(error, context = 'server-error') {
  return BackendErrorHandler.handle(error, context);
}

/**
 * 統一フォーマットのAPIレスポンスを生成
 * @param {boolean} success - 成功フラグ
 * @param {ApiResponseData} data - レスポンスデータまたはエラー情報
 * @returns {ApiResponseGeneric} APIレスポンス
 */
export function createApiResponse(success, data = {}) {
  if (success) {
    const payload = /** @type {Record<string, unknown>} */ (
      data && typeof data === 'object' ? data : {}
    );
    const responseData =
      'data' in payload && payload['data'] !== undefined
        ? payload['data']
        : payload;
    return {
      success: true,
      data: /** @type {any} */ (responseData),
      message:
        typeof payload['message'] === 'string'
          ? /** @type {string} */ (payload['message'])
          : 'Success',
      meta: {
        timestamp: new Date().toISOString(),
        version: 1,
      },
    };
  } else {
    const payload = /** @type {Record<string, unknown>} */ (
      data && typeof data === 'object' ? data : {}
    );
    const errorId = BackendErrorHandler.generateErrorId();
    const meta = {
      timestamp: new Date().toISOString(),
      context:
        typeof payload['context'] === 'string'
          ? /** @type {string} */ (payload['context'])
          : 'unknown',
      errorId,
    };

    /** @type {ApiResponseGeneric} */
    const errorResponse = {
      success: false,
      message:
        typeof payload['message'] === 'string'
          ? /** @type {string} */ (payload['message'])
          : 'Error occurred',
      meta,
    };

    if (payload['error'] && typeof payload['error'] === 'object') {
      errorResponse.error = /** @type {ErrorInfo} */ (payload['error']);
    }

    if (payload['debug'] && typeof payload['debug'] === 'object') {
      errorResponse.debug = /** @type {Record<string, unknown>} */ (
        payload['debug']
      );
    }

    return errorResponse;
  }
}

// グローバル例外ハンドラーの設定（Google Apps Script環境用）
// Google Apps Script環境では関数は自動的にグローバルスコープで利用可能となるため
// 明示的なグローバル設定は不要
