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

// =================================================================
// --- Divided Core Files Reference ---
// -----------------------------------------------------------------
// 以下の機能は専用ファイルに分割されました：
//
// 📁 12_WebApp_Core_Search.js - 統一検索システム
//   - findReservationById(reservationId, state)
//   - findReservationByDateAndClassroom(date, classroom, state)
//   - findReservationsByStatus(status, state)
//
// 📁 12_WebApp_Core_Data.js - データ処理・環境管理
//   - processInitialData(data, phone, lessons, myReservations)
//   - detectEnvironment()
//   - getEnvironmentData(dataType, fallback)
//   - ModalManager オブジェクト
//   - StateManager 初期化処理
//   - スケジュール関連ヘルパー関数
//
// 📁 12_WebApp_Core_Accounting.js - 会計計算ロジック
//   - calculateAccountingDetails()
//   - calculateAccountingDetailsFromForm()
//   - calculateTimeBasedTuition(tuitionItemRule)
//   - 各種計算ヘルパー関数
//   - 会計キャッシュ機能
//
// 📁 12_WebApp_Core_ErrorHandler.js - エラーハンドリング
//   - FrontendErrorHandler クラス
//   - handleServerError(err) 互換関数
//   - グローバル・Promise拒否エラー処理
//   - 開発/本番環境対応ログ出力
//
// 📁 14_WebApp_Handlers_Utils.js - 統合済みユーティリティ
//   - normalizePhoneNumberFrontend(phoneInput)
//   - buildSalesChecklist(accountingMaster, checkedValues, title)
//   - formatDate(dStr)
//   - 各種DOM型安全ヘルパー関数
// =================================================================

// =================================================================
// --- Loading Message System ---
// -----------------------------------------------------------------
// UI-11: ローディングメッセージの多様化機能
// 状況に応じたメッセージとユーモラスなメッセージをランダムに表示し、
// 数秒ごとに自動で切り替える機能を提供します。
// =================================================================

/** @type {number | null} */
export let loadingMessageTimer = null;

export const LoadingMessages = {
  // ログイン時のメッセージ
  login: [
    'めいぼ を さがしています...',
    'めいぼ じたい を さがしています...',
    'めいぼ の うらの めも を かくにん しています...',
    'きろく を かくにん しています...',
    'しょるい を ひもといています...',
    'なまえ を かくにん しています...',
    'なまえ の よみかた を かくにん しています...',
    'かお を おもいだしています...',
    'おみやげ を おもいだしています...',
    'さくひん を おもいだしています...',
    'とうろく が あるか しらべています...',
    'でんわばんごう を かくにん しています...',
    'ひと と なり を そうぞう しています...',
    'にがお え を かいています...',
  ],

  // 申し込み時のメッセージ
  booking: [
    'よやく を もうしこみ ちゅうです...',
    'しんせいしょ を ていしゅつ しています...',
    'はんこ を さがしています...',
    'ひづけ を かくにん しています...',
    'かれんだー に かきこんでいます...',
    'せき を ようい しています...',
    'きぼう を かなえようとしています...',
    'いろいろな ちょうせい を しています...',
    'そうごうてきに ちょうせい を しています...',
    'しょるい の けいしき を かくにんしています...',
    'じゅんばん に ならべています...',
  ],

  // 予約キャンセル時のメッセージ
  cancel: [
    'よやく を とりけしています...',
    'けしごむ を さがしています...',
    'とりけしせん を ひいています...',
    'おだいじに と おもっています...',
    'また こんど を たのしみにしています...',
    'べつの ひ を かんがえています...',
  ],

  // 予約編集時のメッセージ
  edit: [
    'へんこう を ほぞんしています...',
    'あたらしい ないよう に かきかえています...',
    'まちがい が ないか かくにんしています...',
    'かんがえなおして みています...',
    'こだわり を ちょうせい しています...',
  ],

  // 会計時のメッセージ
  accounting: [
    'でんぴょう を おくっています...',
    'ちょうぼ を つけています...',
    'おかね を かぞえています...',
    'おつり を じゅんびしています...',
    'そろばん を はじいています...',
    'けいさんき を たたいています...',
    'ぽけっと を さがしています...',
    'けいりのひと を よんでいます...',
  ],

  // データ取得時のメッセージ
  dataFetch: [
    'いろいろなもの を ひっくりかえしています...',
    'さがしもの を さがしています...',
    'たいせつなこと を おもいだしています...',
    'むこうのほう を のぞいています...',
    'じょうほう を つかまえています...',
    'しょるい を ひっくりかえしています...',
  ],

  // デフォルトのメッセージ
  default: [
    'せんせい を さがしています...',
    'しょるい を せいり しています...',
    'しょるい を ながめています...',
    'しょるい の けいしき を かくにん しています...',
    'しょるい を ぶんるい しています...',
    'きくず を かたずけています...',
    'ことば を えらんでいます...',
    'ていさい を ととのえています...',
    'みぎ の もの を ひだり に うごかしています...',
    'ひだり の もの を みぎ に うごかしています...',
    'こーひー を いれています...',
    'すこし きゅうけい しています...',
    'ねこ の て を かりようとしています...',
    'はむすたー の て を かりようとしています...',
    'ぞう の はな を かりようとしています...',
    'めだか を ながめています...',
    'めだか を かぞえています...',
    'はもの を ととのえています...',
    'てん と てん を むすんでいます...',
    'あたま を かくにん しています...',
    'せんせい は しゅうちゅう しています...',
    'せんせい は いま むかっています...',
    'あぷり を かいりょう しています...',
    'ぜんたい と ぶぶん を かんがえています...',
    'やらないといけないこと を ながめています...',
    'あたらしい こと を かんがえています...',
    'できあがり を おもいえがいています...',
    'つくえ の うえ で しごとらしきこと を しています...',
    'まるい もの を しかくく しようとしています...',
    'しかくい もの を まるく しようとしています...',
    'しかくい もの を よりしかくく しようとしています...',
    'おもしろい かたち を かんがえています...',
    'じかん が ゆっくり すぎています...',
    'じかん が あっというまに すぎています...',
    'いい かたち を さがしています...',
    'それらしい ことば を さがしています...',
    'なにをしようとしていたのか を おもいだしています...',
    'かたち を ながめています...',
  ],
};

