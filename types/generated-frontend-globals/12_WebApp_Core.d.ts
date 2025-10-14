/**
 * 登録されたイベントリスナーを全て解除する
 */
export function teardownAllListeners(): void;
/**
 * イベントリスナーを登録し、解除できるように追跡するヘルパー関数
 * @param {Element} element - 対象要素
 * @param {string} type - イベントタイプ
 * @param {EventListener} listener - リスナー関数
 * @param {AddEventListenerOptions} [options] - addEventListenerのオプション
 */
export function addTrackedListener(element: Element, type: string, listener: EventListener, options?: AddEventListenerOptions): void;
/**
 * StateManagerの初期化後に追加する関数
 * ビュー変更時のイベントリスナー管理を設定
 */
export function setupViewListener(): void;
/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_Core.js
 * 【バージョン】: 2.0
 * 【役割】: WebAppのフロントエンドにおける中核機能の統合ファイル。
 * 分割されたコア機能ファイルの参照と、残存する汎用ユーティリティを集約します。
 * 【構成】: 14ファイル構成のうちの12番目
 * 【v2.0での変更点】:
 * - ファイル分割によるメンテナンス性向上
 * - 機能別ファイルへの分離完了
 * - AI作業効率向上のための構造最適化
 * =================================================================
 */
/** @type {ReturnType<typeof setInterval> | null} */
export let loadingMessageTimer: ReturnType<typeof setInterval> | null;
export namespace LoadingMessages {
    export let login: string[];
    export let booking: string[];
    export let cancel: string[];
    export let edit: string[];
    export let accounting: string[];
    export let dataFetch: string[];
    let _default: string[];
    export { _default as default };
}
export function getRandomMessage(category?: string): string;
export function updateLoadingMessage(category?: string): void;
export function startLoadingMessageRotation(category?: string): void;
export function stopLoadingMessageRotation(): void;
export function hideModal(): void;
/** @type {Array<{element: Element, type: string, listener: EventListener, options?: AddEventListenerOptions}>} */
/** @type {Array<{ element: Element; type: string; listener: EventListener; options?: AddEventListenerOptions }>} */
export let activeListeners: Array<{
    element: Element;
    type: string;
    listener: EventListener;
    options?: AddEventListenerOptions;
}>;
