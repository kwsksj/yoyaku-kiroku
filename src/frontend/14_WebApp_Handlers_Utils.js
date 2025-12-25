/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 14_WebApp_Handlers_Utils.js
 * 目的: ハンドラー層から共通利用されるDOM操作・データ変換ユーティリティを提供する
 * 主な責務:
 *   - 型安全なDOMアクセサーと入力値取得ヘルパーの提供
 *   - 予約データや時間データの整形
 *   - サーバー呼び出し失敗時の共通フォールバック処理
 * AI向けメモ:
 *   - ハンドラー間で共有したい処理はここにまとめ、グローバル副作用の追加時は`handlerUtilsStateManager`の利用可否を確認する
 * =================================================================
 */

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { handleServerError } from './12_WebApp_Core_ErrorHandler.js';

const handlerUtilsStateManager = appWindow.stateManager;

// =================================================================
// --- DOM Type Safety Helper Functions ---
// -----------------------------------------------------------------
// DOM要素アクセスの型安全性を確保するヘルパー関数群
// =================================================================

/**
 * 型安全なHTMLElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLElement | null}
 */
export function getElementSafely(id) {
  return document.getElementById(id);
}

/**
 * 型安全なHTMLInputElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLInputElement | null}
 */
export function getInputElementSafely(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement ? element : null;
}

/**
 * 型安全なHTMLSelectElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLSelectElement | null}
 */
export function getSelectElementSafely(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLSelectElement ? element : null;
}

/**
 * 型安全なHTMLFormElement取得ヘルパー
 * @param {string} id - 要素のID
 * @returns {HTMLFormElement | null}
 */
export function getFormElementSafely(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLFormElement ? element : null;
}

// =================================================================
// --- Data Conversion Helper Functions ---
// -----------------------------------------------------------------
// データ型変換とバリデーションを行うヘルパー関数群
// =================================================================

/**
 * 日付データの型安全性を確保するヘルパー関数
 * @param {string | Date} date - 日付データ
 * @returns {string} 文字列形式の日付
 */
export function ensureDateString(date) {
  if (typeof date === 'string') {
    return date;
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD形式
  }
  return '';
}

/**
 * ReservationObjectをReservationCoreに安全に変換する
 * @param {ReservationObject} reservationObj - 予約オブジェクト
 * @returns {ReservationCore} 変換された予約データ
 */
export function convertToReservationData(reservationObj) {
  return {
    ...reservationObj,
    date: ensureDateString(reservationObj.date),
    startTime:
      typeof reservationObj.startTime === 'string'
        ? reservationObj.startTime
        : '',
    endTime:
      typeof reservationObj.endTime === 'string' ? reservationObj.endTime : '',
  };
}

// =================================================================
// --- Time Data Helper Functions ---
// -----------------------------------------------------------------
// 時刻データの取得・処理を行うヘルパー関数群
// =================================================================

/**
 * 時刻データを適切に取得するヘルパー関数
 * @param {string} elementId - 時刻入力要素のID
 * @param {ReservationCore | null} reservationData - 予約データ（フォールバック用）
 * @param {string} timeField - 時刻フィールド名（'startTime' or 'endTime'）
 * @returns {string} 時刻文字列（HH:mm形式）
 */
