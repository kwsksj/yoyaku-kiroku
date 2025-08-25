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
   * エラーを処理し、構造化ログを出力
   * @param {Error} error - 処理するエラーオブジェクト
   * @param {string} context - エラーが発生したコンテキスト
   * @param {Object} additionalInfo - 追加情報（オプション）
   * @returns {Object} 統一APIレスポンス形式のエラーオブジェクト
   */
  static handle(error, context = '', additionalInfo = {}) {
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      context: context,
      timestamp: new Date().toISOString(),
      additionalInfo: additionalInfo,
      type: error.constructor.name || 'Error',
    };

    // 構造化ログ出力
    Logger.log(`[ERROR] ${context}: ${JSON.stringify(errorInfo)}`);

    // 統一APIレスポンス形式で返却
    return this.createErrorResponse(error.message, context, errorInfo);
  }

  /**
   * 統一APIレスポンス形式のエラーレスポンスを作成
   * @param {string} message - ユーザー向けエラーメッセージ
   * @param {string} context - エラーコンテキスト
   * @param {Object} errorInfo - エラー詳細情報
   * @returns {Object} 統一APIレスポンス
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
    const devMode = PropertiesService.getScriptProperties().getProperty('DEV_MODE');
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
   * @param {Object} errorInfo - エラー情報
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
 * フロントエンド用エラーハンドラー（HTMLファイル内で使用）
 * ※ この部分は12_WebApp_Core.htmlに組み込まれます
 */
const FrontendErrorHandlerTemplate = `
/**
 * フロントエンド統一エラーハンドラー
 */
class FrontendErrorHandler {
  /**
   * エラーを処理し、ユーザーに適切に通知
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @param {Object} additionalInfo - 追加情報
   */
  static handle(error, context = '', additionalInfo = {}) {
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      context: context,
      timestamp: new Date().toISOString(),
      userId: appState.currentUser?.studentId || 'anonymous',
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalInfo: additionalInfo
    };

    // コンソールログに出力
    console.error('[ERROR]', context, errorInfo);

    // ユーザーへの通知
    const userMessage = this.getUserFriendlyMessage(error, context);
    showInfo(userMessage, 'エラー');

    // 重要なエラーの場合は詳細ログを送信（将来的にSentryなどへ）
    if (this.isCriticalError(error)) {
      this.reportError(errorInfo);
    }
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを生成
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @returns {string} ユーザー向けメッセージ
   */
  static getUserFriendlyMessage(error, context) {
    // コンテキストに基づいて適切なメッセージを返す
    const contextMessages = {
      'login': 'ログイン処理中にエラーが発生しました。電話番号を確認してもう一度お試しください。',
      'booking': '予約処理中にエラーが発生しました。時間をおいてもう一度お試しください。',
      'cancel': 'キャンセル処理中にエラーが発生しました。時間をおいてもう一度お試しください。',
      'accounting': '会計処理中にエラーが発生しました。入力内容を確認してもう一度お試しください。',
      'data-load': 'データの読み込み中にエラーが発生しました。ページを更新してもう一度お試しください。'
    };

    return contextMessages[context] || 
           \`エラーが発生しました: \${error.message}\\n\\n時間をおいてもう一度お試しください。\`;
  }

  /**
   * 重要なエラーかどうかを判定
   * @param {Error} error - エラーオブジェクト
   * @returns {boolean}
   */
  static isCriticalError(error) {
    const criticalMessages = [
      'Script runtime exceeded',
      'Service invoked too many times',
      'Network error',
      'Timeout'
    ];

    return criticalMessages.some(msg => 
      error.message && error.message.includes(msg)
    );
  }

  /**
   * エラーレポート送信（将来的にSentryなどの監視サービスへ）
   * @param {Object} errorInfo - エラー情報
   */
  static reportError(errorInfo) {
    // 現在はコンソールログのみ
    // 将来的にSentry、Bugsnag、LogRocketなどに送信
    console.log('[CRITICAL ERROR REPORT]', errorInfo);
    
    // 管理者への緊急通知も検討
    // この部分は将来的に実装予定
  }
}

// グローバルエラーハンドラーの設定
window.addEventListener('error', (event) => {
  FrontendErrorHandler.handle(event.error, 'global-error', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Promise拒否エラーのハンドリング
window.addEventListener('unhandledrejection', (event) => {
  FrontendErrorHandler.handle(
    new Error(event.reason), 
    'unhandled-promise-rejection'
  );
});
`;

/**
 * 既存のhandleServerError関数との互換性を保つラッパー関数
 * 段階的移行のため既存コードとの互換性を維持
 */
function handleServerError(error, context = 'server-error') {
  return BackendErrorHandler.handle(error, context);
}

/**
 * 統一APIレスポンス作成関数
 * @param {boolean} success - 成功フラグ
 * @param {Object} data - レスポンスデータまたはエラー情報
 * @returns {Object} 統一APIレスポンス
 */
function createApiResponse(success, data = {}) {
  const baseResponse = {
    success: success,
    meta: {
      timestamp: new Date().toISOString(),
      version: 1,
    },
  };

  if (success) {
    return {
      ...baseResponse,
      data: data.data || data,
      message: data.message || 'Success',
    };
  } else {
    return {
      ...baseResponse,
      message: data.message || 'Error occurred',
      ...(data.debug && { debug: data.debug }),
    };
  }
}

// グローバル例外ハンドラーの設定（Google Apps Script環境用）
if (typeof global !== 'undefined') {
  global.BackendErrorHandler = BackendErrorHandler;
  global.createApiResponse = createApiResponse;
}
