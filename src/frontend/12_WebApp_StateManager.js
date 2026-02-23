/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12_WebApp_StateManager.js
 * 目的: フロントエンドの状態を一元管理し、UI更新とデータ整合性を担保する
 * 主な責務:
 *   - `dispatch`/`subscribe`を備えたシンプルな状態管理クラスを提供
 *   - localStorageによる状態復元と保存を管理
 *   - 計算済みデータや履歴管理などUI層の共通機能を保持
 * AI向けメモ:
 *   - 状態構造を拡張する際は`initialState`と永続化ロジック（restore/save）双方を更新する
 * =================================================================
 */

/**
 * @typedef {SimpleStateManager} StateManagerContract
 * @typedef {UIState} UIStateAlias
 * @typedef {(newState: UIState, oldState: UIState) => void} StateSubscriber
 * @typedef {StateAction} StateActionAlias
 * @typedef {StateActionPayload} StateActionPayloadAlias
 * @typedef {ComputedStateData} ComputedStateDataAlias
 */

/**
 * フロントエンド用PerformanceLogフォールバック
 * バックエンドで定義されたPerformanceLogがフロントエンドで未定義の場合の安全策
 */

/**
 * 空の会計詳細データを生成
 * @returns {AccountingDetailsCore}
 */
const createEmptyAccountingDetails = () => ({
  tuition: { items: [], subtotal: 0 },
  sales: { items: [], subtotal: 0 },
  grandTotal: 0,
  paymentMethod: CONSTANTS.PAYMENT_DISPLAY.CASH,
});

if (!appWindow.PerformanceLog) {
  appWindow.PerformanceLog = {
    debug(/** @type {string} */ message, /** @type {...any} */ ...args) {
      if (typeof debugLog === 'function') {
        debugLog(`[DEBUG] ${message}`);
      } else if (typeof console !== 'undefined') {
        console.log(`[DEBUG] ${message}`, ...args);
      }
    },
    info(/** @type {string} */ message, /** @type {...any} */ ...args) {
      if (typeof debugLog === 'function') {
        debugLog(`[INFO] ${message}`);
      } else if (typeof console !== 'undefined') {
        console.info(`[INFO] ${message}`, ...args);
      }
    },
    warn(/** @type {string} */ message, /** @type {...any} */ ...args) {
      if (typeof console !== 'undefined') {
        console.warn(`[WARN] ${message}`, ...args);
      }
    },
    error(/** @type {string} */ message, /** @type {...any} */ ...args) {
      if (typeof console !== 'undefined') {
        console.error(`[ERROR] ${message}`, ...args);
      }
    },
  };
}

/**
 * シンプルな状態管理システム（リロード時状態保持対応）
 */
export class SimpleStateManager {
  constructor() {
    /** @type {string} */
    this.STORAGE_KEY = 'yoyaku_kiroku_state';

    /** @type {UIState} */
    this.state = {
      // --- User & Session Data ---
      ...this._getInitialState(),
    };

    /** @type {boolean} 無限ループ防止フラグ */
    this.isUpdating = false;
    /** @type {StateSubscriber[]} 状態変更の購読者リスト */
    this.subscribers = [];
    /** @type {number | null} 自動保存タイマーID */
    this._saveTimeout = null;

    /**
     * 復元状態を管理
     * @type {'NOT_RESTORED' | 'RESTORED_VALID' | 'RESTORED_NEEDS_REFRESH' | 'REFRESH_COMPLETE'}
     * @private
     */
    this._restorationState = 'NOT_RESTORED';

    // 【リロード対応】ページロード時に保存状態を復元
    this.restoreStateFromStorage();
  }

  /**
   * 初期状態を返します
   * @returns {UIState} 初期状態
   * @private
   */
  _getInitialState() {
    return {
      // --- User & Session Data ---
      /** @type {UserCore | null} */
      currentUser: null,
      /** @type {UserCore | null} なりすまし操作時の元の管理者ユーザー */
      adminImpersonationOriginalUser: null,
      /** @type {string} */
      loginPhone: '',
      /** @type {boolean} */
      isFirstTimeBooking: false,
      /** @type {RegistrationFormData} */
      registrationData: {},
      /** @type {string | null} */
      registrationPhone: null,

      // --- Core Application Data ---
      /** @type {LessonCore[]} */
      lessons: [],
      /** @type {ReservationCore[]} */
      myReservations: [],
      /** @type {AccountingMasterItemCore[]} */
      accountingMaster: [],

      // --- UI State ---
      /** @type {ViewType} */
      view: 'login',
      /** @type {string | null} */
      selectedClassroom: null,
      /** @type {Set<string>} 編集モード中の予約ID一覧 */
      editingReservationIds: new Set(),
      editingMemo: null, // { reservationId: string, originalValue: string } | null
      memoInputChanged: false,
      /** @type {LessonCore | null} */
      selectedLesson: null,
      /** @type {ReservationCore | null} */
      editingReservationDetails: null,
      /** @type {ReservationCore | null} - 会計画面の基本よやく情報 (ID, 教室, 日付など) */
      accountingReservation: null,
      /** @type {AccountingDetailsCore} - よやく固有の詳細情報 (開始時刻, レンタル, 割引など) */
      accountingReservationDetails: createEmptyAccountingDetails(),
      /** @type {ScheduleInfo | null} - 講座固有情報 (教室形式, 開室時間など) */
      accountingScheduleInfo: null,
      /** @type {AccountingDetailsCore | null} - 会計計算結果 */
      accountingDetails: null,
      /** @type {string} */ completionMessage: '',
      /** @type {number} */ recordsToShow: 10,
      /** @type {number} */ registrationStep: 1,
      /** @type {UserCore[]} */
      searchedUsers: [],
      /** @type {boolean} */
      searchAttempted: false,

      // --- New Context for Forms ---
      /** @type {ReservationFormContext | null} - よやくフォーム専用コンテキスト */
      currentReservationFormContext: null,

      // --- Navigation History ---
      /** @type {StateNavigationHistoryEntry[]} */
      navigationHistory: [],

      // --- System State ---
      /** @type {boolean} */
      isDataFresh: false,
      /** @type {boolean} */
      _dataUpdateInProgress: false,
      /** @type {string | null} */
      _lessonsVersion: null,
      /** @type {Record<string, boolean>} データタイプ別取得中フラグ */
      _dataFetchInProgress: /** @type {Record<string, boolean>} */ ({}),
      /** @type {Record<string, number>} データタイプ別最終更新時刻 */
      _dataLastUpdated: /** @type {Record<string, number>} */ ({}),

      // --- Computed Data ---
      /** @type {ComputedStateData} */
      computed: {},

      // --- Form Input Cache (リロード時保持用) ---
      /** @type {Record<string, any>} */
      formInputCache: {},
    };
  }

