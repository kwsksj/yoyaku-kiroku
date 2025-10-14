/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_Core_ErrorHandler.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、統一エラーハンドリングシステムを
 * 集約します。ユーザー通知、開発環境でのデバッグ支援など。
 * 【構成】: 12_WebApp_Core.jsから分割されたエラーハンドリング専用ファイル
 * 【新規作成理由】:
 * - バックエンドとフロントエンドの完全分離
 * - エラーハンドリング機能の独立性向上
 * - TypeScript型競合の解決
 * =================================================================
 */

/**
 * フロントエンド統一エラーハンドラー
 * ユーザーへの適切な通知とデバッグ情報の管理を行います
 */
export class FrontendErrorHandler {
  /**
   * エラーを処理し、ユーザーに適切に通知（パフォーマンス最適化版）
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @param {Object} [_additionalInfo={}] - 追加情報
   */
  static handle(error, context = '', _additionalInfo = {}) {
    // 軽量ログ出力（本番環境では最小限の情報のみ）
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.error(`[ERROR] ${context}: ${error.message}`);
    }
  }

  /**
   * 詳細エラーハンドリング（重要なエラーのみで使用）
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @param {Object} [additionalInfo={}] - 追加情報
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
    console.error(`[CRITICAL_FRONTEND_ERROR] ${context}:`, errorInfo);

    // ユーザー向けエラー通知
    const userMessage = this.getUserMessage(error, context);

    // エラーメッセージをユーザーに表示
    if (typeof appWindow.showInfo === 'function') {
      appWindow.showInfo(userMessage, 'エラー');
    } else if (typeof alert !== 'undefined') {
      alert(`エラー: ${userMessage}`);
    }

    // 本番環境では簡略化されたログのみ
    if (CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      console.error(`[ERROR] ${context}: ${error.message}`);
    }
  }

  /**
   * コンテキストに応じた適切なユーザーメッセージを生成
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @returns {string} ユーザー向けメッセージ
   */
  static getUserMessage(error, context) {
    switch (context) {
      case 'server-error':
        return 'サーバーとの通信でエラーが発生しました。しばらく待ってからもう一度お試しください。';

      case 'network-error':
        return 'ネットワークエラーが発生しました。インターネット接続を確認してください。';

      case 'validation-error':
        return error.message || '入力内容に問題があります。';

      case 'authentication-error':
        return 'ログイン情報に問題があります。再度ログインしてください。';

      case 'permission-error':
        return 'この操作を実行する権限がありません。';

      case 'data-error':
        return 'データの処理でエラーが発生しました。';

      case 'global-error':
      case 'unhandled-promise-rejection':
        return '予期しないエラーが発生しました。ページを再読み込みしてみてください。';

      default:
        return error.message || 'エラーが発生しました。';
    }
  }

  /**
   * サーバーエラーの特別処理
   * サーバーから返される様々な形式のエラーを正規化して処理
   * @param {any} serverError - サーバーから返されたエラー
   */
  static handleServerError(serverError) {
    let error = serverError;

    // サーバーレスポンスの形式を正規化
    if (typeof serverError === 'string') {
      error = new Error(serverError);
    } else if (serverError && typeof serverError === 'object') {
      if (serverError.message) {
        error = new Error(serverError.message);
      } else if (serverError.error) {
        error = new Error(serverError.error);
      } else {
        error = new Error('サーバーエラーが発生しました');
      }
    } else if (!(serverError instanceof Error)) {
      error = new Error('不明なサーバーエラーが発生しました');
    }

    this.handle(error, 'server-error', {
      originalError: serverError,
      errorType: typeof serverError,
    });
  }

  /**
   * 非同期処理用のエラーハンドリング
   * Promise チェーンでの使用に最適化
   * @param {string} context - エラーコンテキスト
   * @returns {(error: Error) => void} エラーハンドリング関数
   */
  static createAsyncHandler(context) {
    return (/** @type {Error} */ error) => {
      this.handle(error, context);
    };
  }

  /**
   * 複数のエラーを一括処理
   * バッチ処理などで使用
   * @param {Error[]} errors - エラーの配列
   * @param {string} context - エラーコンテキスト
   */
  static handleMultiple(errors, context) {
    if (!Array.isArray(errors) || errors.length === 0) return;

    if (errors.length === 1) {
      this.handle(errors[0], context);
      return;
    }

    const combinedMessage = `複数のエラーが発生しました（${errors.length}件）`;
    const combinedError = new Error(combinedMessage);

    this.handle(combinedError, context, {
      errorCount: errors.length,
      errors: errors.map(e => ({
        message: e.message,
        type: e.constructor.name,
      })),
    });
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを取得
   * TypedErrorHandler インターフェース実装
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @returns {string} ユーザー向けメッセージ
   */
  static getUserFriendlyMessage(error, context) {
    return this.getUserMessage(error, context);
  }

  /**
   * 重要なエラーかどうかを判定
   * TypedErrorHandler インターフェース実装
   * @param {Error} error - エラーオブジェクト
   * @returns {boolean} 重要なエラーの場合true
   */
  static isCriticalError(error) {
    const criticalErrors = ['TypeError', 'ReferenceError', 'SyntaxError'];
    return criticalErrors.includes(error.constructor.name);
  }

  /**
   * エラー情報をレポート
   * TypedErrorHandler インターフェース実装
   * @param {FrontendErrorInfo} errorInfo - エラー情報
   */
  static reportError(errorInfo) {
    // 既存のhandle メソッドと同様の処理
    const error = new Error(errorInfo.message);
    this.handle(
      error,
      errorInfo.context || 'unknown',
      errorInfo.additionalInfo || {},
    );
  }
}

/**
 * 既存のhandleServerError関数との完全互換性を保つラッパー関数
 * レガシーコードサポート用
 * @param {any} err - サーバーから返されたエラーオブジェクト
 */
export function handleServerError(err) {
  FrontendErrorHandler.handleServerError(err);
}

// グローバルエラーハンドラーの設定
appWindow.addEventListener('error', (/** @type {ErrorEvent} */ event) => {
  FrontendErrorHandler.handle(event.error, 'global-error', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

// Promise拒否エラーのハンドリング
appWindow.addEventListener(
  'unhandledrejection',
  (/** @type {PromiseRejectionEvent} */ event) => {
    FrontendErrorHandler.handle(
      new Error(event.reason),
      'unhandled-promise-rejection',
    );
  },
);

// デバッグ用: エラーハンドラーをグローバルに公開（開発環境のみ）
if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
  appWindow.FrontendErrorHandler = FrontendErrorHandler;
}
