// @ts-check
/// <reference path="../types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 12_WebApp_Core.js
 * 【バージョン】: 1.2
 * 【役割】: WebAppのフロントエンドにおける中核機能を集約します。
 * - 状態管理 (State Management)
 * - UIコンポーネント生成 (UI Components)
 * - 汎用ユーティリティ (Utilities)
 * - 会計計算ロジック (Calculation Logic)
 * 【構成】: 14ファイル構成のうちの12番目
 * 【v1.2での変更点】:
 * - リファクタリング: フロントエンド単純化でmyReservations統一完了。
 * - コードの可読性とメンテナンス性を向上。
 * =================================================================
 */

/**
 * =================================================================
 * --- New Data Model Client-Side Processing (2025-08-19) ---
 * =================================================================
 */

// calculateSlotsFromReservations関数とtransformReservationArrayToObject関数は削除されました
// 予約データの処理は全てバックエンドで実行され、getAvailableSlots()とgetUserReservations()を使用します

/**
 * =================================================================
 * --- 統一検索関数システム (2025-08-30) ---
 * 「よやく」(myBookings) と「きろく」(history) を統一的に検索する関数群
 * =================================================================
 */

/**
 * 予約IDで「よやく」と「きろく」を統一的に検索します
 * @param {string} reservationId - 検索対象の予約ID
 * @param {object} state - stateManager.getState()の戻り値
 * @returns {object|null} 見つかった予約/記録データ、見つからない場合はnull
 */
function findReservationById(reservationId, state = null) {
  const currentState = state || window.stateManager?.getState();
  if (!currentState) return null;

  // myReservationsから直接検索
  const reservation = currentState.myReservations?.find(
    item => item.reservationId === reservationId,
  );
  if (reservation) {
    // ステータスに基づいてtype分類を追加
    if (reservation.status === window.STATUS.COMPLETED) {
      return { ...reservation, type: 'record' };
    } else {
      return { ...reservation, type: 'booking' };
    }
  }

  return null;
}

/**
 * 日付と教室で「よやく」と「きろく」を統一的に検索します
 * @param {string} date - 検索対象の日付 (YYYY-MM-DD)
 * @param {string} classroom - 検索対象の教室名
 * @param {object} state - stateManager.getState()の戻り値
 * @returns {object|null} 見つかった予約/記録データ、見つからない場合はnull
 */
function findReservationByDateAndClassroom(date, classroom, state = null) {
  const currentState = state || window.stateManager?.getState();
  if (!currentState) return null;

  // myReservationsから直接検索（キャンセル済みは既にバックエンドで除外済み）
  const reservation = currentState.myReservations?.find(
    item => item.date === date && item.classroom === classroom,
  );

  if (reservation) {
    // ステータスに基づいてtype分類を追加
    if (reservation.status === window.STATUS.COMPLETED) {
      return { ...reservation, type: 'record' };
    } else {
      return { ...reservation, type: 'booking' };
    }
  }

  return null;
}

/**
 * 指定されたステータスの予約/記録を検索します
 * @param {string} status - 検索対象のステータス
 * @param {object} state - stateManager.getState()の戻り値
 * @returns {Array} 条件に合致する予約/記録の配列
 */
function findReservationsByStatus(status, state = null) {
  const currentState = state || window.stateManager?.getState();
  if (!currentState) return [];

  // myReservationsから直接検索
  const reservations =
    currentState.myReservations?.filter(item => item.status === status) || [];

  // ステータスに基づいてtype分類を追加
  return reservations.map(item => {
    if (item.status === window.STATUS.COMPLETED) {
      return { ...item, type: 'record' };
    } else {
      return { ...item, type: 'booking' };
    }
  });
}

/**
 * 新しい初期データを受け取り、クライアントサイドで処理してappStateを構築する
 * @param {object} data - getAppInitialDataから返されたデータオブジェクト (allStudents, accountingMaster, etc.)
 * @param {string} phone - ログイン試行された電話番号
 * @param {Array} availableSlots - バックエンドから取得済みの空席情報
 * @param {object | null} userReservations - ユーザーの予約と履歴データ {myBookings, myHistory}
 * @returns {object} setStateに渡すための新しい状態オブジェクト。ユーザーが見つからない場合は { currentUser: null }
 */
function processInitialData(
  data,
  phone,
  availableSlots,
  userReservations = null,
) {
  const { allStudents, accountingMaster, cacheVersions, today, constants } =
    data;

  // 1. 電話番号でユーザーを検索
  const currentUser = Object.values(allStudents).find(
    student => student.phone === phone,
  );

  if (!currentUser) {
    return { currentUser: null }; // ユーザーが見つからない
  }

  // currentUserのdisplayNameをセット
  currentUser.displayName = currentUser.nickname || currentUser.realName;

  // 2. 個人予約データを直接保存（フィルタリングは表示時に実行）
  const myReservations = userReservations
    ? userReservations.myReservations
    : [];

  // 3. 教室一覧は統合定数から取得（StateManagerで設定される）
  // availableSlots から取得する必要はなくなった
  const classroomsFromConstants = constants
    ? Object.values(constants.classrooms)
    : [];

  // 4. 空き枠バージョンを生成
  const slotsVersion = cacheVersions
    ? `${cacheVersions.allReservations || 0}-${cacheVersions.scheduleMaster || 0}`
    : null;

  // 5. appStateを構築（フィルタリングされていない生の予約データを保存）
  return {
    view: 'dashboard',
    currentUser: currentUser,
    myReservations: myReservations, // 生データを直接保存
    slots: availableSlots,
    classrooms: classroomsFromConstants,
    accountingMaster: accountingMaster,
    today: today,
    constants: constants, // 統一定数を追加
    _allStudents: allStudents,
    _cacheVersions: cacheVersions,
    _slotsVersion: slotsVersion, // 空き枠バージョンを設定
  };
}