  /**
   * アクションをディスパッチして状態を更新し、UIを自動再描画
   * @param {StateAction} action - アクションオブジェクト { type: ActionType, payload?: StateActionPayload }
   */
  dispatch(action) {
    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      debugLog(
        '🎯 Action dispatched:',
        action.type,
        action.payload ? Object.keys(action.payload) : 'no payload',
      );
    }

    // 現在のビューを記録（ページ遷移判定用）
    const previousView = this.state.view;

    // アクションに基づいて状態更新
    /** @type {Partial<UIState>} */
    let newState = {};
    const payload = action.payload || {};

    switch (action.type) {
      case 'SET_STATE':
        newState = payload;
        break;
      case 'UPDATE_STATE':
        newState = payload;
        break;
      case 'CHANGE_VIEW':
        newState = { view: payload['view'] };
        break;
      case 'NAVIGATE':
        newState = this._handleNavigate(payload);
        break;
      case 'LOGOUT':
        this.clearStoredState();
        newState = this._getInitialState();
        break;
      default:
        console.warn('未知のアクションタイプ:', action.type);
        return;
    }

    // 内部の状態更新メソッドを呼び出し
    this._updateState(newState);

    // ページ遷移が発生した場合のスクロール管理
    if (
      'view' in newState &&
      newState.view &&
      newState.view !== previousView &&
      appWindow.pageTransitionManager &&
      appWindow.pageTransitionManager.onPageTransition
    ) {
      const viewValue = /** @type {ViewType} */ (newState.view);
      appWindow.pageTransitionManager.onPageTransition(viewValue);
    }

    // 最終的な状態更新（画面遷移を伴う）でのみローディング非表示を実行
    const isViewChange =
      'view' in newState && newState.view && newState.view !== previousView;
    const hasSubstantialData =
      ('lessons' in newState && newState.lessons) ||
      ('myReservations' in newState && newState.myReservations) ||
      ('currentUser' in newState && newState.currentUser);
    const isFinalUpdate =
      action.type === 'SET_STATE' && (isViewChange || hasSubstantialData);

    if (isFinalUpdate) {
      this._shouldHideLoadingAfterRender = true;
    }

