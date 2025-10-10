/**
 * 既存のhandleServerError関数との互換性を保つラッパー関数
 * 段階的移行のため既存コードとの互換性を維持
 * @param {Error} error - エラーオブジェクト
 * @param {string} context - エラーコンテキスト
 * @returns {ApiErrorResponse} エラーレスポンス
 */
export function handleServerError(error: Error, context?: string): ApiErrorResponse;
/**
 * 統一APIレスポンス作成関数
 * @param {boolean} success - 成功フラグ
 * @param {ApiResponseData} data - レスポンスデータまたはエラー情報
 * @returns {UnifiedApiResponse} 統一APIレスポンス
 */
export function createApiResponse(success: boolean, data?: ApiResponseData): UnifiedApiResponse;
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
export class BackendErrorHandler {
    /**
     * エラーを処理し、軽量ログを出力（パフォーマンス最適化版）
     * @param {Error} error - 処理するエラーオブジェクト
     * @param {string} context - エラーが発生したコンテキスト
     * @param {Record<string, unknown>} additionalInfo - 追加情報（オプション）
     * @returns {ApiErrorResponse} 統一APIレスポンス形式のエラーオブジェクト
     */
    static handle(error: Error, context?: string, additionalInfo?: Record<string, unknown>): ApiErrorResponse;
    /**
     * 従来の詳細エラーハンドリング（重要なエラーのみで使用）
     * @param {Error} error - 処理するエラーオブジェクト
     * @param {string} context - エラーが発生したコンテキスト
     * @param {Record<string, unknown>} additionalInfo - 追加情報（オプション）
     * @returns {ApiErrorResponse} 統一APIレスポンス形式のエラーオブジェクト
     */
    static handleDetailed(error: Error, context?: string, additionalInfo?: Record<string, unknown>): ApiErrorResponse;
    /**
     * 統一APIレスポンス形式のエラーレスポンスを作成
     * @param {string} message - ユーザー向けエラーメッセージ
     * @param {string} context - エラーコンテキスト
     * @param {ErrorInfo} errorInfo - エラー詳細情報
     * @returns {ApiErrorResponse} 統一APIレスポンス
     */
    static createErrorResponse(message: string, context: string, errorInfo: ErrorInfo): ApiErrorResponse;
    /**
     * 開発モードかどうかを判定
     * @returns {boolean}
     */
    static isDevelopmentMode(): boolean;
    /**
     * エラーIDを生成（トラッキング用）
     * @returns {string} エラーID
     */
    static generateErrorId(): string;
    /**
     * 重要なエラーについて管理者に通知
     * @param {ErrorInfo} errorInfo - エラー情報
     * @param {boolean} isCritical - 重要なエラーかどうか
     */
    static notifyAdmin(errorInfo: ErrorInfo, isCritical?: boolean): void;
}
