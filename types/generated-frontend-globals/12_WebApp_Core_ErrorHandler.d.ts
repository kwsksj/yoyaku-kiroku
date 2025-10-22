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
/** @typedef {import('../../types/view/handlers').FrontendErrorInfo} FrontendErrorInfo */
export class FrontendErrorHandler {
    /**
     * @param {Error} error
     * @param {string} [context]
     * @param {Object} [_additionalInfo]
     */
    static handle(error: Error, context?: string, _additionalInfo?: any): void;
    /**
     * @param {Error} error
     * @param {string} [context]
     * @param {Object} [additionalInfo]
     */
    static handleDetailed(error: Error, context?: string, additionalInfo?: any): void;
    /**
     * @param {Error} error
     * @param {string} context
     * @returns {string}
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
     * ログレベルのエラー出力
     * @param {Error} error
     * @param {string} [context]
     */
    static logError(error: Error, context?: string): void;
    /**
     * エラー情報をレポート
     * TypedErrorHandler インターフェース実装
     * @param {FrontendErrorInfo} errorInfo - エラー情報
     */
    static reportError(errorInfo: FrontendErrorInfo): void;
}
export type FrontendErrorInfo = import("../../types/view/handlers").FrontendErrorInfo;
