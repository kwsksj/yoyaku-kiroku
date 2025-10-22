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
/** @type {Array<{element: Element, type: string, listener: EventListener, options?: AddEventListenerOptions}>} */
/** @type {Array<{ element: Element; type: string; listener: EventListener; options?: AddEventListenerOptions }>} */
export let activeListeners: Array<{
    element: Element;
    type: string;
    listener: EventListener;
    options?: AddEventListenerOptions;
}>;
