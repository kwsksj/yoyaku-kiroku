/**
 * シンプルな状態管理システム（リロード時状態保持対応）
 */
export class SimpleStateManager {
    /** @type {string} */
    STORAGE_KEY: string;
    /** @type {UIState} */
    state: UIState;
    /** @type {boolean} 無限ループ防止フラグ */
    isUpdating: boolean;
    /** @type {StateSubscriber[]} 状態変更の購読者リスト */
    subscribers: StateSubscriber[];
    /** @type {number | null} 自動保存タイマーID */
    _saveTimeout: number | null;
    /**
     * アクションをディスパッチして状態を更新し、UIを自動再描画
     * @param {StateAction} action - アクションオブジェクト { type: ActionType, payload?: StateActionPayload }
     */
    dispatch(action: StateAction): void;
    _shouldHideLoadingAfterRender: boolean;
    /**
     * 状態を更新（内部メソッド）
     * @param {Partial<UIState>} newState - 新しい状態
     */
    _updateState(newState: Partial<UIState>): void;
    /**
     * 計算済みデータの基本更新
     */
    updateComputed(): void;
    /**
     * requestAnimationFrameを使ったレンダリングスケジューリング
     */
    _scheduleRender(): void;
    _renderScheduled: boolean;
    /**
     * 現在の状態を取得
     * @returns {UIState} 現在の状態
     */
    getState(): UIState;
    /**
     * 状態変更を購読する
     * @param {StateSubscriber} callback - 状態変更時に呼び出される関数 (newState, oldState) => void
     * @returns {() => void} unsubscribe関数
     */
    subscribe(callback: StateSubscriber): () => void;
    /**
     * subscriberに状態変更を通知する
     * @param {UIState} newState - 新しい状態
     * @param {UIState} oldState - 古い状態
     */
    _notifySubscribers(newState: UIState, oldState: UIState): void;
    /**
     * ナビゲーションアクションを処理し、履歴を管理する
     * @param {StateActionPayload} payload - { to: ViewType, context?: NavigationContext, saveHistory?: boolean }
     * @returns {Partial<UIState>} 新しい状態
     */
    _handleNavigate(payload: StateActionPayload): Partial<UIState>;
    /**
     * 現在のビューのコンテキストを抽出する
     * @returns {NavigationContext} コンテキストオブジェクト
     */
    _extractCurrentContext(): NavigationContext;
    /**
     * 前のビューにもどる
     * @returns {Partial<UIState>} 新しい状態、または戻れない場合はnull
     */
    goBack(): Partial<UIState>;
    /**
     * 編集モードを開始する
     * @param {string} reservationId - 予約ID
     * @param {string} [originalMemo=''] - 編集前のメモ内容
     */
    startEditMode(reservationId: string, originalMemo?: string): void;
    /**
     * メモの変更状態を更新する（同期的に実行）
     * @param {string} reservationId - 予約ID
     * @param {string} currentValue - 現在のメモ内容
     */
    updateMemoInputChanged(reservationId: string, currentValue: string): any;
    /**
     * 編集モードを終了する
     * @param {string} reservationId - 予約ID
     */
    endEditMode(reservationId: string): void;
    /**
     * 指定された予約が編集モードかチェック
     * @param {string} reservationId - 予約ID
     * @returns {boolean}
     */
    isInEditMode(reservationId: string): boolean;
    /**
     * すべての編集モードをクリア
     */
    clearAllEditModes(): void;
    /**
     * 自動保存判定 - 重要な状態が変更された時のみ保存
     * @param {UIState} oldState - 変更前の状態
     * @param {Partial<UIState>} newState - 変更された部分
     * @private
     */
    private _autoSaveIfNeeded;
    /**
     * リロード時状態保持機能 - 状態をSessionStorageに保存
     * ブラウザタブが開いている間のみ保持（タブ閉じで自動クリア）
     */
    saveStateToStorage(): void;
    /**
     * リロード時状態保持機能 - SessionStorageから状態を復元
     * @returns {boolean} 復元が成功したかどうか
     */
    restoreStateFromStorage(): boolean;
    /**
     * 状態保存を無効にする（ログアウト時など）
     */
    clearStoredState(): void;
    /**
     * 講座データの更新が必要かチェック
     * @param {number} [cacheExpirationMinutes=10] - キャッシュ有効期限（分）
     * @returns {boolean} 更新が必要な場合true
     */
    needsLessonsUpdate(cacheExpirationMinutes?: number): boolean;
    _dataFetchInProgress: {};
    _dataLastUpdated: {};
    /**
     * データタイプの取得状態を管理
     * @param {string} dataType - データタイプ（'lessons', 'reservations'など）
     * @param {boolean} isInProgress - 取得中かどうか
     */
    setDataFetchProgress(dataType: string, isInProgress: boolean): void;
    /**
     * 特定のデータタイプが取得中かチェック
     * @param {string} dataType - データタイプ
     * @returns {boolean} 取得中の場合true
     */
    isDataFetchInProgress(dataType: string): boolean;
    /**
     * 講座データのキャッシュバージョンを更新
     * @param {string} newVersion - 新しいバージョン
     */
    updateLessonsVersion(newVersion: string): void;
}
export type StateManagerContract = SimpleStateManager;
export type UIStateAlias = UIState;
export type StateSubscriber = (newState: UIState, oldState: UIState) => void;
export type StateActionAlias = StateAction;
export type StateActionPayloadAlias = StateActionPayload;
export type ComputedStateDataAlias = ComputedStateData;