    // UI を自動で再描画
    this._scheduleRender();
  }

  /**
   * 状態を更新（内部メソッド）
   * @param {Partial<UIState>} newState - 新しい状態
   */
  _updateState(newState) {
    if (this.isUpdating) {
      console.warn('状態更新中のため処理をスキップ');
      return;
    }

    this.isUpdating = true;

    try {
      // 変更前の状態を保存（subscriber用）
      const oldState = { ...this.state };

      // 状態を直接更新
      Object.assign(this.state, newState);

      // 基本的な計算済みデータ更新
      this.updateComputed();

      // subscriberに変更を通知
      this._notifySubscribers(this.state, oldState);

      // 【リロード対応】重要な状態変更時は自動保存
      this._autoSaveIfNeeded(oldState, newState);

      if (CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        debugLog('✅ 状態更新完了:', Object.keys(newState));
      }
    } catch (error) {
      console.error('❌ 状態更新エラー:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 計算済みデータの基本更新
   */
  updateComputed() {
    if (!this.state.myReservations) return;

    // シンプルに完了済みよやくの有無で判定
    // 空き通知希望だけでは経験者扱いにしない
    const hasCompletedReservation = this.state.myReservations.some(
      (/** @type {ReservationCore} */ reservation) => {
        const normalizedStatus = String(reservation.status || '').trim();
        return normalizedStatus === CONSTANTS.STATUS.COMPLETED;
      },
    );

    this.state.isFirstTimeBooking = !hasCompletedReservation;

    if (!this.state.isFirstTimeBooking && typeof localStorage !== 'undefined') {
      // 初心者モードが自動的に解除されたら「初回」固定の手動設定をクリア
      if (localStorage.getItem('beginnerModeOverride') === 'true') {
        localStorage.removeItem('beginnerModeOverride');
      }
    }
  }

  /**
   * 実際に使用する初心者モードの値を取得
   * ユーザーの手動設定を優先、なければ自動判定
   * @returns {boolean} true: 初心者モード, false: 経験者モード
   */
  getEffectiveBeginnerMode() {
    const override =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('beginnerModeOverride')
        : null;

    if (!this.state.isFirstTimeBooking) {
      // 初心者扱いでない場合は常に経験者モード
      return false;
    }

    if (override !== null) {
      return override === 'true';
    }

    return true;
  }

  /**
   * 初心者モードを手動設定
   * @param {boolean|null} value - true: 初心者, false: 経験者, null: 自動
   */
  setBeginnerModeOverride(value) {
    if (typeof localStorage !== 'undefined') {
      if (value === null) {
        localStorage.removeItem('beginnerModeOverride');
      } else {
        localStorage.setItem('beginnerModeOverride', String(value));
      }
    }
    // 状態変更を購読者に通知（画面再描画をトリガー）
    this.dispatch({ type: 'UPDATE_STATE', payload: {} });
  }

  /**
   * requestAnimationFrameを使ったレンダリングスケジューリング
   */
  _scheduleRender() {
    if (this._renderScheduled) {
      return; // 既にスケジュール済み
    }

    this._renderScheduled = true;
    requestAnimationFrame(() => {
      this._renderScheduled = false;
      if (typeof appWindow.render === 'function') {
        debugLog('🎨 Auto-rendering UI...');
        appWindow.render();
        // 特定のaction.typeでのみローディングを非表示（最終的な状態更新のみ）
        if (this._shouldHideLoadingAfterRender) {
          if (typeof hideLoading === 'function') hideLoading();
          this._shouldHideLoadingAfterRender = false;
        }
      } else {
        console.warn('render関数が見つかりません');
      }
    });
  }

  /**
   * 現在の状態を取得
   * @returns {UIState} 現在の状態
   */
  getState() {
    return this.state;
  }

  /**
   * 状態変更を購読する
   * @param {StateSubscriber} callback - 状態変更時に呼び出される関数 (newState, oldState) => void
   * @returns {() => void} unsubscribe関数
   */
  subscribe(callback) {
    this.subscribers.push(callback);

    // unsubscribe関数を返す
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * subscriberに状態変更を通知する
   * @param {UIState} newState - 新しい状態
   * @param {UIState} oldState - 古い状態
   */
  _notifySubscribers(newState, oldState) {
    this.subscribers.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('subscriber callback error:', error);
      }
    });
  }

  /**
   * ナビゲーションアクションを処理し、履歴を管理する
   * @param {StateActionPayload} payload - { to: ViewType, context?: NavigationContext, saveHistory?: boolean }
   * @returns {Partial<UIState>} 新しい状態
   */
  _handleNavigate(payload) {
    const to = /** @type {ViewType} */ (payload.to);
    const context = /** @type {NavigationContext} */ (payload.context || {});
    const saveHistory = payload.saveHistory !== false;
    const currentView = this.state.view;

    // 現在のビューを履歴に保存（もどる履歴として）
    // ビューが異なる場合、または同じビューでもコンテキスト（ステップなど）が大きく異なる場合
    const isSameView = currentView === to;
    const isDifferentStep =
      currentView === 'sessionConclusion' &&
      isSameView &&
      this._extractCurrentContext()['step'] !== context['step'];

    if (saveHistory && (!isSameView || isDifferentStep)) {
      const currentContext = this._extractCurrentContext();
      const historyEntry = { view: currentView, context: currentContext };

      // 同じビューかつ同じコンテキストの連続エントリを避ける
      const lastEntry =
        this.state.navigationHistory[this.state.navigationHistory.length - 1];
      const isDuplicateEntry =
        lastEntry &&
        lastEntry.view === currentView &&
        JSON.stringify(lastEntry.context) === JSON.stringify(currentContext);

      if (!isDuplicateEntry) {
        const newHistory = [...this.state.navigationHistory, historyEntry];
        // 履歴を最大10件に制限
        if (newHistory.length > 10) {
          newHistory.shift();
        }
        return {
          view: to,
          ...context,
          navigationHistory: newHistory,
        };
      }
    }

    return {
      view: to,
      ...context,
    };
  }

  /**
   * 現在のビューのコンテキストを抽出する
   * @returns {NavigationContext} コンテキストオブジェクト
   */
  _extractCurrentContext() {
    const context = {};

    // ビューに応じて重要な状態を保存
    switch (this.state.view) {
      case 'bookingLessons':
        if (this.state.selectedClassroom) {
          context.selectedClassroom = this.state.selectedClassroom;
        }
        break;
      case 'newReservation':
      case 'editReservation':
        if (this.state.selectedLesson) {
          context.selectedLesson = this.state.selectedLesson;
          context.selectedClassroom = this.state.selectedClassroom;
        }
        if (this.state.editingReservationDetails) {
          context.editingReservationDetails =
            this.state.editingReservationDetails;
        }
        break;
      case 'accounting':
        if (this.state.accountingReservation) {
          context.accountingReservation = this.state.accountingReservation;
        }
        break;
      case 'accounting':
        if (this.state.accountingReservation) {
          context.accountingReservation = this.state.accountingReservation;
        }
        break;
      case 'sessionConclusion':
        // ウィザードの現在のステップを保存
        // Note: handlers側で管理されているwizardStateを直接参照できないため
        // startSessionConclusion時にcontextにstepを含める運用とする
        // ここでは、もしstateにstepが含まれていればそれを保存
        if (/** @type {any} */ (this.state).step) {
          context.step = /** @type {any} */ (this.state).step;
        }
        break;
      default:
        break;
    }

    return context;
  }

  /**
   * 前のビューにもどる
   * @returns {Partial<UIState>} 新しい状態、または戻れない場合はnull
   */
  goBack() {
    const history = this.state.navigationHistory;
    if (history.length === 0) {
      debugLog('ナビゲーション履歴が空です - ホームに戻ります');
      return { view: 'dashboard' };
    }

    const previousEntry = history[history.length - 1];
    const newHistory = history.slice(0, -1); // 最後のエントリを削除

    return {
      view: previousEntry.view,
      ...previousEntry.context,
      navigationHistory: newHistory,
    };
  }

  /**
   * 編集モードを開始する
   * @param {string} reservationId - 予約ID
   * @param {string} [originalMemo=''] - 編集前のメモ内容
   */
  startEditMode(reservationId, originalMemo = '') {
    this.state.editingReservationIds.add(reservationId);
    // 同期的状態更新のみ実行（dispatch不要でチラツキ防止）
    this.state.editingMemo = { reservationId, originalValue: originalMemo };
    this.state.memoInputChanged = false;
  }

  /**
   * メモの変更状態を更新する（同期的に実行）
   * @param {string} reservationId - 予約ID
   * @param {string} currentValue - 現在のメモ内容
   */
  updateMemoInputChanged(reservationId, currentValue) {
    const editingMemo = this.state.editingMemo;
    if (editingMemo && editingMemo.reservationId === reservationId) {
      const hasChanged = currentValue !== editingMemo.originalValue;
      if (this.state.memoInputChanged !== hasChanged) {
        // 同期的に状態を更新（UI全体再描画を避けるため、dispatchを使わない）
        this.state.memoInputChanged = hasChanged;

        return hasChanged; // 変更状態を返す
      }
    }
    return this.state.memoInputChanged; // 現在の状態を返す
  }

  /**
   * 編集モードを終了する
   * @param {string} reservationId - 予約ID
   */
  endEditMode(reservationId) {
    this.state.editingReservationIds.delete(reservationId);
    if (
      this.state.editingMemo &&
      this.state.editingMemo.reservationId === reservationId
    ) {
      // 同期的状態更新のみ実行（dispatch不要でチラツキ防止）
      this.state.editingMemo = null;
      this.state.memoInputChanged = false;
    }
  }

  /**
   * 指定されたよやくが編集モードかチェック
   * @param {string} reservationId - 予約ID
   * @returns {boolean}
   */
  isInEditMode(reservationId) {
    return this.state.editingReservationIds.has(reservationId);
  }

  /**
   * すべての編集モードをクリア
   */
  clearAllEditModes() {
    this.state.editingReservationIds.clear();
    this.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        editingMemo: null,
        memoInputChanged: false,
      },
    });
  }
  /**
   * 自動保存判定 - 重要な状態が変更された時のみ保存
   * @param {UIState} oldState - 変更前の状態
   * @param {Partial<UIState>} newState - 変更された部分
   * @private
   */
  _autoSaveIfNeeded(oldState, newState) {
    // ログイン画面に戻る場合は保存状態をクリア(ログアウト扱い)
    if (
      'view' in newState &&
      newState.view === 'login' &&
      oldState.view !== 'login'
    ) {
      appWindow.PerformanceLog?.info('ログイン画面に戻るため保存状態をクリア');
      this.clearStoredState();
      return;
    }

    // 保存対象となる重要な状態変更
    const importantChanges = /** @type {(keyof UIState)[]} */ ([
      'currentUser',
      'loginPhone',
      'view',
      'selectedClassroom',
      'isFirstTimeBooking',
      'registrationData',
      'registrationPhone',
    ]);

    const hasImportantChange = importantChanges.some(
      key => key in newState && oldState[key] !== newState[key],
    );

    if (hasImportantChange) {
      // 500ms後に保存（連続変更をまとめるため）
      if (this._saveTimeout !== null) {
        clearTimeout(this._saveTimeout);
      }
      this._saveTimeout = window.setTimeout(() => {
        this.saveStateToStorage();
      }, 500);
    }
  }

  /**
   * リロード時状態保持機能 - 状態をSessionStorageに保存
   * ブラウザタブが開いている間のみ保持（タブ閉じで自動クリア）
   */
  saveStateToStorage() {
    try {
      // Setオブジェクトは直接JSON化できないため、Arrayに変換
      const stateToSave = {
        ...this.state,
        editingReservationIds: Array.from(this.state.editingReservationIds),
      };

      // 保存対象の状態のみを選択（大量データは除外）
      // 【安全策】なりすまし中は元の管理者ユーザーを保存する
      const currentUserToSave =
        stateToSave.adminImpersonationOriginalUser || stateToSave.currentUser;

      const essentialState = {
        currentUser: currentUserToSave,
        loginPhone: stateToSave.loginPhone,
        view: stateToSave.view,
        selectedClassroom: stateToSave.selectedClassroom,
        isFirstTimeBooking: stateToSave.isFirstTimeBooking,
        registrationData: stateToSave.registrationData,
        registrationPhone: stateToSave.registrationPhone,
        editingReservationIds: stateToSave.editingReservationIds,
        // ビュー固有のコンテキスト（リロード時復元用）
        currentReservationFormContext:
          stateToSave.currentReservationFormContext,
        selectedLesson: stateToSave.selectedLesson,
        accountingReservation: stateToSave.accountingReservation,
        accountingReservationDetails: stateToSave.accountingReservationDetails,
        // フォーム入力キャッシュ（編集中の入力値を保持）
        formInputCache: stateToSave.formInputCache || {},

        // 【Phase 2追加】基本データ（リロード時のデータ再取得を削減）
        lessons: this.state.lessons,
        myReservations: this.state.myReservations,
        accountingMaster: this.state.accountingMaster,

        // 【Phase 3追加】参加者ビュー用データ（リロード時の復元用）
        participantLessons: this.state.participantLessons,
        participantReservationsMap: this.state.participantReservationsMap,
        participantIsAdmin: this.state.participantIsAdmin,
        selectedParticipantClassroom: this.state.selectedParticipantClassroom,
        showPastLessons: this.state.showPastLessons,
        participantHasPastLessonsLoaded:
          this.state.participantHasPastLessonsLoaded,

        // 【Phase 4追加】ログビュー用データとデータ取得日時
        adminLogs: this.state['adminLogs'],
        adminLogsDaysBack: this.state['adminLogsDaysBack'],
        participantDataFetchedAt: this.state['participantDataFetchedAt'],
        adminLogsFetchedAt: this.state['adminLogsFetchedAt'],
        dataFetchedAt: this.state['dataFetchedAt'],

        // メタデータ（データ整合性チェック用）
        savedAt: Date.now(),
        appVersion: CONSTANTS.ENVIRONMENT.APP_VERSION,
        dataVersion: this.state._lessonsVersion || '', // データバージョン
      };

      // JSON文字列化
      const serialized = JSON.stringify(essentialState);

      // サイズ計算（Blobを使って正確なバイトサイズを取得）
      const sizeInBytes = new Blob([serialized]).size;
      const sizeInMB = sizeInBytes / 1024 / 1024;

      // サイズ警告（4MB超過時）
      if (sizeInBytes > 4 * 1024 * 1024) {
        appWindow.PerformanceLog?.warn(
          `sessionStorage サイズが大きい: ${sizeInMB.toFixed(2)}MB (推奨: 4MB以下)`,
        );
      }

      // デバッグ用ログ（通常時は非表示）
      if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
        appWindow.PerformanceLog?.debug(
          `sessionStorage保存サイズ: ${sizeInMB.toFixed(2)}MB`,
        );
      }

      // sessionStorageに保存
      sessionStorage.setItem(this.STORAGE_KEY, serialized);
      appWindow.PerformanceLog?.debug('状態をSessionStorageに保存しました');
    } catch (error) {
      // QuotaExceededError（容量超過）のハンドリング
      if (error.name === 'QuotaExceededError') {
        appWindow.PerformanceLog?.error(
          'sessionStorage容量超過: データを削減してください',
        );

        // フォールバック: 最小限のデータのみ保存
        const minimalState = {
          view: this.state.view,
          currentUser: this.state.currentUser,
          loginPhone: this.state.loginPhone,
          savedAt: Date.now(),
          appVersion: CONSTANTS.ENVIRONMENT.APP_VERSION,
        };

        try {
          sessionStorage.setItem(
            this.STORAGE_KEY,
            JSON.stringify(minimalState),
          );
          appWindow.PerformanceLog?.warn('最小限の状態のみ保存しました');
        } catch (_fallbackError) {
          appWindow.PerformanceLog?.error('最小限の保存も失敗しました');
        }
      } else {
        // その他のエラー
        appWindow.PerformanceLog?.error(`状態保存エラー: ${error.message}`);
      }
    }
  }

  /**
   * リロード時状態保持機能 - SessionStorageから状態を復元
   * @returns {boolean} 復元が成功したかどうか
   */
  /**
   * sessionStorageから状態を復元
   * @returns {{success: boolean, state: string, reason: string | null, error?: string}}
   */
  restoreStateFromStorage() {
    try {
      const savedState = sessionStorage.getItem(this.STORAGE_KEY);
      if (!savedState) {
        appWindow.PerformanceLog?.debug('保存された状態がありません');
        this._restorationState = 'NOT_RESTORED';
        return { success: false, state: 'NOT_RESTORED', reason: 'not_found' };
      }

      const parsedState = JSON.parse(savedState);

      // 【Phase 3追加】有効期限チェック（30分以内）
      const MAX_AGE_MS = 30 * 60 * 1000; // 30分
      const age = Date.now() - (parsedState.savedAt || 0);

      if (age > MAX_AGE_MS) {
        appWindow.PerformanceLog?.warn(
          `保存データが古い（${Math.floor(age / 1000 / 60)}分前）ため再取得します`,
        );
        sessionStorage.removeItem(this.STORAGE_KEY);
        this._restorationState = 'NOT_RESTORED';
        return { success: false, state: 'NOT_RESTORED', reason: 'expired' };
      }

      // 【Phase 3追加】バージョンチェック（アプリ更新検知）
      const currentVersion = CONSTANTS.ENVIRONMENT.APP_VERSION;
      if (parsedState.appVersion && parsedState.appVersion !== currentVersion) {
        appWindow.PerformanceLog?.info(
          `アプリ更新を検知: ${parsedState.appVersion} → ${currentVersion}（自動ログアウト）`,
        );
        sessionStorage.removeItem(this.STORAGE_KEY);
        this._restorationState = 'NOT_RESTORED';
        return {
          success: false,
          state: 'NOT_RESTORED',
          reason: 'version_mismatch',
        };
      }

      // 状態を復元（マージ）
      this.state = {
        ...this.state,
        ...parsedState,
        editingReservationIds: new Set(parsedState.editingReservationIds || []),
      };

      // 復元情報を保存（ログ記録用）
      this._restoredSavedAt = parsedState.savedAt;
      this._restoredView = parsedState.view;

      // savedAtは内部データなので削除
      delete this.state.savedAt;

      // ウィザード状態キャッシュがある場合、ビューをsessionConclusionに設定
      // （実際の復元はtryRestoreWizardFromCacheで行う）
      if (this.state.formInputCache?.['wizardState']?.currentReservationId) {
        this.state.view = 'sessionConclusion';
        appWindow.PerformanceLog?.info(
          'ウィザード状態キャッシュを検出、sessionConclusionビューに設定',
        );
      }

      // ビューとデータの整合性を検証
      this._validateRestoredView();

      // データ再取得が必要かチェック
      const needsRefresh = this._checkIfDataRefreshNeeded();
      this._restorationState = needsRefresh
        ? 'RESTORED_NEEDS_REFRESH'
        : 'RESTORED_VALID';

      appWindow.PerformanceLog?.info(
        `状態をSessionStorageから復元しました（${this._restorationState}）`,
      );

      return {
        success: true,
        state: this._restorationState,
        reason: null,
      };
    } catch (error) {
      appWindow.PerformanceLog?.error(`状態復元エラー: ${error.message}`);
      sessionStorage.removeItem(this.STORAGE_KEY);
      this._restorationState = 'NOT_RESTORED';
      return {
        success: false,
        state: 'NOT_RESTORED',
        reason: 'parse_error',
        error: error.message,
      };
    }
  }

  /**
   * 状態保存を無効にする（ログアウト時など）
   */
  clearStoredState() {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
      appWindow.PerformanceLog?.debug('保存された状態をクリアしました');
    } catch (error) {
      appWindow.PerformanceLog?.error(`状態クリアエラー: ${error.message}`);
    }
  }

  /**
   * なりすまし操作を開始
   * @param {UserCore} targetUser - なりすまし対象のユーザー
   */
  startImpersonation(targetUser) {
    const currentState = this.state;
    // 既に元の管理者が保存されていない場合のみ保存（二重なりすまし防止）
    const originalUser =
      currentState.adminImpersonationOriginalUser || currentState.currentUser;

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      debugLog('🎭 startImpersonation:', {
        target: targetUser?.studentId,
        original: originalUser?.studentId,
      });
    }

    this.dispatch({
      type: 'UPDATE_STATE',
      payload: {
        currentUser: targetUser,
        adminImpersonationOriginalUser: originalUser,
      },
    });
    this.saveStateToStorage(); // 状態を即時保存
  }

  /**
   * なりすまし操作を終了し、元の管理者に戻る
   */
  endImpersonation() {
    const currentState = this.state;
    const originalUser = currentState.adminImpersonationOriginalUser;

    if (!CONSTANTS.ENVIRONMENT.PRODUCTION_MODE) {
      debugLog('🎭 endImpersonation:', {
        hadOriginal: !!originalUser,
        originalId: originalUser?.studentId,
      });
    }

    if (originalUser) {
      this.dispatch({
        type: 'UPDATE_STATE',
        payload: {
          currentUser: originalUser,
          adminImpersonationOriginalUser: null,
        },
      });
      this.saveStateToStorage(); // 状態を即時保存
    }
  }

  /**
   * 講座データの更新が必要かチェック
   * @param {number} [cacheExpirationMinutes=10] - キャッシュ有効期限（分）
   * @returns {boolean} 更新が必要な場合true
   */
  needsLessonsUpdate(cacheExpirationMinutes = 10) {
    // 安全な初期化
    if (!this._dataFetchInProgress) {
      this._dataFetchInProgress = {};
    }
    if (!this._dataLastUpdated) {
      this._dataLastUpdated = {};
    }

    // 現在講座データ取得中の場合はfalse
    if (
      /** @type {Record<string, boolean>} */ (this._dataFetchInProgress)[
        'lessons'
      ]
    ) {
      appWindow.PerformanceLog?.debug('講座データ取得中のため更新スキップ');
      return false;
    }

    // 講座データが存在しない場合は更新必要
    if (
      !this.state.lessons ||
      !Array.isArray(this.state.lessons) ||
      this.state.lessons.length === 0
    ) {
      appWindow.PerformanceLog?.debug('講座データが存在しないため更新必要');
      return true;
    }

    // 最終更新時刻チェック
    const lastUpdated = /** @type {Record<string, number>} */ (
      this._dataLastUpdated
    )['lessons'];
    if (!lastUpdated) {
      appWindow.PerformanceLog?.debug(
        '講座データの更新時刻が未設定のため更新必要',
      );
      return true;
    }

    const expirationTime = cacheExpirationMinutes * 60 * 1000; // ミリ秒に変換
    const isExpired = Date.now() - lastUpdated > expirationTime;

    if (isExpired) {
      appWindow.PerformanceLog?.debug(
        `講座データキャッシュが期限切れ（${cacheExpirationMinutes}分経過）`,
      );
      return true;
    }

    appWindow.PerformanceLog?.debug('講座データキャッシュは有効');
    return false;
  }

  /**
   * データタイプの取得状態を管理
   * @param {string} dataType - データタイプ（'lessons', 'reservations'など）
   * @param {boolean} isInProgress - 取得中かどうか
   */
  setDataFetchProgress(dataType, isInProgress) {
    // 安全な初期化
    if (!this._dataFetchInProgress) {
      this._dataFetchInProgress = {};
    }
    if (!this._dataLastUpdated) {
      this._dataLastUpdated = {};
    }

    /** @type {Record<string, boolean>} */ (this._dataFetchInProgress)[
      dataType
    ] = isInProgress;

    if (!isInProgress) {
      // 取得完了時に更新時刻を記録
      /** @type {Record<string, number>} */ (this._dataLastUpdated)[dataType] =
        Date.now();
      appWindow.PerformanceLog?.debug(
        `${dataType}データ取得完了：${new Date().toLocaleTimeString()}`,
      );
    } else {
      appWindow.PerformanceLog?.debug(`${dataType}データ取得開始`);
    }
  }

  /**
   * 特定のデータタイプが取得中かチェック
   * @param {string} dataType - データタイプ
   * @returns {boolean} 取得中の場合true
   */
  isDataFetchInProgress(dataType) {
    // 安全な初期化
    if (!this._dataFetchInProgress) {
      this._dataFetchInProgress = {};
    }
    return !!(
      /** @type {Record<string, boolean>} */ (this._dataFetchInProgress)[
        dataType
      ]
    );
  }

  /**
   * 講座データのキャッシュバージョンを更新
   * @param {string} newVersion - 新しいバージョン
   */
  updateLessonsVersion(newVersion) {
    if (this.state._lessonsVersion !== newVersion) {
      this.state._lessonsVersion = newVersion;
      this.setDataFetchProgress('lessons', false);
      appWindow.PerformanceLog?.debug(
        `講座データバージョンを更新: ${newVersion}`,
      );
    }
  }

  /**
   * データ再取得が必要かチェック（内部用）
   * @returns {boolean}
   * @private
   */
  _checkIfDataRefreshNeeded() {
    // ユーザー情報がなければ不要
    if (!this.state.currentUser) {
      return false;
    }

    // ログイン画面の場合は不要
    if (this.state.view === 'login' || this.state.view === 'register') {
      return false;
    }

    // 基本データ（lessons）がなければ全ユーザーで再取得必要
    const hasLessons =
      this.state.lessons &&
      Array.isArray(this.state.lessons) &&
      this.state.lessons.length > 0;

    if (!hasLessons) {
      appWindow.PerformanceLog?.info(
        'リロード復元: lessonsデータがないため再取得必要',
      );
      return true;
    }

    // 管理者の場合、参加者ビュー/ログビューでデータがなければ再取得必要
    // ただし、sessionStorageから復元された場合はバックグラウンド更新に任せる
    const isAdmin = this.state.currentUser?.isAdmin === true;
    if (isAdmin) {
      const isAdminView =
        this.state.view === 'participants' || this.state.view === 'adminLog';

      if (isAdminView) {
        // 参加者データがあるか
        const hasParticipantData =
          this.state.participantLessons &&
          Array.isArray(this.state.participantLessons) &&
          this.state.participantLessons.length > 0;

        // 参加者データがない場合のみ再取得必要
        // adminLogsはsessionStorageから復元されるので、ここではチェックしない
        if (!hasParticipantData) {
          appWindow.PerformanceLog?.info(
            'リロード復元: participantLessonsデータがないため再取得必要',
          );
          return true;
        }

        // データがある場合はバックグラウンド更新をスケジュール
        // （ここではフラグを立てるだけで、実際の更新は描画後に行う）
        this._needsBackgroundRefresh = true;
        appWindow.PerformanceLog?.info(
          'リロード復元: データがあるためバックグラウンド更新をスケジュール',
        );
        return false;
      }
    }

    return false;
  }

  /**
   * 復元されたビューが必要なデータを持っているか検証
   * データ不足の場合は安全なビューにフォールバック
   * @returns {boolean} 検証成功時true
   * @private
   */
  _validateRestoredView() {
    const view = this.state.view;
    const user = this.state.currentUser;

    // ログイン・登録画面は常にOK
    if (view === 'login' || view === 'register') {
      return true;
    }

    // ログイン必須ビューでユーザー情報がない場合
    const loginRequiredViews = [
      'dashboard',
      'bookingLessons',
      'newReservation',
      'editReservation',
      'accounting',
      'myReservations',
      'sessionConclusion',
      'participants',
      'adminLog',
    ];

    if (loginRequiredViews.includes(view) && !user) {
      appWindow.PerformanceLog?.warn(
        `ビュー検証失敗: ${view}にユーザー情報がありません`,
      );
      this.state.view = 'login';
      return false;
    }

    // 特定のコンテキストが必要なビュー
    /** @type {Record<string, () => boolean>} */
    const contextRequirements = {
      accounting: () => !!this.state.accountingReservation,
      editReservation: () => !!this.state.editingReservationDetails,
      newReservation: () => !!this.state.selectedLesson,
      sessionConclusion: () =>
        !!this.state.formInputCache?.['wizardState']?.currentReservationId,
      participants: () =>
        !!this.state.participantLessons &&
        this.state.participantLessons.length > 0,
    };

    const requirement = contextRequirements[view];
    if (requirement && !requirement()) {
      appWindow.PerformanceLog?.warn(
        `ビュー検証失敗: ${view}に必要なコンテキストがありません`,
      );
      this.state.view = user ? 'dashboard' : 'login';
      return false;
    }

    return true;
  }

  /**
   * 復元情報を取得（データ再取得用）
   * @returns {{state: string, phone: string | null, reason: string | null, elapsedSeconds: number | null, restoredView: string | null, needsBackgroundRefresh: boolean}}
   */
  getRestorationInfo() {
    const state = this._restorationState;

    // 復元されていない、または再取得不要の場合
    if (state !== 'RESTORED_NEEDS_REFRESH') {
      return {
        state,
        phone: null,
        reason: null,
        elapsedSeconds: null,
        restoredView: this._restoredView || null,
        needsBackgroundRefresh: this._needsBackgroundRefresh === true,
      };
    }

    // 電話番号を取得
    const phone =
      this.state.loginPhone || this.state.currentUser?.phone || null;

    // 再取得理由を判定（日本語）
    let reason = null;
    if (!this.state.lessons?.length) {
      reason = 'レッスンデータなし';
    } else if (
      this.state.currentUser?.isAdmin &&
      !this.state['adminLogs']?.length
    ) {
      reason = '管理者ログなし';
    }

    // リロードからの経過時間を計算（秒単位）
    const elapsedSeconds = this._restoredSavedAt
      ? Math.floor((Date.now() - this._restoredSavedAt) / 1000)
      : null;

    // 復元されたビュー
    const restoredView = this._restoredView || null;

    return {
      state,
      phone,
      reason,
      elapsedSeconds,
      restoredView,
      needsBackgroundRefresh: false,
    };
  }

  /**
   * データ再取得完了後に状態を更新
   */
  markDataRefreshComplete() {
    if (this._restorationState === 'RESTORED_NEEDS_REFRESH') {
      this._restorationState = 'REFRESH_COMPLETE';
      appWindow.PerformanceLog?.info('リロード復元: データ再取得完了');
    } else {
      appWindow.PerformanceLog?.error(
        `markDataRefreshComplete called in unexpected state: ${this._restorationState}`,
      );
    }
  }

  // =================================================================
  // --- Form Input Cache Methods (リロード時入力保持用) ---
  // =================================================================

  /**
   * フォーム入力をキャッシュに保存
   * 注意: 再描画を避けるため dispatch を使わず直接 state を更新
   * @param {string} key - キャッシュキー（例: 'goalEdit', 'memoEdit:reservationId'）
   * @param {any} value - 保存する値
   */
  cacheFormInput(key, value) {
    const currentCache = this.state.formInputCache || {};
    // 直接stateを更新（dispatchすると再描画が走り保存処理が妨げられる）
    this.state.formInputCache = {
      ...currentCache,
      [key]: value,
    };
    // sessionStorageに保存
    this.saveStateToStorage();
  }

  /**
   * フォーム入力キャッシュから値を取得
   * @param {string} key - キャッシュキー
   * @returns {any} キャッシュされた値（存在しない場合はundefined）
   */
  getFormInputCache(key) {
    return (this.state.formInputCache || {})[key];
  }

  /**
   * フォーム入力キャッシュをクリア
   * 注意: 再描画を避けるため dispatch を使わず直接 state を更新
   * @param {string} key - クリアするキャッシュキー
   */
  clearFormInputCache(key) {
    const currentCache = { ...(this.state.formInputCache || {}) };
    delete currentCache[key];
    // 直接stateを更新
    this.state.formInputCache = currentCache;
    // sessionStorageに保存
    this.saveStateToStorage();
  }

  /**
   * すべてのフォーム入力キャッシュをクリア
   */
  clearAllFormInputCache() {
    this.state.formInputCache = {};
    this.saveStateToStorage();
  }

  /**
   * textarea要素に入力キャッシュ機能を設定
   * リロード時の入力保持のため、編集中の内容をformInputCacheに自動保存
   *
   * @param {HTMLTextAreaElement} textarea - キャッシュ対象のtextarea要素
   * @param {string} cacheKey - キャッシュキー（例: 'goalEdit', 'memoEdit:reservationId'）
   * @param {boolean} [autoFocus=true] - 自動的にフォーカスするか
   */
  setupTextareaCache(textarea, cacheKey, autoFocus = true) {
    if (!textarea) {
      appWindow.PerformanceLog?.warn(
        `setupTextareaCache: textarea not found for key "${cacheKey}"`,
      );
      return;
    }

    // 初期値をキャッシュに保存
    this.cacheFormInput(cacheKey, {
      isEditing: true,
      text: textarea.value,
    });

    // 入力時にキャッシュを更新
    textarea.addEventListener('input', () => {
      this.cacheFormInput(cacheKey, {
        isEditing: true,
        text: textarea.value,
      });
    });

    // フォーカス
    if (autoFocus) {
      textarea.focus();
    }
  }
}

// グローバルインスタンスを作成
debugLog('🔧 SimpleStateManager class defined:', typeof SimpleStateManager);
appWindow.stateManager = new SimpleStateManager();
debugLog('✅ appWindow.stateManager initialized:', !!appWindow.stateManager);
debugLog('   stateManager type:', typeof appWindow.stateManager);