export function getTimeValue(elementId, reservationData, timeField) {
  // 1. HTML要素から取得を試行
  const inputElement = getInputElementSafely(elementId);
  const selectElement = getSelectElementSafely(elementId);
  const element = inputElement || selectElement;

  const elementValue = element?.value;
  if (elementValue && elementValue !== '') {
    return elementValue;
  }

  // 2. 予約データから取得を試行（編集時）
  if (reservationData) {
    const headerField =
      /** @type {any} */ (CONSTANTS.HEADERS.RESERVATIONS)?.[
        timeField.toUpperCase()
      ] || timeField;
    const timeValue =
      /** @type {any} */ (reservationData)[headerField] ||
      /** @type {any} */ (reservationData)[timeField];
    if (timeValue && timeValue !== '') {
      return /** @type {string} */ (timeValue);
    }
  }

  // 3. selectedLessonから取得を試行（新規作成時）
  const selectedLesson = handlerUtilsStateManager.getState().selectedLesson;
  if (selectedLesson) {
    const headerField =
      /** @type {any} */ (CONSTANTS.HEADERS.RESERVATIONS)?.[
        timeField.toUpperCase()
      ] || timeField;

    // セッション制教室の場合、スケジュール情報から取得
    const classroomType = /** @type {any} */ (selectedLesson).classroomType;
    if (classroomType === CONSTANTS.CLASSROOM_TYPES.SESSION_BASED) {
      if (timeField === 'startTime') {
        return selectedLesson.firstStart || selectedLesson.secondStart || '';
      } else if (timeField === 'endTime') {
        return selectedLesson.firstEnd || selectedLesson.secondEnd || '';
      }
    }

    // 時間制教室の場合、selectedLessonから取得
    const lessonValue =
      /** @type {any} */ (selectedLesson)[headerField] ||
      /** @type {any} */ (selectedLesson)[timeField];
    if (lessonValue && lessonValue !== '') {
      return lessonValue;
    }
  }

  return '';
}

// =================================================================
// --- Accounting Cache Helper Functions ---
// -----------------------------------------------------------------
// 会計フォームのデータを操作するためのヘルパー関数群
// =================================================================

// =================================================================
// --- Phone Number Formatting Helper Functions ---
// -----------------------------------------------------------------
// 電話番号入力のリアルタイム整形処理
// =================================================================

/**
 * 電話番号入力フィールドのリアルタイム整形処理
 * @param {HTMLInputElement} inputElement - 電話番号入力フィールド
 */
export function handlePhoneInputFormatting(inputElement) {
  if (!inputElement) return;

  const originalValue = inputElement.value;
  const cursorPosition = inputElement.selectionStart;

  // 全角数字を半角に変換
  const formattedValue = originalValue.replace(/[０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 65248),
  );

  // 数字以外を削除（ハイフンは一時的に残す）
  const digitsOnly = formattedValue.replace(/[^\d]/g, '');

  // フォーマット適用
  let formatted = '';
  if (digitsOnly.length > 0) {
    if (digitsOnly.length <= 3) {
      formatted = digitsOnly;
    } else if (digitsOnly.length <= 7) {
      formatted = `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3)}`;
    } else if (digitsOnly.length <= 11) {
      // 11桁の場合: 090-1234-5678
      formatted = `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 7)} ${digitsOnly.slice(7)}`;
    } else {
      // 11桁を超える場合は11桁までに制限
      const truncated = digitsOnly.slice(0, 11);
      formatted = `${truncated.slice(0, 3)} ${truncated.slice(3, 7)} ${truncated.slice(7)}`;
    }
  }

  // 値が変更された場合のみ更新
  if (formatted !== originalValue) {
    inputElement.value = formatted;

    // カーソル位置を調整（ハイフンの追加を考慮）
    const cursorBase =
      cursorPosition === null ? formatted.length : cursorPosition;
    const newCursorPosition = Math.min(
      cursorBase + (formatted.length - originalValue.length),
      formatted.length,
    );
    inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
  }
}

/**
 * 電話番号を表示用にフォーマットする（090 1234 5678 形式）
 * @param {string} phoneNumber - フォーマットする電話番号
 * @returns {string} フォーマットされた電話番号
 */