// =================================================================
// --- Application State Management ---
// -----------------------------------------------------------------
// アプリケーション全体の動的な状態を一元管理します。
// ユーザー情報、予約データ、現在の表示画面などが含まれます。
// =================================================================

// =================================================================
// --- Environment Detection & Data Management ---
// -----------------------------------------------------------------
// 実行環境を自動検出し、適切なデータソースを選択します。
// テスト環境: ブラウザ + モックデータ
// 本番環境: Google Apps Script + 実データ
// =================================================================

/**
 * 実行環境の検出
 * @returns {string} 'test' | 'production'
 */
const detectEnvironment = () => {
  try {
    // GAS環境の検出
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return 'production';
    }
    return 'test';
  } catch (error) {
    return 'test';
  }
};

/**
 * 環境に応じたデータ取得
 * @param {string} dataType - データタイプ
 * @param {any} fallback - フォールバックデータ
 */
const getEnvironmentData = (dataType, fallback = null) => {
  const env = detectEnvironment();

  if (env === 'test' && typeof MockData !== 'undefined') {
    return MockData[dataType] || fallback;
  }

  // GAS環境では初期値のみ返し、データは後でAPI呼び出しで取得
  return fallback;
};

// StateManagerの再初期化（依存関数が読み込まれた後）
if (
  typeof window.initializeStateManager === 'function' &&
  !window.stateManager
) {
  console.log('🔄 StateManagerを再初期化中...');
  window.initializeStateManager();
}

// StateManagerが初期化された後にビューリスナーを設定
// DOMContentLoadedまたはページ読み込み完了後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.stateManager && typeof setupViewListener === 'function') {
      setupViewListener();
    }
  });
} else {
  // 既にDOMが読み込み済みの場合は即座に実行
  if (window.stateManager && typeof setupViewListener === 'function') {
    setupViewListener();
  }
}

// 注意: appStateオブジェクトは新しいStateManagerシステム（12_WebApp_StateManager.html）に移行されました
// 下位互換性のため、appStateとsetStateは自動的にStateManagerにマッピングされます

// 既存コード互換性のため、appStateは12_WebApp_StateManager.htmlで定義され、
// window.appStateとして公開されています

/**
 * モーダル管理オブジェクト
 * カプセル化された方式でモーダルのコールバック処理を管理する
 * グローバル変数の乱用を避けるための設計
 */
const ModalManager = {
  onConfirmCallback: null,

  /**
   * モーダル確認時のコールバック関数を設定
   * @param {Function} callback - 確認ボタン押下時に実行する関数
   */
  setCallback: function (callback) {
    this.onConfirmCallback = callback;
  },

  /**
   * 設定されたコールバック関数をクリア
   */
  clearCallback: function () {
    this.onConfirmCallback = null;
  },

  /**
   * 設定されたコールバック関数を実行し、自動でクリアする
   * モーダル確認ボタンから呼び出される
   */
  executeCallback: function () {
    if (this.onConfirmCallback) {
      this.onConfirmCallback();
      this.clearCallback();
    }
  },
};

// =================================================================
// --- Utility Functions ---
// -----------------------------------------------------------------

/**
 * 電話番号を正規化します（全角→半角、ハイフン削除、バリデーション）
 * サーバーサイドのnormalizePhoneNumber関数と同等の処理をフロントエンドで実行
 * @param {string} phoneInput - 入力された電話番号
 * @returns {{normalized: string, isValid: boolean, error?: string}} 正規化結果
 */
window.normalizePhoneNumberFrontend = function (phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') {
    return {
      normalized: '',
      isValid: false,
      error: '電話番号を入力してください',
    };
  }

  // 全角数字を半角に変換
  let normalized = phoneInput.replace(/[０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 65248),
  );

  // 各種ハイフンを削除
  normalized = normalized.replace(/[‐－\-]/g, '');

  // 空白文字を削除
  normalized = normalized.replace(/\s/g, '');

  // 国番号の自動修正処理
  // +81または81で始まる場合は日本の標準形式に変換
  if (normalized.startsWith('+81')) {
    normalized = '0' + normalized.substring(3);
  } else if (normalized.startsWith('81') && normalized.length >= 12) {
    // 81で始まり、12桁以上の場合（81 + 11桁の日本の番号）
    normalized = '0' + normalized.substring(2);
  }

  // 数字以外の文字をチェック
  if (!/^\d+$/.test(normalized)) {
    return {
      normalized: '',
      isValid: false,
      error: '電話番号は数字のみ入力してください',
    };
  }

  // 桁数チェック（日本の携帯・固定電話は11桁または10桁）
  if (normalized.length !== 11 && normalized.length !== 10) {
    return {
      normalized: '',
      isValid: false,
      error: '電話番号は10桁または11桁で入力してください',
    };
  }

  // 先頭番号チェック（日本の電話番号パターン）
  if (normalized.length === 11 && !normalized.startsWith('0')) {
    return {
      normalized: '',
      isValid: false,
      error: '11桁の電話番号は0から始まる必要があります',
    };
  }

  return { normalized, isValid: true };
};

// =================================================================
// --- UI Components (Moved to 13_WebApp_Components.html) ---
// -----------------------------------------------------------------
// UIコンポーネント生成関数群は13_WebApp_Components.htmlに移動されました。
//
// 移行された内容:
// - window.escapeHTML 関数
// - Components オブジェクト（全コンポーネント）
// - 新設計のシンプル化されたコンポーネント
// - レガシー互換性サポート
// =================================================================

