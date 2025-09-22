// @ts-check
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_StateManager.js
 * 【バージョン】: 2.1 (JavaScript分離開発版)
 * 【役割】: シンプルで確実な状態管理システム
 * - 無限ループの完全回避
 * - JavaScript分離開発環境対応
 * - 完全なTypeScript型チェック対応
 * =================================================================
 */

/**
 * シンプルな状態管理システム
 */
class SimpleStateManager {
  constructor() {
    /** @type {UIState} */
    this.state = {
      // --- User & Session Data ---
      /** @type {UserData | null} */
      currentUser: null,
      /** @type {string} */
      loginPhone: '',
      /** @type {boolean} */
      isFirstTimeBooking: false,
      /** @type {RegistrationFormData} */
      registrationData: {},
      /** @type {string | null} */
      registrationPhone: null,

      // --- Core Application Data ---
      /** @type {LessonData[]} */
      lessons: [],
      /** @type {ReservationData[]} */
      myReservations: [],
      /** @type {AccountingMasterData[]} */
      accountingMaster: [],

      // --- UI State ---
      /** @type {ViewType} */
      view: 'login',
      /** @type {string | null} */
      selectedClassroom: null,
      /** @type {Set<string>} 編集モード中の予約ID一覧 */
      editingReservationIds: new Set(),
      /** @type {LessonData | null} */
      selectedLesson: null,
      /** @type {ReservationDetails | null} */
      editingReservationDetails: null,
      /** @type {ReservationData | null} - 会計画面の基本予約情報 (ID, 教室, 日付など) */
      accountingReservation: null,
      /** @type {AccountingReservationDetails} - 予約固有の詳細情報 (開始時刻, レンタル, 割引など) */
      accountingReservationDetails: {},
      /** @type {ScheduleInfo | null} - 講座固有情報 (教室形式, 開講時間など) */
      accountingScheduleInfo: null,
      /** @type {AccountingCalculation | null} - 会計計算結果 */
      accountingDetails: null,
      /** @type {string} */ completionMessage: '',
      /** @type {number} */ recordsToShow: 10,
      /** @type {number} */ registrationStep: 1,
      /** @type {UserData[]} */
      searchedUsers: [],
      /** @type {boolean} */
      searchAttempted: false,

      // --- New Context for Forms ---
      /** @type {ReservationFormContext | null} - 予約フォーム専用コンテキスト */
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

      // --- Computed Data ---
      /** @type {ComputedStateData} */
      computed: {},
    };

    /** @type {boolean} 無限ループ防止フラグ */
    this.isUpdating = false;
    /** @type {StateSubscriber[]} 状態変更の購読者リスト */
    this.subscribers = [];
  }

  /**
   * アクションをディスパッチして状態を更新し、UIを自動再描画
   * @param {StateAction} action - アクションオブジェクト { type: ActionType, payload?: StateActionPayload }
   */
  dispatch(action) {
    if (this.isUpdating) {
      console.warn('状態更新中のため処理をスキップ');
      return;
    }

    if (!window.isProduction) {
      console.log(
        '🎯 Action dispatched:',
        action.type,
        action.payload ? Object.keys(action.payload) : 'no payload',
      );
    }

    // 現在のビューを記録（ページ遷移判定用）
    const previousView = this.state.view;

    // アクションに基づいて状態更新
    let newState = {};
    switch (action.type) {
      case 'SET_STATE':
        newState = action.payload || {};
        break;
      case 'UPDATE_STATE':
        newState = action.payload || {};
        break;
      case 'CHANGE_VIEW':
        newState = { view: action.payload.view };
        break;
      case 'NAVIGATE':
        newState = this._handleNavigate(action.payload);
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
      window.pageTransitionManager
    ) {
      const viewValue = /** @type {ViewType} */ (newState.view);
      window.pageTransitionManager.onPageTransition(viewValue);
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

      if (!window.isProduction) {
        if (
          typeof ENVIRONMENT_CONFIG !== 'undefined' &&
          typeof ENVIRONMENT_CONFIG.DEBUG_ENABLED !== 'undefined' &&
          ENVIRONMENT_CONFIG.DEBUG_ENABLED
        )
          console.log('✅ 状態更新完了:', Object.keys(newState));
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

    // isFirstTimeBooking の計算：予約データが全くない場合
    this.state.isFirstTimeBooking = this.state.myReservations.length === 0;
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
      if (typeof window.render === 'function') {
        console.log('🎨 Auto-rendering UI...');
        window.render();
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
    const { to, context = {}, saveHistory = true } = payload;
    const currentView = this.state.view;

    // 現在のビューを履歴に保存（もどる履歴として）
    if (saveHistory && currentView !== to) {
      const currentContext = this._extractCurrentContext();
      const historyEntry = { view: currentView, context: currentContext };

      // 同じビューの連続エントリを避ける
      const lastEntry =
        this.state.navigationHistory[this.state.navigationHistory.length - 1];
      if (!lastEntry || lastEntry.view !== currentView) {
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
      console.log('ナビゲーション履歴が空です - ホームに戻ります');
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
   */
  startEditMode(reservationId) {
    this.state.editingReservationIds.add(reservationId);
  }

  /**
   * 編集モードを終了する
   * @param {string} reservationId - 予約ID
   */
  endEditMode(reservationId) {
    this.state.editingReservationIds.delete(reservationId);
  }

  /**
   * 指定された予約が編集モードかチェック
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
  }
}

// グローバルインスタンスを作成
window.stateManager = new SimpleStateManager();