export const getRandomMessage = (category = 'default') => {
  const loadingMessages = /** @type {Record<string, string[]>} */ (
    LoadingMessages
  );
  const messages = [
    ...(loadingMessages[category] || []),
    ...LoadingMessages.default,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

export const updateLoadingMessage = (category = 'default') => {
  /** @type {HTMLElement | null} */
  const messageElement = document.getElementById('loading-message');
  if (messageElement) {
    messageElement.textContent = getRandomMessage(category);
  }
};

export const startLoadingMessageRotation = (category = 'default') => {
  // 初期メッセージを設定
  updateLoadingMessage(category);

  // 3秒ごとにメッセージを更新
  loadingMessageTimer = setInterval(
    () => {
      updateLoadingMessage(category);
    },
    /** @type {number} */ (CONSTANTS.UI?.LOADING_MESSAGE_INTERVAL) || 3000,
  );
};

export const stopLoadingMessageRotation = () => {
  if (loadingMessageTimer) {
    clearInterval(loadingMessageTimer);
    loadingMessageTimer = null;
  }
};

window.showLoading =
  window.showLoading ||
  function (/** @type {string} */ category = 'default') {
    /** @type {HTMLElement | null} */
    const loadingElement = document.getElementById('loading');
    if (!loadingElement) return;

    // hiddenクラスを削除し、activeクラスを即座に追加して表示する
    loadingElement.classList.remove('hidden');
    loadingElement.classList.add('active');

    startLoadingMessageRotation(category);
  };

window.hideLoading =
  window.hideLoading ||
  function () {
    /** @type {HTMLElement | null} */
    const loadingElement = document.getElementById('loading');
    if (!loadingElement) return;

    loadingElement.classList.remove('active');

    // フェードアウト完了後に完全に非表示
    setTimeout(() => {
      loadingElement.classList.add('hidden');
      stopLoadingMessageRotation();
    }, 300); // CSS transitionと同じ時間
  };

// =================================================================
// --- Error Handling (moved to 12_WebApp_Core_ErrorHandler.js) ---
// -----------------------------------------------------------------
// エラーハンドリング機能は専用ファイルに分割されました：
//
// 📁 12_WebApp_Core_ErrorHandler.js - フロントエンド統一エラーハンドリング
//   - FrontendErrorHandler クラス
//   - handleServerError() 互換関数
//   - グローバルエラーハンドラー設定
//   - 開発/本番環境対応
//
// バックエンドエラーハンドリングは src/backend/08_ErrorHandler.js で管理
// =================================================================

// =================================================================
// --- Modal System ---
// -----------------------------------------------------------------
// モーダル表示とインタラクション管理
// =================================================================

/**
 * モーダル表示
 * @param {ModalDialogConfig} c - モーダル設定
 */
window.showModal =
  window.showModal ||
  /** @type {(c: ModalDialogConfig) => void} */ (
    c => {
      // モーダル表示時にスクロール位置を保存
      if (
        window.pageTransitionManager &&
        /** @type {any} */ (window.pageTransitionManager).onModalOpen
      ) {
        /** @type {any} */ (window.pageTransitionManager).onModalOpen();
      }

      /** @type {HTMLElement | null} */
      const m = document.getElementById('custom-modal');
      /** @type {HTMLElement | null} */
      const b = document.getElementById('modal-buttons');
      if (!m || !b) return;
      b.innerHTML = '';
      if (c.showCancel) {
        b.innerHTML += Components.button({
          text: c.cancelText || CONSTANTS.MESSAGES.CANCEL || 'キャンセル',
          action: 'modalCancel',
          style: 'secondary',
          size: 'normal',
        });
      }
      if (c.confirmText) {
        b.innerHTML += `<div class="w-3"></div>${Components.button({
          text: c.confirmText,
          action: 'modalConfirm',
          style: c.confirmColorClass?.includes('danger') ? 'danger' : 'primary',
          size: 'normal',
          disabled: /** @type {any} */ (c).disableConfirm,
        })}`;
      }
      ModalManager.setCallback(c.onConfirm);
      /** @type {HTMLElement | null} */
      const modalTitle = document.getElementById('modal-title');
      /** @type {HTMLElement | null} */
      const modalMessage = document.getElementById('modal-message');

      if (modalTitle) modalTitle.textContent = c.title;
      if (modalMessage) modalMessage.innerHTML = c.message;
      m.classList.add('active');
    }
  );

export const hideModal = () => {
  /** @type {HTMLElement | null} */
  const modal = document.getElementById('custom-modal');
  if (modal) modal.classList.remove('active');
  ModalManager.clearCallback();

  // モーダル非表示時にスクロール位置を復元
  if (
    window.pageTransitionManager &&
    /** @type {any} */ (window.pageTransitionManager).onModalClose
  ) {
    /** @type {any} */ (window.pageTransitionManager).onModalClose();
  }
};

/**
 * 情報モーダル表示
 * @param {string} msg - メッセージ
 * @param {string} t - タイトル
 * @param {VoidCallback|null} cb - コールバック
 */
window.showInfo =
  window.showInfo ||
  /** @type {(msg: string, t?: string, cb?: VoidCallback | null) => void} */ (
    (msg, t = '情報', cb = null) =>
      window.showModal({
        title: t,
        message: msg,
        confirmText: 'OK',
        confirmColorClass: DesignConfig.colors['primary'],
        onConfirm: cb,
      })
  );

/**
 * 確認モーダル表示
 * @param {ModalDialogConfig} c - モーダル設定
 */
window.showConfirm =
  window.showConfirm ||
  /** @type {(c: ModalDialogConfig) => void} */ (
    c => window.showModal({ ...c, showCancel: true })
  );

// =================================================================
// --- Event Listener Management ---
// -----------------------------------------------------------------
// イベントリスナーの登録・解除を追跡管理するヘルパー関数群
// メモリリーク防止のため、ビュー切り替え時に古いリスナーを確実に解除する
// =================================================================

/** @type {Array<{element: Element, type: string, listener: EventListener, options?: AddEventListenerOptions}>} */
export let activeListeners = [];

/**
 * 登録されたイベントリスナーを全て解除する
 */
export function teardownAllListeners() {
  activeListeners.forEach(({ element, type, listener, options }) => {
    if (element) {
      element.removeEventListener(type, listener, options);
    }
  });
  activeListeners = [];
}

/**
 * イベントリスナーを登録し、解除できるように追跡するヘルパー関数
 * @param {Element} element - 対象要素
 * @param {string} type - イベントタイプ
 * @param {EventListener} listener - リスナー関数
 * @param {AddEventListenerOptions} [options] - addEventListenerのオプション
 */
export function addTrackedListener(element, type, listener, options) {
  if (!element) {
    console.warn(
      `Attempted to add listener to a null element for event: ${type}`,
    );
    return;
  }
  element.addEventListener(type, listener, options);
  activeListeners.push({ element, type, listener, options });
}

/**
 * StateManagerの初期化後に追加する関数
 * ビュー変更時のイベントリスナー管理を設定
 */
export function setupViewListener() {
  if (!window.stateManager) {
    console.error('StateManager not initialized. Cannot set up view listener.');
    return;
  }

  window.stateManager.subscribe(
    (/** @type {UIState} */ newState, /** @type {UIState} */ oldState) => {
      // ビューが変更された場合のみ処理
      if (newState.view !== oldState.view) {
        // 古いビューのリスナーを全て解除
        teardownAllListeners();

        // 新しいビューに応じたリスナーを登録
        // requestAnimationFrameでDOMの描画を待つ
        requestAnimationFrame(() => {
          if (newState.view === 'accounting') {
            // 会計画面が表示された際の初期化処理
            // イベントリスナーは14_WebApp_Handlers.htmlのイベント委譲で処理されます。
            // ここでは、DOM描画後に初回計算を実行します。
            if (typeof updateAccountingCalculation === 'function') {
              // 会計画面用のデータを取得
              const classifiedItems =
                window.currentClassifiedItems ||
                /** @type {ClassifiedAccountingItemsCore} */ (
                  /** @type {unknown} */ ({
                    tuition: { items: [] },
                    sales: { materialItems: [], productItems: [] },
                  })
                );
              const classroom = window.currentClassroom || '';
              updateAccountingCalculation(classifiedItems, classroom);
            }
          }
          // 他のビューでリスナーが必要な場合はここに追加
          // else if (newState.view === 'someOtherView') {
          //   setupSomeOtherViewListeners();
          // }
        });
      }
    },
  );
}