// =================================================================
// --- Loading Message System ---
// -----------------------------------------------------------------
// UI-11: ローディングメッセージの多様化機能
// 状況に応じたメッセージとユーモラスなメッセージをランダムに表示し、
// 数秒ごとに自動で切り替える機能を提供します。
// =================================================================
let loadingMessageTimer = null;

const LoadingMessages = {
  // ログイン時のメッセージ
  login: [
    'めいぼ を さがしています...',
    'めいぼ じたい を さがしています...',
    'めいぼ の うらの めも を かくにん しています...',
    'きろく を かくにん しています...',
    'しょるい を ひもといて しています...',
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
    'そう の はな を かりようとしています...',
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

const getRandomMessage = (category = 'default') => {
  const messages = [
    ...(LoadingMessages[category] || []),
    ...LoadingMessages.default,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

const updateLoadingMessage = (category = 'default') => {
  const messageElement = document.getElementById('loading-message');
  if (messageElement) {
    messageElement.textContent = getRandomMessage(category);
  }
};

const startLoadingMessageRotation = (category = 'default') => {
  // 初期メッセージを設定
  updateLoadingMessage(category);

  // 3秒ごとにメッセージを更新
  loadingMessageTimer = setInterval(() => {
    updateLoadingMessage(category);
  }, UI?.LOADING_MESSAGE_INTERVAL || 3000);
};

const stopLoadingMessageRotation = () => {
  if (loadingMessageTimer) {
    clearInterval(loadingMessageTimer);
    loadingMessageTimer = null;
  }
};

const showLoading = (category = 'default') => {
  const loadingElement = document.getElementById('loading');

  loadingElement.classList.remove('hidden');

  // フェードインアニメーション
  requestAnimationFrame(() => {
    loadingElement.classList.add('active');
  });

  startLoadingMessageRotation(category);
};

const hideLoading = () => {
  const loadingElement = document.getElementById('loading');

  loadingElement.classList.remove('active');

  // フェードアウト完了後に完全に非表示
  setTimeout(() => {
    loadingElement.classList.add('hidden');
    stopLoadingMessageRotation();
  }, 300); // CSS transitionと同じ時間
};

// =================================================================
// --- General Utilities ---
/**
 * 販売品マスタから物販チェックリスト（折り畳み可能）を生成する関数
 * @param {Array} accountingMaster - 販売品マスタ
 * @param {Array} checkedValues - チェック済み項目名配列（任意）
 * @param {string} [title='販売品リスト'] - 見出しタイトル
 * @returns {string} HTML文字列
 */
function buildSalesChecklist(
  accountingMaster,
  checkedValues = [],
  title = '販売品リスト',
) {
  const salesList = (accountingMaster || []).filter(
    item => item['種別'] === '物販',
  );
  if (!salesList.length) return '';
  const checklistHtml = getSalesCheckboxListHtml(salesList, checkedValues);
  return `
    <details class="mt-4">
      <summary class="cursor-pointer font-bold text-base py-2 px-3 bg-ui-surface border border-ui-border rounded hover:bg-ui-hover">${title} <span class="ml-2 text-sm text-brand-subtle">（クリックで展開）</span></summary>
      <div class="pt-2">${checklistHtml}</div>
    </details>
  `;
}
/**
 * 物販リストをチェックボックスで表示するHTMLを返す（再利用可能）
 * @param {Array} salesList - 物販アイテム配列
 * @param {Array} checkedValues - チェック済み項目名配列（任意）
 * @returns {string} HTML文字列
 */
function getSalesCheckboxListHtml(salesList, checkedValues = []) {
  if (!salesList || salesList.length === 0) return '';
  return `
    <div class="mt-4 pt-4 border-t">
      <label class="font-bold mb-2 block">購入希望（チェック可）</label>
      <div class="grid grid-cols-1 gap-2">
        ${salesList
          .map(
            item => `
          <label class="flex items-center space-x-2">
            <input type="checkbox" name="orderSales" value="${item[HEADERS.ACCOUNTING.ITEM_NAME]}" class="accent-action-primary-bg" ${checkedValues.includes(item[HEADERS.ACCOUNTING.ITEM_NAME]) ? 'checked' : ''}>
            <span>${item[HEADERS.ACCOUNTING.ITEM_NAME]}${item[HEADERS.ACCOUNTING.UNIT_PRICE] ? `（${item[HEADERS.ACCOUNTING.UNIT_PRICE]}円）` : ''}</span>
          </label>
        `,
          )
          .join('')}
      </div>
    </div>`;
}
// -----------------------------------------------------------------
// 日付のフォーマット、モーダルダイアログなど、
// アプリ全体で汎用的に使用されるヘルパー関数群です。
// =================================================================

// =================================================================
// 統一エラーハンドリングシステム（08_ErrorHandler.jsから統合）
// =================================================================

/**
 * フロントエンド統一エラーハンドラー
 */
class FrontendErrorHandler {
  /**
   * エラーを処理し、ユーザーに適切に通知
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @param {Object} additionalInfo - 追加情報
   */
  static handle(error, context = '', additionalInfo = {}) {
    hideLoading(); // 既存のローディング非表示処理

    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      context: context,
      timestamp: new Date().toISOString(),
      userId:
        (window.stateManager &&
          window.stateManager.getState().currentUser?.studentId) ||
        'anonymous',
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalInfo: additionalInfo,
    };

    // コンソールログに出力
    console.error('[ERROR]', context, errorInfo);

    // ユーザーへの通知
    const userMessage = this.getUserFriendlyMessage(error, context);
    showInfo(userMessage, 'エラー');

    // 重要なエラーの場合は詳細ログを送信（将来的にSentryなどへ）
    if (this.isCriticalError(error)) {
      this.reportError(errorInfo);
    }
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを生成
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @returns {string} ユーザー向けメッセージ
   */
  static getUserFriendlyMessage(error, context) {
    // コンテキストに基づいて適切なメッセージを返す
    const contextMessages = {
      login:
        'ログイン処理中にエラーが発生しました。電話番号を確認してもう一度お試しください。',
      booking:
        '予約処理中にエラーが発生しました。時間をおいてもう一度お試しください。',
      cancel:
        'キャンセル処理中にエラーが発生しました。時間をおいてもう一度お試しください。',
      accounting:
        '会計処理中にエラーが発生しました。入力内容を確認してもう一度お試しください。',
      'data-load':
        'データの読み込み中にエラーが発生しました。ページを更新してもう一度お試しください。',
    };

    return (
      contextMessages[context] ||
      `エラーが発生しました: ${error.message}\n\n時間をおいてもう一度お試しください。`
    );
  }

  /**
   * 重要なエラーかどうかを判定
   * @param {Error} error - エラーオブジェクト
   * @returns {boolean}
   */
  static isCriticalError(error) {
    const criticalMessages = [
      'Script runtime exceeded',
      'Service invoked too many times',
      'Network error',
      'Timeout',
    ];

    return criticalMessages.some(
      msg => error.message && error.message.includes(msg),
    );
  }

  /**
   * エラーレポート送信（将来的にSentryなどの監視サービスへ）
   * @param {Object} errorInfo - エラー情報
   */
  static reportError(errorInfo) {
    // 現在はコンソールログのみ
    // 将来的にSentry、Bugsnag、LogRocketなどに送信
    console.log('[CRITICAL ERROR REPORT]', errorInfo);

    // 管理者への緊急通知も検討
    // この部分は将来的に実装予定
  }
}

/**
 * 既存のhandleServerError関数との互換性を保つラッパー関数
 * 段階的移行のため既存コードとの互換性を維持
 * @param {Error} err - サーバーから返されたエラーオブジェクト
 */
function handleServerError(err) {
  FrontendErrorHandler.handle(err, 'server-error');
}

// グローバルエラーハンドラーの設定
window.addEventListener('error', event => {
  FrontendErrorHandler.handle(event.error, 'global-error', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

// Promise拒否エラーのハンドリング
window.addEventListener('unhandledrejection', event => {
  FrontendErrorHandler.handle(
    new Error(event.reason),
    'unhandled-promise-rejection',
  );
});

const formatDate = dStr => {
  if (!dStr) return '';
  const d = new Date(dStr);
  if (isNaN(d)) return '';
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  const day = d.getDay();
  const wd = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()} <span class="font-bold ${day === 0 ? 'text-ui-weekend-sunday' : day === 6 ? 'text-ui-weekend-saturday' : ''}">${wd[day]}</span>`;
};
const showModal = c => {
  // モーダル表示時にスクロール位置を保存
  if (window.pageTransitionManager) {
    window.pageTransitionManager.onModalOpen();
  }

  const m = document.getElementById('custom-modal'),
    b = document.getElementById('modal-buttons');
  b.innerHTML = '';
  if (c.showCancel) {
    b.innerHTML += Components.createButton({
      text:
        c.cancelText ||
        window.stateManager.getState().constants?.messages?.CANCEL ||
        'キャンセル',
      action: 'modalCancel',
      colorClass: DesignConfig.colors.secondary,
      widthClass: DesignConfig.buttons.auto,
    });
  }
  if (c.confirmText) {
    b.innerHTML += `<div class="w-3"></div>${Components.createButton({ text: c.confirmText, action: 'modalConfirm', colorClass: c.confirmColorClass, widthClass: DesignConfig.buttons.auto, disabled: c.disableConfirm })}`;
  }
  ModalManager.setCallback(c.onConfirm);
  document.getElementById('modal-title').textContent = c.title;
  document.getElementById('modal-message').innerHTML = c.message;
  m.classList.add('active');
};
const hideModal = () => {
  document.getElementById('custom-modal').classList.remove('active');
  ModalManager.clearCallback();

  // モーダル非表示時にスクロール位置を復元
  if (window.pageTransitionManager) {
    window.pageTransitionManager.onModalClose();
  }
};
const showInfo = (msg, t = '情報', cb = null) =>
  showModal({
    title: t,
    message: msg,
    confirmText: 'OK',
    confirmColorClass: DesignConfig.colors.primary,
    onConfirm: cb,
  });
const showConfirm = c => showModal({ ...c, showCancel: true });

// =================================================================
// --- Computed Data Management ---
// -----------------------------------------------------------------
// stateManager.getState().computedの計算・更新処理を管理します。
// =================================================================

// =================================================================
// --- Accounting Cache Utilities ---
// -----------------------------------------------------------------
// FE-14: 会計入力内容をlocalStorageに一時保存する機能
// =================================================================

/**
 * 会計入力のキャッシュデータをlocalStorageに保存する
 * @param {string} reservationId - 予約ID
 * @param {object} accountingData - 保存する会計データオブジェクト
 */
function saveAccountingCache(reservationId, accountingData) {
  if (!reservationId || !accountingData) return;
  const cacheKey = `accounting_cache_${reservationId}`;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(accountingData));
  } catch (e) {
    console.error('Failed to save accounting cache:', e);
  }
}

/**
 * localStorageから会計入力のキャッシュデータを読み込む
 * @param {string} reservationId - 予約ID
 * @returns {object|null} - 読み込んだ会計データオブジェクト、またはnull
 */
function loadAccountingCache(reservationId) {
  if (!reservationId) return null;

  const cacheKey = `accounting_cache_${reservationId}`;
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (!cachedData) return null;

    const parsed = JSON.parse(cachedData);

    // 現在のマスターデータと照合して、存在しない項目を除外
    return filterValidCacheData(parsed);
  } catch (e) {
    console.error('Failed to load accounting cache:', e);
    return null;
  }
}

/**
 * キャッシュデータの基本的な検証
 * @param {object} cachedData - キャッシュされたデータ
 * @returns {object} - 検証済みデータ
 */
function filterValidCacheData(cachedData) {
  if (!cachedData || typeof cachedData !== 'object') return {};
  return cachedData;
}

/**
 * localStorageから会計入力のキャッシュデータを削除する
 * @param {string} reservationId - 予約ID
 */
function clearAccountingCache(reservationId) {
  if (!reservationId) return;
  const cacheKey = `accounting_cache_${reservationId}`;
  try {
    localStorage.removeItem(cacheKey);
  } catch (e) {
    console.error('Failed to clear accounting cache:', e);
  }
}

// =================================================================
// --- Accounting Utilities ---
// -----------------------------------------------------------------

/**
 * 料金マスタから、指定された教室と項目名に合致する授業料ルールを取得します。
 * @param {Array} master - 料金マスタ (stateManager.getState().accountingMaster)
 * @param {string} classroom - 教室名
 * @param {string} itemName - 項目名
 * @returns {object|undefined} - 該当する授業料ルールオブジェクト
 */
const getTuitionItemRule = (master, classroom, itemName) => {
  if (!master || !classroom || !itemName) return undefined;
  return master.find(
    item =>
      item['種別'] === C.itemTypes.TUITION &&
      item[HEADERS.ACCOUNTING.ITEM_NAME] === itemName &&
      item[HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
      item[HEADERS.ACCOUNTING.TARGET_CLASSROOM].includes(classroom),
  );
};

// =================================================================
// --- Schedule Master Helper Functions ---
// -----------------------------------------------------------------
// 日程マスタデータから情報を取得するヘルパー関数群
// フェーズ1: tuitionItemRule依存からの脱却のための新機能
// =================================================================

/**
 * 日程マスタから教室形式を取得します
 * @param {object} scheduleData - 日程マスタのデータオブジェクト
 * @returns {string} 教室形式 ('時間制' | '回数制' | '材料制')
 */
function getClassroomTypeFromSchedule(scheduleData) {
  if (!scheduleData) return null;
  return scheduleData.classroomType || scheduleData['教室形式'] || null;
}

/**
 * 日程マスタから教室の開講時間情報を取得します
 * @param {object} scheduleData - 日程マスタのデータオブジェクト
 * @returns {object} 時間情報 {firstStart, firstEnd, secondStart?, secondEnd?}
 */
function getClassroomTimesFromSchedule(scheduleData) {
  if (!scheduleData) return null;

  return {
    firstStart: scheduleData.firstStart || scheduleData['1部開始'] || null,
    firstEnd: scheduleData.firstEnd || scheduleData['1部終了'] || null,
    secondStart: scheduleData.secondStart || scheduleData['2部開始'] || null,
    secondEnd: scheduleData.secondEnd || scheduleData['2部終了'] || null,
  };
}

/**
 * 教室形式が時間制かどうかを判定します
 * @param {object} scheduleData - 日程マスタのデータオブジェクト
 * @returns {boolean} 時間制の場合true
 */
function isTimeBasedClassroom(scheduleData) {
  const classroomType = getClassroomTypeFromSchedule(scheduleData);
  // 時間制の教室形式をすべてチェック（時間制・2部制、時間制・全日）
  return classroomType && classroomType.includes('時間制');
}

/**
 * 教室が2部制かどうかを判定します（2部開始・2部終了の両方が設定されている場合）
 * @param {object} scheduleData - 日程マスタのデータオブジェクト
 * @returns {boolean} 2部制の場合true
 */
function isTwoSessionClassroom(scheduleData) {
  const times = getClassroomTimesFromSchedule(scheduleData);
  if (!times) return false;
  return !!(times.secondStart && times.secondEnd);
}

/**
 * バックエンドから特定の日程マスタ情報を取得
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} classroom - 教室名
 * @returns {Promise<object|null>} 日程マスタ情報またはnull
 */
function getScheduleInfoFromCache(date, classroom) {
  return new Promise(resolve => {
    google.script.run
      .withSuccessHandler(response => {
        if (response.success && response.data) {
          console.log(
            '✅ getScheduleInfoFromCache: 日程マスタ情報取得成功',
            response.data.scheduleInfo,
          );
          resolve(response.data.scheduleInfo);
        } else {
          console.warn(
            '⚠️ getScheduleInfoFromCache: 日程マスタ情報が見つかりません',
            { date, classroom },
          );
          resolve(null);
        }
      })
      .withFailureHandler(error => {
        console.error('❌ getScheduleInfoFromCache: API呼び出しエラー', error);
        resolve(null);
      })
      .getScheduleInfo({ date, classroom });
  });
}

/**
 * 予約データから対応する日程マスタ情報を取得
 * @param {object} reservation - 予約データ (date, classroom を含む)
 * @returns {object|null} 日程マスタ情報またはnull (slots経由の場合)
 */
function getScheduleDataFromSlots(reservation) {
  if (!reservation || !reservation.date || !reservation.classroom) {
    console.warn('⚠️ getScheduleDataFromSlots: 予約データが不正', reservation);
    return null;
  }

  const state = stateManager.getState();
  const slots = state.slots;

  if (!slots || !Array.isArray(slots)) {
    console.warn('⚠️ getScheduleDataFromSlots: slotsが存在しません', slots);
    return null;
  }

  console.log('🔍 getScheduleDataFromSlots: 検索対象', {
    date: reservation.date,
    classroom: reservation.classroom,
    slotsLength: slots.length,
  });

  // 予約の日付と教室に対応するスロットを検索
  const matchingSlot = slots.find(
    slot =>
      slot.date === reservation.date &&
      slot.classroom === reservation.classroom,
  );

  if (!matchingSlot) {
    console.warn(
      '⚠️ getScheduleDataFromSlots: 一致するスロットが見つかりません',
      {
        date: reservation.date,
        classroom: reservation.classroom,
        availableSlots: slots.map(s => ({
          date: s.date,
          classroom: s.classroom,
        })),
      },
    );
    return null;
  }

  console.log('✅ getScheduleDataFromSlots: スロット発見', matchingSlot);

  // 日程マスタ形式の情報を返す
  return {
    classroomType: matchingSlot.classroomType || matchingSlot['教室形式'],
    firstStart: matchingSlot.firstStart || matchingSlot['1部開始'],
    firstEnd: matchingSlot.firstEnd || matchingSlot['1部終了'],
    secondStart: matchingSlot.secondStart || matchingSlot['2部開始'],
    secondEnd: matchingSlot.secondEnd || matchingSlot['2部終了'],
  };
}

// =================================================================
// --- Accounting Calculation Logic ---
// -----------------------------------------------------------------
// 会計画面での複雑な料金計算ロジックです。
// 授業料、材料費、割引などを動的に計算し、合計金額を算出します。
// =================================================================

/**
 * 会計計算を実行し、結果を返します。
 * @returns {object} 計算結果詳細
 */
function calculateAccountingDetails() {
  if (!stateManager.getState().accountingMaster) return null;

  const details = calculateAccountingDetailsFromForm();

  // 計算結果を直接使用（computed不要）

  // UI要素の更新
  updateAccountingUI(details);

  return details;
}

/**
 * フォームの内容から会計計算を実行します（appState独立）。
 * @returns {object} 計算結果詳細
 */
function calculateAccountingDetailsFromForm() {
  let tuitionSubtotal = 0;
  let salesSubtotal = 0;
  const details = {
    tuition: { items: [] },
    sales: { items: [] },
    grandTotal: 0,
    paymentMethod: '',
    items: [],
  };
  const form = document.getElementById('accounting-form');
  if (!form) return details;

  const r = stateManager.getState().accountingReservation;
  const tuitionItemRule = getTuitionItemRule(
    stateManager.getState().accountingMaster,
    r.classroom,
    C.items.MAIN_LECTURE,
  );
  const isTimeBased =
    tuitionItemRule && tuitionItemRule['単位'] === C.units.THIRTY_MIN;

  // 時間制授業料計算
  if (isTimeBased) {
    const timeBasedResult = calculateTimeBasedTuition(tuitionItemRule);
    if (timeBasedResult) {
      tuitionSubtotal += timeBasedResult.price;
      details.tuition.items.push(timeBasedResult.item);
    }
  }

  // チェックボックス項目計算
  const checkboxResult = calculateCheckboxItems();
  tuitionSubtotal += checkboxResult.tuitionSubtotal;
  salesSubtotal += checkboxResult.salesSubtotal;
  details.tuition.items.push(...checkboxResult.tuitionItems);
  details.sales.items.push(...checkboxResult.salesItems);
  details.items.push(...checkboxResult.allItems);

  // 割引計算
  const discountResult = calculateDiscount();
  if (discountResult) {
    tuitionSubtotal -= discountResult.amount;
    details.tuition.items.push(discountResult.item);
  }

  // 材料費計算
  const materialResult = calculateMaterials();
  salesSubtotal += materialResult.subtotal;
  details.sales.items.push(...materialResult.items);

  // その他販売品計算
  const otherSalesResult = calculateOtherSales();
  salesSubtotal += otherSalesResult.subtotal;
  details.sales.items.push(...otherSalesResult.items);

  // 合計計算
  details.tuition.subtotal = tuitionSubtotal;
  details.sales.subtotal = salesSubtotal;
  details.grandTotal = tuitionSubtotal + salesSubtotal;
  details.paymentMethod =
    form.querySelector('input[name="payment-method"]:checked')?.value || '現金';

  return details;
}

/**
 * 時間制授業料を計算する
 * 開始時間・終了時間・休憩時間から実際の受講時間を算出し、30分単位で料金を計算
 * @param {Object} tuitionItemRule - 会計マスタの授業料ルールオブジェクト（単価を含む）
 * @returns {Object|null} 計算結果 { price: number, item: {name: string, price: number} } または null
 */
function calculateTimeBasedTuition(tuitionItemRule) {
  // 時刻データを適切に取得（ヘルパー関数使用）
  const accountingReservation = stateManager.getState().accountingReservation;
  const startTime = getTimeValue(
    'start-time',
    accountingReservation,
    'startTime',
  );
  const endTime = getTimeValue('end-time', accountingReservation, 'endTime');
  const breakMinutes = parseInt(
    document.getElementById('break-time')?.value || 0,
    10,
  );

  if (startTime && endTime && startTime < endTime) {
    const start = new Date(`1900-01-01T${startTime}:00`);
    const end = new Date(`1900-01-01T${endTime}:00`);
    let diffMinutes = (end - start) / 60000 - breakMinutes;

    if (diffMinutes > 0) {
      const billableUnits = Math.ceil(diffMinutes / 30);
      const price =
        billableUnits * Number(tuitionItemRule[HEADERS.ACCOUNTING.UNIT_PRICE]);
      return {
        price: price,
        item: { name: `授業料 (${startTime} - ${endTime})`, price: price },
        billableUnits: billableUnits,
      };
    }
  }
  return null;
}

/**
 * 会計画面で時刻変更時に計算を更新する
 */
function updateAccountingCalculation() {
  // 会計合計を再計算
  const accountingResult = calculateAccountingDetailsFromForm();

  // 合計金額表示を更新
  const totalElement = document.getElementById('total-amount');
  if (totalElement && accountingResult) {
    totalElement.textContent = `¥${accountingResult.grandTotal.toLocaleString()}`;
  }

  // 詳細表示も更新（存在する場合）
  const detailsElement = document.getElementById('calculation-details');
  if (detailsElement && accountingResult) {
    // 詳細計算結果を表示
    detailsElement.innerHTML = `
      <div class="text-sm text-gray-600 space-y-1">
        <div>授業料小計: ¥${accountingResult.tuition.subtotal.toLocaleString()}</div>
        <div>物販小計: ¥${accountingResult.materials.subtotal.toLocaleString()}</div>
        <div class="font-semibold border-t pt-1">合計: ¥${accountingResult.grandTotal.toLocaleString()}</div>
      </div>`;
  }
}

/**
 * 会計画面の時刻選択にイベントリスナーを追加する
 */
function setupAccountingEventListeners() {
  // 時刻選択要素にchangeイベントを追加
  ['start-time', 'end-time', 'break-time'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', updateAccountingCalculation);
    }
  });

  // チェックボックス項目にもchangeイベントを追加
  document
    .querySelectorAll('input[type="checkbox"].accounting-item')
    .forEach(checkbox => {
      checkbox.addEventListener('change', updateAccountingCalculation);
    });

  // 割引チェックボックスにもchangeイベントを追加
  const discountCheckbox = document.getElementById('discount-checkbox');
  if (discountCheckbox) {
    discountCheckbox.addEventListener('change', updateAccountingCalculation);
  }
}

/**
 * フォーム内のチェックボックス項目の料金を計算する
 * 授業料項目と物販項目を区別して集計し、両方の小計を算出
 * @returns {Object} 計算結果 { tuitionSubtotal: number, salesSubtotal: number, tuitionItems: Array, salesItems: Array, allItems: Array }
 */
function calculateCheckboxItems() {
  let tuitionSubtotal = 0;
  let salesSubtotal = 0;
  const tuitionItems = [];
  const salesItems = [];
  const allItems = [];

  const form = document.getElementById('accounting-form');
  form
    .querySelectorAll('input[type="checkbox"].accounting-item')
    .forEach(cb => {
      if (cb.checked || cb.disabled) {
        const itemName = cb.dataset.itemName;
        const itemType = cb.dataset.itemType;
        const masterItem = stateManager
          .getState()
          .accountingMaster.find(
            m =>
              m[HEADERS.ACCOUNTING.ITEM_NAME] === itemName &&
              m['種別'] === itemType,
          );
        if (!masterItem) return;

        const price = Number(masterItem[HEADERS.ACCOUNTING.UNIT_PRICE]);
        const itemDetail = { name: itemName, price: price };
        allItems.push(itemDetail);

        if (itemType === C.itemTypes.TUITION) {
          tuitionSubtotal += price;
          tuitionItems.push(itemDetail);
        } else {
          salesSubtotal += price;
          salesItems.push(itemDetail);
        }
      }
    });

  return {
    tuitionSubtotal,
    salesSubtotal,
    tuitionItems,
    salesItems,
    allItems,
  };
}

/**
 * 初回者同時割引を計算する
 * 固定の¥500引きを適用
 * @returns {Object|null} 割引計算結果 { discountAmount: number, discountItem: {name: string, price: number} } または null
 */
function calculateDiscount() {
  const discountCheckbox = document.getElementById('discount-checkbox');
  if (discountCheckbox && discountCheckbox.checked) {
    const discountAmount = 500; // 固定の¥500引き
    return {
      amount: discountAmount,
      item: {
        name: `${C.items.DISCOUNT}`,
        price: -discountAmount,
      },
    };
  }
  return null;
}

/**
 * 材料費を計算する
 * 立体材料の場合はサイズ(長さ×幅×高さ)から体積を計算し、単価を掛けて算出
 * その他の材料は固定単価で計算
 * @returns {Object} 計算結果 { subtotal: number, items: Array<{name: string, price: number}> }
 */
function calculateMaterials() {
  let subtotal = 0;
  const items = [];

  const materialContainer = document.getElementById('materials-container');
  if (materialContainer) {
    const materialRows = materialContainer.querySelectorAll(
      'div[data-material-row-index]',
    );
    materialRows.forEach((row, index) => {
      const type = document.getElementById(`material-type-${index}`)?.value;
      const masterItem = stateManager
        .getState()
        .accountingMaster.find(m => m[HEADERS.ACCOUNTING.ITEM_NAME] === type);
      const priceEl = document.getElementById(`material-price-${index}`);

      if (!masterItem) {
        if (priceEl) priceEl.textContent = '0円';
        return;
      }

      const unitPrice = Number(masterItem[HEADERS.ACCOUNTING.UNIT_PRICE]);
      let finalName = type;
      let price = 0;

      if (masterItem['単位'] === stateManager.getState().constants.units.CM3) {
        const l = document.getElementById(`material-l-${index}`)?.value || 0;
        const w = document.getElementById(`material-w-${index}`)?.value || 0;
        const h = document.getElementById(`material-h-${index}`)?.value || 0;
        if (l > 0 && w > 0 && h > 0) {
          const volumeCm = (l / 10) * (w / 10) * (h / 10);
          let calculatedPrice = Math.round((volumeCm * unitPrice) / 100) * 100;
          price = Math.max(100, calculatedPrice);
          finalName = `${type} (${l}x${w}x${h}mm)`;
        }
      } else {
        if (type) price = unitPrice;
      }

      if (priceEl) priceEl.textContent = `${price.toLocaleString()}円`;
      if (price > 0) {
        const itemDetail = { name: finalName, price: price };
        subtotal += price;
        items.push(itemDetail);
      }
    });
  }

  return { subtotal, items };
}

/**
 * その他販売品を計算する
 * 動的に追加された販売品項目の名前と価格から小計を算出
 * @returns {Object} 計算結果 { subtotal: number, items: Array<{name: string, price: number}> }
 */
function calculateOtherSales() {
  let subtotal = 0;
  const items = [];

  const otherSalesContainer = document.getElementById('other-sales-container');
  if (otherSalesContainer) {
    const otherSalesRows = otherSalesContainer.querySelectorAll(
      'div[data-other-sales-row]',
    );
    otherSalesRows.forEach((row, index) => {
      const name = document
        .getElementById(`other-sales-name-${index}`)
        ?.value.trim();
      const priceInput = document.getElementById(`other-sales-price-${index}`);
      let priceValue = priceInput.value
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
        .replace(/[^0-9.-]/g, '');
      priceInput.value = priceValue;
      const price = Number(priceValue || 0);

      if (name && price !== 0) {
        const itemDetail = { name: name, price: price };
        subtotal += price;
        items.push(itemDetail);
      }
    });
  }

  return { subtotal, items };
}

/**
 * 会計フォームのUI要素を計算結果に基づいて更新する
 * 授業料・物販の小計、合計金額、内訳表示などを動的に更新
 * @param {Object} details - calculateAccountingDetailsFromForm()の計算結果
 */
function updateAccountingUI(details) {
  const tuitionBreakdownEl = document.getElementById('tuition-breakdown');
  const calculatedHoursEl = document.getElementById('calculated-hours');
  const tuitionSubtotalEl = document.getElementById('tuition-subtotal');
  const salesSubtotalEl = document.getElementById('sales-subtotal');
  const grandTotalEl = document.getElementById('grand-total-amount');

  // 時間制授業料の表示更新
  if (tuitionBreakdownEl) {
    const tuitionBreakdownHtml = details.tuition.items
      .map(
        item =>
          `<div class="flex justify-between${item.price < 0 ? ' text-red-600' : ''}"><span>${item.name}</span><span>${item.price.toLocaleString()}円</span></div>`,
      )
      .join('');
    tuitionBreakdownEl.innerHTML = tuitionBreakdownHtml;
  }

  // 受講時間表示の更新
  if (calculatedHoursEl && details) {
    const timeBasedItems = details.tuition.items.filter(item =>
      item.name.includes('授業料 ('),
    );
    if (timeBasedItems.length > 0) {
      const r = stateManager.getState().accountingReservation;
      const tuitionItemRule = getTuitionItemRule(
        stateManager.getState().accountingMaster,
        r.classroom,
        C.items.MAIN_LECTURE,
      );
      if (tuitionItemRule) {
        const billableUnits = Math.ceil(
          timeBasedItems[0].price /
            Number(tuitionItemRule[HEADERS.ACCOUNTING.UNIT_PRICE]),
        );
        calculatedHoursEl.textContent = `受講時間: ${billableUnits * 0.5}時間 × ${2.0 * tuitionItemRule[HEADERS.ACCOUNTING.UNIT_PRICE]}円`;
      }
    } else {
      calculatedHoursEl.textContent = '';
    }
  }

  // 小計・合計の表示更新
  if (tuitionSubtotalEl)
    tuitionSubtotalEl.textContent = `小計: ${details.tuition.subtotal.toLocaleString()}円`;
  if (salesSubtotalEl)
    salesSubtotalEl.textContent = `小計: ${details.sales.subtotal.toLocaleString()}円`;
  if (grandTotalEl)
    grandTotalEl.textContent = `合計: ${details.grandTotal.toLocaleString()}円`;
}

// =================================================================
// --- Event Listener Management ---
// -----------------------------------------------------------------
// イベントリスナーの登録・解除を追跡管理するヘルパー関数群
// メモリリーク防止のため、ビュー切り替え時に古いリスナーを確実に解除する
// =================================================================

let activeListeners = [];

/**
 * 登録されたイベントリスナーを全て解除する
 */
function teardownAllListeners() {
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
 * @param {Function} listener - リスナー関数
 * @param {object} [options] - addEventListenerのオプション
 */
function addTrackedListener(element, type, listener, options) {
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
function setupViewListener() {
  if (!window.stateManager) {
    console.error('StateManager not initialized. Cannot set up view listener.');
    return;
  }

  window.stateManager.subscribe((newState, oldState) => {
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
          if (typeof calculateAccountingDetails === 'function') {
            calculateAccountingDetails();
          }
        }
        // 他のビューでリスナーが必要な場合はここに追加
        // else if (newState.view === 'someOtherView') {
        //   setupSomeOtherViewListeners();
        // }
      });
    }
  });
}
