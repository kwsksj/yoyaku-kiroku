// @ts-check
/// <reference path="../types.d.ts" />

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
    this.state = {
      // --- User & Session Data ---
      /** @type {{studentId: string, realName: string, displayName: string, phone: string} | null} */
      currentUser: null,
      /** @type {string} */
      loginPhone: '',
      /** @type {boolean} */
      isFirstTimeBooking: false,
      /** @type {Object} */
      registrationData: {},
      /** @type {string | null} */
      registrationPhone: null,

      // --- Core Application Data ---
      /** @type {Array<Object>} */
      slots: [],
      /** @type {Array<Object>} */
      myReservations: [],
      /** @type {Array<Object>} */
      accountingMaster: [],
      /** @type {Array<string>} */
      classrooms: [],
      /** @type {Object | null} */
      constants: null,

      // --- UI State ---
      /** @type {string} */
      view: 'login',
      /** @type {string | null} */
      selectedClassroom: null,
      /** @type {Object | null} */
      selectedSlot: null,
      /** @type {Object | null} */
      editingReservationDetails: null,
      /** @type {Object | null} - 会計画面の基本予約情報 (ID, 教室, 日付など) */
      accountingReservation: null,
      /** @type {Object} - 予約固有の詳細情報 (開始時刻, レンタル, 割引など) */
      accountingReservationDetails: {},
      /** @type {Object | null} - 講座固有情報 (教室形式, 開講時間など) */
      accountingScheduleInfo: null,
      /** @type {string} */ completionMessage: '',
      /** @type {number} */ recordsToShow: 10,
      /** @type {Array<Object>} */
      searchedUsers: [],
      /** @type {boolean} */
      searchAttempted: false,

      // --- Navigation History ---
      /** @type {Array<{view: string, context: Object}>} */
      navigationHistory: [],

      // --- System State ---
      /** @type {boolean} */
      isDataFresh: false,
      /** @type {boolean} */
      _dataUpdateInProgress: false,
      /** @type {string | null} */
      _slotsVersion: null,

      // --- Computed Data ---
      computed: {},
    };

    this.isUpdating = false; // 無限ループ防止フラグ
    this.subscribers = []; // 状態変更の購読者リスト

    // フォールバック統一定数を即座に設定（エラー回避）
    this.initializeFallbackConstants();
  }

  /**
   * アクションをディスパッチして状態を更新し、UIを自動再描画
   * @param {Object} action - アクションオブジェクト { type: 'ACTION_NAME', payload: { ... } }
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
      newState.view &&
      newState.view !== previousView &&
      window.pageTransitionManager
    ) {
      window.pageTransitionManager.onPageTransition(newState.view);
    }

    // 最終的な状態更新（画面遷移を伴う）でのみローディング非表示を実行
    const isViewChange = newState.view && newState.view !== previousView;
    const hasSubstantialData =
      newState.slots || newState.myBookings || newState.currentUser;
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
   * @param {Object} newState - 新しい状態
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

      // 統一定数が設定された場合、グローバル短縮参照を初期化
      // window.Cがフォールバックで空オブジェクト{}で初期化されるため、
      // !window.Cでは正しく判定できない。
      // オブジェクトが空かどうかもチェックする。
      if (
        newState.constants &&
        (!window.C || Object.keys(window.C).length === 0)
      ) {
        this.initializeGlobalConstants();
      }

      // 基本的な計算済みデータ更新
      this.updateComputed();

      // subscriberに変更を通知
      this._notifySubscribers(this.state, oldState);

      if (!window.isProduction) {
        if (typeof DEBUG_ENABLED !== 'undefined' && DEBUG_ENABLED)
          console.log('✅ 状態更新完了:', Object.keys(newState));
      }
    } catch (error) {
      console.error('❌ 状態更新エラー:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * グローバル統一定数の短縮参照を初期化
   */
  initializeGlobalConstants() {
    if (!this.state.constants) return;

    const constants = this.state.constants;

    // 必要な配列データを状態に設定
    if (constants.classrooms && !this.state.classrooms.length) {
      this.state.classrooms = Object.values(constants.classrooms);
      if (!window.isProduction) {
        console.log('📋 教室一覧を状態に設定:', this.state.classrooms);
      }
    }

    // UI設定の初期化
    if (!this.state.recordsToShow && constants.ui?.HISTORY_INITIAL_RECORDS) {
      this.state.recordsToShow = constants.ui.HISTORY_INITIAL_RECORDS;
      if (!window.isProduction) {
        console.log('📋 履歴表示件数を初期化:', this.state.recordsToShow);
      }
    }

    // グローバル短縮参照を設定
    window.C = constants;
    window.STATUS = constants.status || {};
    window.UI = constants.ui || {};
    window.MESSAGES = constants.messages || {};
    window.BANK = constants.bankInfo || {};
    window.PAYMENT = constants.paymentDisplay || {};
    window.HEADERS = constants.headers || {}; // 統合ヘッダー定数をフロントエンドで利用可能に

    if (!window.isProduction) {
      console.log('📋 統一定数グローバル参照を初期化:', Object.keys(constants));
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
   * フォールバック用のグローバル定数を初期化する
   * サーバーから本物の定数が読み込まれるまでの間のエラーを回避する
   */
  initializeFallbackConstants() {
    if (window.C && Object.keys(window.C).length > 0) return; // 既に設定済みなら何もしない

    window.C = {};
    window.STATUS = {
      CANCELED: '取消',
      WAITLISTED: '待機',
      CONFIRMED: '確定',
      COMPLETED: '完了',
    };
    window.UI = {
      HISTORY_INITIAL_RECORDS: 10,
      HISTORY_LOAD_MORE_RECORDS: 10,
      LOADING_MESSAGE_INTERVAL: 2000,
      MODAL_FADE_DURATION: 300,
    };
    window.MESSAGES = {
      CANCEL: 'キャンセル',
      SAVE: '保存する',
      EDIT: '編集',
      SUCCESS: '成功',
      ERROR: 'エラー',
    };
    window.BANK = {};
    window.PAYMENT = { CASH: '現金' };
    console.log('📋 フォールバック定数を初期化しました');
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
   */
  getState() {
    return this.state;
  }

  /**
   * 状態変更を購読する
   * @param {Function} callback - 状態変更時に呼び出される関数 (newState, oldState) => void
   * @returns {Function} unsubscribe関数
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
   * @param {Object} newState - 新しい状態
   * @param {Object} oldState - 古い状態
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
   * @param {Object} payload - { to: string, context?: Object, saveHistory?: boolean }
   * @returns {Object} 新しい状態
   */
  _handleNavigate(payload) {
    const { to, context = {}, saveHistory = true } = payload;
    const currentView = this.state.view;

    // 現在のビューを履歴に保存（戻る履歴として）
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
   * @returns {Object} コンテキストオブジェクト
   */
  _extractCurrentContext() {
    const context = {};

    // ビューに応じて重要な状態を保存
    switch (this.state.view) {
      case 'booking':
        if (this.state.selectedClassroom) {
          context.selectedClassroom = this.state.selectedClassroom;
        }
        break;
      case 'newReservation':
      case 'editReservation':
        if (this.state.selectedSlot) {
          context.selectedSlot = this.state.selectedSlot;
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
   * 前のビューに戻る
   * @returns {Object} 新しい状態、または戻れない場合はnull
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
   * データの整合性チェック（デバッグ用）
   * @param {Object} dataObj - チェック対象のオブジェクト
   * @param {string} dataType - データタイプ ('reservations', 'schedule' など)
   */
  validateDataStructure(dataObj, dataType = 'reservations') {
    if (!window.HEADERS || !dataObj) return true;

    const expectedHeaders =
      dataType === 'schedule'
        ? window.HEADERS.SCHEDULE
        : window.HEADERS.RESERVATIONS;

    if (!expectedHeaders) return true;

    // 重要なプロパティの存在チェック
    const requiredProperties = ['date', 'classroom'];
    const missingProperties = requiredProperties.filter(prop => !dataObj[prop]);

    if (missingProperties.length > 0) {
      console.warn(`データ整合性チェック: 必須プロパティが不足`, {
        dataType,
        missing: missingProperties,
        data: dataObj,
      });
      return false;
    }

    return true;
  }
}

// グローバルインスタンスを作成
window.stateManager = new SimpleStateManager();
