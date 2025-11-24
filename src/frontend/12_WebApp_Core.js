/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 12_WebApp_Core.js
 * 目的: フロントエンドの中核ユーティリティと分割モジュールの接着面を提供する
 * 主な責務:
 *   - 分割済みコアモジュールのガイドおよび一部レガシー関数の保持
 *   - ローディングメッセージなど共通ユーティリティの公開
 *   - 会計処理など他レイヤーへ委譲する際の最終フック
 * AI向けメモ:
 *   - 新しいコア機能を追加するときは、まず専用ファイルを作成し、本ファイルにはガイドと最小限の接着ロジックのみを残す
 * =================================================================
 */

// ================================================================
// ハンドラ系モジュール
// ================================================================
import { updateAccountingCalculation } from './12-3_Accounting_Handlers.js';

// =================================================================
// --- Divided Core Files Reference ---
// -----------------------------------------------------------------
// 以下の機能は専用ファイルに分割されました：
//
// 📁 12_WebApp_Core_Search.js - 統一検索システム
// 📁 12_WebApp_Core_Data.js - データ処理・環境管理
// 📁 12_WebApp_Core_Modal.js - モーダル管理
// 📁 12_WebApp_Core_Accounting.js - 会計計算ロジック
// 📁 12_WebApp_Core_ErrorHandler.js - エラーハンドリング
//
// 📁 14_WebApp_Handlers_Utils.js - 統合済みユーティリティ
// =================================================================

// =================================================================
// --- Loading Message System ---
// -----------------------------------------------------------------
// UI-11: ローディングメッセージの多様化機能
// 状況に応じたメッセージとユーモラスなメッセージをランダムに表示し、
// 数秒ごとに自動で切り替える機能を提供します。
// =================================================================

/** @type {ReturnType<typeof setInterval> | null} */
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
    'おとのない きこり を しようとしています...',
    'えんぴつ を けずっています...',
    'すこし はなうた を くちずさんでいます...',
    'ゆき の ようす を みています...',
    'おちゃ を すこし あたためています...',
    'むかしの きろく を ひっくりかえしています...',
    'いま は どの ように みえるか を かんがえています...',
    'どの じゅんばん で すすめるか を ならべています...',
    'みぎて と ひだりて の やくわり を はんだんしています...',
    'さいご の ひとおし を さがしています...',
    'まばたき の かず を かぞえています...',
    'ひとやすみ してから また かんがえています...',
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

appWindow.showLoading =
  appWindow.showLoading ||
  function (/** @type {string} */ category = 'default') {
    /** @type {HTMLElement | null} */
    const loadingElement = document.getElementById('loading');
    if (!loadingElement) return;

    // hiddenクラスを削除し、activeクラスを即座に追加して表示する
    loadingElement.classList.remove('hidden');
    loadingElement.classList.add('active');

    startLoadingMessageRotation(category);
  };

appWindow.hideLoading =
  appWindow.hideLoading ||
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
// --- Modal System (Moved) ---
// -----------------------------------------------------------------
// モーダル管理機能は 12_WebApp_Core_Modal.js に移動しました。
// =================================================================

// =================================================================
// --- Event Listener Management ---
// -----------------------------------------------------------------
// イベントリスナーの登録・解除を追跡管理するヘルパー関数群
// メモリリーク防止のため、ビュー切り替え時に古いリスナーを確実に解除する
// =================================================================

/** @type {Array<{element: Element, type: string, listener: EventListener, options?: AddEventListenerOptions}>} */
/** @type {Array<{ element: Element; type: string; listener: EventListener; options?: AddEventListenerOptions }>} */
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
  if (options) {
    activeListeners.push({ element, type, listener, options });
  } else {
    activeListeners.push({ element, type, listener });
  }
}

/**
 * StateManagerの初期化後に追加する関数
 * ビュー変更時のイベントリスナー管理を設定
 */
export function setupViewListener() {
  if (!appWindow.stateManager) {
    console.error('StateManager not initialized. Cannot set up view listener.');
    return;
  }

  appWindow.stateManager.subscribe(
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
                appWindow.currentClassifiedItems ||
                /** @type {ClassifiedAccountingItemsCore} */ (
                  /** @type {unknown} */ ({
                    tuition: { items: [] },
                    sales: { materialItems: [], productItems: [] },
                  })
                );
              const classroom = appWindow.currentClassroom || '';
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
