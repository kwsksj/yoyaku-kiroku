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
     * 復元状態を管理
     * @type {'NOT_RESTORED' | 'RESTORED_VALID' | 'RESTORED_NEEDS_REFRESH' | 'REFRESH_COMPLETE'}
     * @private
     */
    private _restorationState;
    /**
     * 初期状態を返します
     * @returns {UIState} 初期状態
     * @private
     */
    private _getInitialState;
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
     * 実際に使用する初心者モードの値を取得
     * ユーザーの手動設定を優先、なければ自動判定
     * @returns {boolean} true: 初心者モード, false: 経験者モード
     */
    getEffectiveBeginnerMode(): boolean;
    /**
     * 初心者モードを手動設定
     * @param {boolean|null} value - true: 初心者, false: 経験者, null: 自動
     */
    setBeginnerModeOverride(value: boolean | null): void;
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
     * 指定されたよやくが編集モードかチェック
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
    /**
     * sessionStorageから状態を復元
     * @returns {{success: boolean, state: string, reason: string | null, error?: string}}
     */
    restoreStateFromStorage(): {
        success: boolean;
        state: string;
        reason: string | null;
        error?: string;
    };
    _restoredSavedAt: any;
    _restoredView: any;
    /**
     * 状態保存を無効にする（ログアウト時など）
     */
    clearStoredState(): void;
    /**
     * なりすまし操作を開始
     * @param {UserCore} targetUser - なりすまし対象のユーザー
     */
    startImpersonation(targetUser: UserCore): void;
    /**
     * なりすまし操作を終了し、元の管理者に戻る
     */
    endImpersonation(): void;
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
    /**
     * データ再取得が必要かチェック（内部用）
     * @returns {boolean}
     * @private
     */
    private _checkIfDataRefreshNeeded;
    _needsBackgroundRefresh: boolean;
    /**
     * 復元されたビューが必要なデータを持っているか検証
     * データ不足の場合は安全なビューにフォールバック
     * @returns {boolean} 検証成功時true
     * @private
     */
    private _validateRestoredView;
    /**
     * 復元情報を取得（データ再取得用）
     * @returns {{state: string, phone: string | null, reason: string | null, elapsedSeconds: number | null, restoredView: string | null, needsBackgroundRefresh: boolean}}
     */
    getRestorationInfo(): {
        state: string;
        phone: string | null;
        reason: string | null;
        elapsedSeconds: number | null;
        restoredView: string | null;
        needsBackgroundRefresh: boolean;
    };
    /**
     * データ再取得完了後に状態を更新
     */
    markDataRefreshComplete(): void;
    /**
     * フォーム入力をキャッシュに保存
     * 注意: 再描画を避けるため dispatch を使わず直接 state を更新
     * @param {string} key - キャッシュキー（例: 'goalEdit', 'memoEdit:reservationId'）
     * @param {any} value - 保存する値
     */
    cacheFormInput(key: string, value: any): void;
    /**
     * フォーム入力キャッシュから値を取得
     * @param {string} key - キャッシュキー
     * @returns {any} キャッシュされた値（存在しない場合はundefined）
     */
    getFormInputCache(key: string): any;
    /**
     * フォーム入力キャッシュをクリア
     * 注意: 再描画を避けるため dispatch を使わず直接 state を更新
     * @param {string} key - クリアするキャッシュキー
     */
    clearFormInputCache(key: string): void;
    /**
     * すべてのフォーム入力キャッシュをクリア
     */
    clearAllFormInputCache(): void;
    /**
     * textarea要素に入力キャッシュ機能を設定
     * リロード時の入力保持のため、編集中の内容をformInputCacheに自動保存
     *
     * @param {HTMLTextAreaElement} textarea - キャッシュ対象のtextarea要素
     * @param {string} cacheKey - キャッシュキー（例: 'goalEdit', 'memoEdit:reservationId'）
     * @param {boolean} [autoFocus=true] - 自動的にフォーカスするか
     */
    setupTextareaCache(textarea: HTMLTextAreaElement, cacheKey: string, autoFocus?: boolean): void;
}
export type StateManagerContract = SimpleStateManager;
export type UIStateAlias = UIState;
export type StateSubscriber = (newState: UIState, oldState: UIState) => void;
export type StateActionAlias = StateAction;
export type StateActionPayloadAlias = StateActionPayload;
export type ComputedStateDataAlias = ComputedStateData;
