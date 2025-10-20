/**
 * 既存のhandleServerError関数との完全互換性を保つラッパー関数
 * レガシーコードサポート用
 * @param {any} err - サーバーから返されたエラーオブジェクト
 */
export function handleServerError(err: any): void;
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
    static handle(error: Error, context?: string, _additionalInfo?: any): void;
    /**
     * 詳細エラーハンドリング（重要なエラーのみで使用）
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - エラーコンテキスト
     * @param {Object} [additionalInfo={}] - 追加情報
     */
    static handleDetailed(error: Error, context?: string, additionalInfo?: any): void;
    /**
     * コンテキストに応じた適切なユーザーメッセージを生成
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - エラーコンテキスト
     * @returns {string} ユーザー向けメッセージ
     */
    static getUserMessage(error: Error, context: string): string;
    /**
     * サーバーエラーの特別処理
     * サーバーから返される様々な形式のエラーを正規化して処理
     * @param {any} serverError - サーバーから返されたエラー
     */
    static handleServerError(serverError: any): void;
    /**
     * 非同期処理用のエラーハンドリング
     * Promise チェーンでの使用に最適化
     * @param {string} context - エラーコンテキスト
     * @returns {(error: Error) => void} エラーハンドリング関数
     */
    static createAsyncHandler(context: string): (error: Error) => void;
    /**
     * 複数のエラーを一括処理
     * バッチ処理などで使用
     * @param {Error[]} errors - エラーの配列
     * @param {string} context - エラーコンテキスト
     */
    static handleMultiple(errors: Error[], context: string): void;
    /**
     * ユーザーフレンドリーなエラーメッセージを取得
     * TypedErrorHandler インターフェース実装
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - エラーコンテキスト
     * @returns {string} ユーザー向けメッセージ
     */
    static getUserFriendlyMessage(error: Error, context: string): string;
    /**
     * 重要なエラーかどうかを判定
     * TypedErrorHandler インターフェース実装
     * @param {Error} error - エラーオブジェクト
     * @returns {boolean} 重要なエラーの場合true
     */
    static isCriticalError(error: Error): boolean;
    /**
     * エラー情報をレポート
     * TypedErrorHandler インターフェース実装
     * @param {FrontendErrorInfo} errorInfo - エラー情報
     */
    static reportError(errorInfo: FrontendErrorInfo): void;
}