export function formatPhoneNumberForDisplay(phoneNumber) {
  if (!phoneNumber) return '';

  // アポストロフィや記号を除去して数字のみにする
  const digitsOnly = phoneNumber.replace(/[^\d]/g, '');

  if (digitsOnly.length === 11) {
    // 11桁の場合: 090 1234 5678
    return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 7)} ${digitsOnly.slice(7)}`;
  } else if (digitsOnly.length === 10) {
    // 10桁の場合: 03 1234 5678
    return `${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 6)} ${digitsOnly.slice(6)}`;
  }

  // その他の場合はそのまま返す
  return phoneNumber;
}

// =================================================================
// --- Admin Context Helper Functions ---
// -----------------------------------------------------------------
// 管理者コンテキスト関連のヘルパー関数群
// =================================================================

/**
 * 現在のユーザーが管理者かどうかを判定（なりすまし中も判定可能）
 * @returns {boolean}
 */
export function isCurrentUserAdmin() {
  const state = handlerUtilsStateManager.getState();
  // なりすまし中は元の管理者ユーザーを確認
  const actualUser = state.adminImpersonationOriginalUser || state.currentUser;
  return actualUser?.isAdmin || false;
}

/**
 * 管理者操作後のなりすまし終了と画面遷移を一括処理するヘルパー
 * @param {object} options
 * @param {any} [options.participantCacheUpdate] - updateParticipantViewCacheFromReservation の戻り値
 * @param {any} [options.response] - サーバーレスポンス（lessonsデータを含む）
 * @param {string} [options.message] - 表示するメッセージ
 * @param {string} [options.messageTitle] - メッセージタイトル
 * @returns {boolean} processed - 管理者操作として処理された場合はtrue
 */
export function handleAdminImpersonationAfterAction({
  participantCacheUpdate = null,
  response = null,
  message = '',
  messageTitle = '',
} = {}) {
  const state = handlerUtilsStateManager.getState();
  const isAdminImpersonating = !!state.adminImpersonationOriginalUser;

  if (isAdminImpersonating) {
    const fallbackPayload = getParticipantPayloadForAdminView(
      response?.data ? response.data.lessons : null,
    );

    // End impersonation
    handlerUtilsStateManager.endImpersonation();

    // Navigate to participants view
    handlerUtilsStateManager.dispatch({
      type: 'SET_STATE',
      payload: {
        view: 'participants',
        navigationHistory: [],
        ...(participantCacheUpdate || fallbackPayload),
      },
    });

    refreshParticipantsViewForAdmin();

    if (message) {
      if (messageTitle) {
        // showInfo is global
        // @ts-ignore
        if (typeof showInfo === 'function') {
          // @ts-ignore
          showInfo(`<h3 class="font-bold mb-3">${messageTitle}</h3>${message}`);
        }
      } else {
        // @ts-ignore
        if (typeof showInfo === 'function') {
          // @ts-ignore
          showInfo(message);
        }
      }
    }
    return true;
  }
  return false;
}

// =================================================================
// --- Application State Management Helper Functions ---
// -----------------------------------------------------------------
// アプリケーション状態管理関連のヘルパー関数群
// =================================================================

/**
 * バッチ処理でキャッシュから最新データを取得してappStateを更新
 * ユーザーの予約・履歴・スロット情報を一括取得し、指定されたビューに遷移
 * @param {string} targetView - データ取得後に遷移したいビュー名
 */
export function updateAppStateFromCache(targetView) {
  const currentUser = handlerUtilsStateManager.getState().currentUser;
  if (!currentUser || !currentUser.phone) {
    if (targetView) {
      appWindow.stateManager.dispatch({
        type: 'SET_STATE',
        payload: { view: /** @type {ViewType} */ (targetView) },
      });
    }
    return;
  }

  // 更新中フラグを設定
  appWindow.stateManager.dispatch({
    type: 'SET_STATE',
    payload: { _dataUpdateInProgress: true },
  });

  showLoading('dataFetch');
  google.script.run['withSuccessHandler'](
    /** @param {any} response */ response => {
      hideLoading();
      appWindow.stateManager.dispatch({
        type: 'SET_STATE',
        payload: { _dataUpdateInProgress: false },
      }); // フラグをクリア

      if (response.success && response.userFound) {
        // バッチ処理結果からappStateを更新（initialDataなしでlessons、myReservationsのみ）
        const existingState = handlerUtilsStateManager.getState();
        const newAppState = {
          ...existingState,
          lessons: response.data.lessons || [],
          myReservations: response.data.myReservations || [],
        };
        // 現在のビューと重要な状態は保持、ただしtargetViewが指定されていればそちらを優先
        const preservedState = {
          view: /** @type {ViewType} */ (
            targetView || handlerUtilsStateManager.getState().view
          ),
          selectedClassroom:
            handlerUtilsStateManager.getState().selectedClassroom,
          selectedLesson: handlerUtilsStateManager.getState().selectedLesson,
          editingReservationDetails:
            handlerUtilsStateManager.getState().editingReservationDetails,
          accountingReservation:
            handlerUtilsStateManager.getState().accountingReservation,
          isDataFresh: true, // 新鮮なデータが読み込まれたことを記録
        };
        appWindow.stateManager.dispatch({
          type: 'SET_STATE',
          payload: { ...newAppState, ...preservedState },
        }); // setStateに統合し、状態更新と再描画を一元化
      } else {
        // 失敗時もsetStateを介して状態を更新し、再描画をトリガーする
        appWindow.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            _dataUpdateInProgress: false,
            view: /** @type {ViewType} */ (
              targetView || handlerUtilsStateManager.getState().view
            ),
          },
        });
        showInfo(response.message || 'データの取得に失敗しました。', 'エラー');
      }
    },
  )
    ['withFailureHandler'](
      /** @param {any} err */ err => {
        hideLoading();
        appWindow.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            _dataUpdateInProgress: false,
            view: /** @type {ViewType} */ (
              targetView || handlerUtilsStateManager.getState().view
            ),
          },
        }); // フラグをクリア
        handleServerError(err);
        // setStateがrenderを呼び出すので、ここでのrender()は不要
      },
    )
    .getBatchData(['lessons'], currentUser.phone);
}

// =================================================================
// --- Date Helper Functions ---
// -----------------------------------------------------------------
// 日付関連のヘルパー関数群
// =================================================================

/**
 * 今日かどうかを判定するヘルパー関数
 * @param {string} dateString - 日付文字列（YYYY-MM-DD形式）
 * @returns {boolean}
 */
export function isDateToday(dateString) {
  const today = new Date();
  const targetDate = new Date(dateString);

  return (
    today.getFullYear() === targetDate.getFullYear() &&
    today.getMonth() === targetDate.getMonth() &&
    today.getDate() === targetDate.getDate()
  );
}

// =================================================================
// --- Phone Number Validation ---
// -----------------------------------------------------------------
// 電話番号の正規化とバリデーション処理
// =================================================================

/**
 * 電話番号を正規化します（全角→半角、ハイフン削除、バリデーション）
 * サーバーサイドのnormalizePhoneNumber関数と同等の処理をフロントエンドで実行
 * @param {string} phoneInput - 入力された電話番号
 * @returns {PhoneNumberNormalizationResult} 正規化結果
 */
appWindow.normalizePhoneNumberFrontend = function (phoneInput) {
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

  // 各種区切り文字と+記号を削除（ハイフン、スペース、括弧、ピリオド、+など）
  normalized = normalized.replace(/[-‐－—–\s\(\)\[\]\.\+]/g, '');

  // 国番号の自動修正処理（桁数チェック前に実行）
  // 行頭の81を0に置き換え（日本の国番号81 → 0）
  if (normalized.startsWith('81') && normalized.length >= 12) {
    normalized = '0' + normalized.substring(2);
  }

  // 数字以外の文字をチェック（空白文字は既に削除済み）
  if (!/^\d+$/.test(normalized)) {
    return {
      normalized: '',
      isValid: false,
      error: '電話番号は数字のみ入力してください',
    };
  }

  // 桁数チェック（携帯電話番号は11桁のみ）
  if (normalized.length !== 11) {
    return {
      normalized: '',
      isValid: false,
      error: '携帯電話番号は11桁で入力してください',
    };
  }

  // 先頭番号チェック（携帯電話番号は0から始まる）
  if (!normalized.startsWith('0')) {
    return {
      normalized: '',
      isValid: false,
      error: '携帯電話番号は0から始まる必要があります',
    };
  }

  return { normalized, isValid: true };
};

// =================================================================
// --- General UI Utilities ---
// -----------------------------------------------------------------
// 汎用的なUI関連ユーティリティ関数群
// =================================================================

/**
 * 販売品マスタから物販チェックリスト（折り畳み可能）を生成する関数
 * @param {AccountingMasterItemCore[]} accountingMaster - 販売品マスタ
 * @param {string[]} checkedValues - チェック済み項目名配列（任意）
 * @param {string} [title='販売品リスト'] - 見出しタイトル
 * @returns {string} HTML文字列
 */
export function buildSalesChecklist(
  accountingMaster,
  checkedValues = [],
  title = '販売品リスト',
) {
  const salesList = (accountingMaster || []).filter(
    item =>
      item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] === CONSTANTS.ITEM_TYPES.SALES,
  );
  if (!salesList.length) return '';
  const checklistHtml = getSalesCheckboxListHtml(salesList, checkedValues);
  return `
    <details class="mt-4">
      <summary class="cursor-pointer font-bold text-base py-2 px-3 bg-ui-surface border-2 border-ui-border rounded hover:bg-ui-hover">${title} <span class="ml-2 text-sm text-brand-subtle">（クリックで展開）</span></summary>
      <div class="pt-2">${checklistHtml}</div>
    </details>
  `;
}

/**
 * 物販リストをチェックボックスで表示するHTMLを返す（再利用可能）
 * @param {AccountingMasterItemCore[]} salesList - 物販アイテム配列
 * @param {string[]} checkedValues - チェック済み項目名配列（任意）
 * @returns {string} HTML文字列
 */
export function getSalesCheckboxListHtml(salesList, checkedValues = []) {
  if (!salesList || salesList.length === 0) return '';
  return `
    <div class="mt-4 pt-4 border-t">
      <label class="font-bold mb-2 block">購入希望（チェック可）</label>
      <div class="grid grid-cols-1 gap-2">
        ${salesList
          .map(
            item => `
          <label class="flex items-center space-x-2">
            <input type="checkbox" name="orderSales" value="${item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]}" class="accent-action-primary-bg" ${checkedValues.includes(item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]) ? 'checked' : ''}>
            <span>${item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]}${item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE] ? `（¥${item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]}）` : ''}</span>
          </label>
        `,
          )
          .join('')}
      </div>
    </div>`;
}

// =================================================================
// --- Date & Time Utilities ---
// -----------------------------------------------------------------
// 日付・時刻関連のユーティリティ関数群
// =================================================================

/**
 * 日付文字列を「M/D 曜日」形式にフォーマット
 * @param {DateString} dStr - 日付文字列
 * @returns {string} フォーマット済み日付
 */
window.formatDate =
  window.formatDate ||
  /** @type {(dStr: DateString) => string} */ (
    dStr => {
      if (!dStr) return '';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return '';
      d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
      const day = d.getDay();
      const wd = ['日', '月', '火', '水', '木', '金', '土'];
      return `<span class="font-bold">${d.getMonth() + 1}/${d.getDate()}</span><span class="ml-1 font-bold ${day === 0 ? 'text-ui-weekend-sunday' : day === 6 ? 'text-ui-weekend-saturday' : ''}">${wd[day] || ''}</span>`;
    }
  );

/**
 * 参加者画面の横スクロール同期をセットアップ
 * ヘッダー行と各アコーディオンのテーブルボディ間でスクロールを同期
 */
window.setupParticipantsScrollSync =
  window.setupParticipantsScrollSync ||
  function () {
    const header = document.getElementById('participants-table-header');
    const bodies = document.querySelectorAll('.participants-table-body');

    if (!header || bodies.length === 0) return;

    let isScrolling = false;

    // ヘッダーのスクロールを全てのボディに同期
    header.addEventListener('scroll', function () {
      if (isScrolling) return;
      isScrolling = true;
      const scrollLeft = header.scrollLeft;
      bodies.forEach(body => {
        body.scrollLeft = scrollLeft;
      });
      setTimeout(() => {
        isScrolling = false;
      }, 10);
    });

    // 各ボディのスクロールをヘッダーと他のボディに同期
    bodies.forEach(body => {
      body.addEventListener('scroll', function () {
        if (isScrolling) return;
        isScrolling = true;
        const scrollLeft = body.scrollLeft;
        header.scrollLeft = scrollLeft;
        bodies.forEach(otherBody => {
          if (otherBody !== body) {
            otherBody.scrollLeft = scrollLeft;
          }
        });
        setTimeout(() => {
          isScrolling = false;
        }, 10);
      });
    });
  };

// =================================================================
// --- Participant View Management ---
// -----------------------------------------------------------------
// 参加者画面のキャッシュ管理および表示更新ヘルパー
// =================================================================

/**
 * 管理者操作後に参加者リストキャッシュを部分更新する
 * @param {ReservationCore & {lessonId?: string}} reservation
 * @param {'remove'|'upsert'} [mode='upsert']
 * @param {Record<string, any[]>} [baseMap]
 * @param {LessonCore[] | null} [baseLessons]
 * @returns {Partial<UIState> | null}
 */
export function updateParticipantViewCacheFromReservation(
  reservation,
  mode = 'upsert',
  baseMap = undefined,
  baseLessons = undefined,
) {
  if (!reservation || !reservation.reservationId) return null;
  const lessonIdSafe = reservation.lessonId ? String(reservation.lessonId) : '';
  if (!lessonIdSafe) return null;

  const state = handlerUtilsStateManager.getState();
  const participantLessons =
    baseLessons ||
    (state.participantLessons && state.participantLessons.length > 0
      ? state.participantLessons
      : state.lessons) ||
    null;

  const currentMap = baseMap || state.participantReservationsMap || {};
  const existingList = currentMap[lessonIdSafe]
    ? [...currentMap[lessonIdSafe]]
    : [];
  const targetIndex = existingList.findIndex(
    (/** @type {any} */ r) => r.reservationId === reservation.reservationId,
  );

  if (mode === 'remove') {
    if (targetIndex !== -1) {
      existingList.splice(targetIndex, 1);
    }
  } else {
    const base = targetIndex !== -1 ? existingList[targetIndex] : {};
    const merged = { ...base, ...reservation, lessonId: lessonIdSafe };
    [
      'realName',
      'nickname',
      'displayName',
      'phone',
      'email',
      'ageGroup',
      'gender',
      'address',
      'messageToTeacher',
      'notes',
    ].forEach(key => {
      if (merged[key] === undefined && base && base[key]) {
        merged[key] = base[key];
      }
    });

    if (targetIndex !== -1) {
      existingList[targetIndex] = merged;
    } else {
      existingList.push(merged);
    }
  }

  const updatedMap = { ...currentMap };
  if (existingList.length > 0) {
    updatedMap[lessonIdSafe] = existingList;
  } else {
    delete updatedMap[lessonIdSafe];
  }

  const adminContext = /** @type {any} */ (appWindow).adminContext;
  if (
    adminContext &&
    adminContext.lesson &&
    adminContext.lesson.lessonId === lessonIdSafe
  ) {
    adminContext.reservations = existingList;
  }

  return {
    participantLessons: participantLessons,
    participantReservationsMap: updatedMap,
  };
}

/**
 * 管理者戻り用の参加者リストペイロードを作成（既存データを優先）
 * @param {LessonCore[] | null | undefined} responseLessons
 * @returns {Partial<UIState>}
 */
export function getParticipantPayloadForAdminView(responseLessons) {
  const state = handlerUtilsStateManager.getState();
  return {
    participantLessons:
      responseLessons || state.participantLessons || state.lessons || null,
    participantReservationsMap: state.participantReservationsMap || {},
  };
}

/**
 * 管理者操作後に参加者ビューを最新化するヘルパー
 */
export function refreshParticipantsViewForAdmin() {
  const handler =
    /** @type {any} */ (appWindow).participantActionHandlers ||
    /** @type {any} */ (window).participantActionHandlers;
  if (handler && typeof handler.loadParticipantView === 'function') {
    const state = handlerUtilsStateManager.getState();
    handler.loadParticipantView(
      true,
      true,
      null,
      state.showPastLessons || false,
    );
  }
}

// グローバルスコープにも公開（後方互換性のため）
/** @type {any} */ (appWindow).updateParticipantViewCacheFromReservation =
  /** @type {any} */ (appWindow).updateParticipantViewCacheFromReservation ||
  updateParticipantViewCacheFromReservation;
