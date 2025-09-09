// @ts-check
/// <reference path="../types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Components.js
 * 【バージョン】: 2.0 (シンプル化設計版)
 * 【役割】: WebAppのUIコンポーネント生成関数を集約します。
 * - 再利用可能なUIコンポーネントの定義
 * - シンプル化されたパラメータ設計
 * - 3層構造: Atomic → Molecular → Organisms
 * 【構成】: 14ファイル構成のうちの13番目（新規追加）
 * 【設計原則】:
 * - 単一責任原則: 1コンポーネント = 1つの明確な責任
 * - 最小パラメータ: 本質的なデータのみ受け取る
 * - 関心の分離: UIコンポーネントとビジネスデータを分離
 * - 組み合わせ可能: 小さな部品の組み合わせで複雑な画面を構築
 */

// =================================================================
// --- HTML Escape Utility ---
// -----------------------------------------------------------------
// HTMLエスケープ機能（12_WebApp_Core.htmlから移動）
// =================================================================

/**
 * HTML文字列をエスケープします。
 * @param {string} str エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
window.escapeHTML = str => {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/[&<>"']/g, function (match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[match];
  });
};

// =================================================================
// --- Level 1: 基本要素（Atomic Components） ---
// -----------------------------------------------------------------
// 最小単位のUIコンポーネント。単一責任でパラメータ最小化。
// =================================================================

const Components = {
  /**
   * 進化版ボタンコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.action - data-action属性の値
   * @param {string} config.text - ボタンテキスト
   * @param {string} [config.style='primary'] - ボタンスタイル ('primary'|'secondary'|'danger')
   * @param {string} [config.size='normal'] - ボタンサイズ ('normal'|'full'|'small'|'xs')
   * @param {boolean} [config.disabled=false] - 無効状態
   * @param {string} [config.customClass=''] - 追加のCSSクラス
   * @param {Object} [config.dataAttributes={}] - 追加のdata-*属性 (例: { classroomName: '東京' })
   * @returns {string} HTML文字列
   */
  button: ({
    action,
    text,
    style = 'primary',
    size = 'normal',
    disabled = false,
    customClass = '',
    dataAttributes = {},
  }) => {
    // スタイルマッピング
    const styleClasses = {
      primary: DesignConfig.colors.primary,
      secondary: DesignConfig.colors.secondary,
      danger: DesignConfig.colors.danger,
    };

    const sizeClasses = {
      normal: '',
      full: DesignConfig.buttons.full,
      small: 'text-sm px-3 py-1.5',
      xs: 'text-xs px-2 py-1',
    };

    // データ属性をHTML文字列に変換
    const dataAttrs = Object.entries(dataAttributes)
      .map(
        ([key, value]) =>
          `data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}="${escapeHTML(value)}"`,
      )
      .join(' ');

    // スタイルが'none'の場合は基本クラスを最小限にする
    const baseClass = style === 'none' ? '' : DesignConfig.buttons.base;
    const styleClass = style === 'none' ? '' : styleClasses[style] || '';

    return `<button type="button"
        data-action="${escapeHTML(action || '')}"
        class="${[baseClass, styleClass, sizeClasses[size] || '', customClass || ''].filter(Boolean).join(' ')}"
        ${dataAttrs}
        ${disabled ? 'disabled' : ''}
      >${escapeHTML(text)}</button>`;
  },

  /**
   * シンプル化された入力フィールドコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.id - input要素のid
   * @param {string} config.label - ラベルテキスト
   * @param {string} [config.type='text'] - input要素のtype
   * @param {string} [config.value=''] - 初期値
   * @param {string} [config.placeholder=''] - プレースホルダー
   * @param {boolean} [config.required=false] - 必須項目かどうか
   * @returns {string} HTML文字列
   */
  input: ({
    id,
    label,
    type = 'text',
    value = '',
    placeholder = '',
    required = false,
  }) => {
    return `<div class="mb-4">
        <label
          for="${id}"
          class="${DesignConfig.text.labelBlock}"
        >${escapeHTML(label)}</label>
        <input
          type="${type}"
          id="${id}"
          value="${escapeHTML(value)}"
          class="${DesignConfig.inputs.base}"
          placeholder="${escapeHTML(placeholder)}"
          ${required ? 'required' : ''}
          autocomplete="off"
        >
      </div>`;
  },

  /**
   * シンプル化されたセレクトボックスコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.id - select要素のid
   * @param {string} config.label - ラベルテキスト
   * @param {string} config.options - option要素のHTML文字列
   * @returns {string} HTML文字列
   */
  select: ({ id, label, options }) => {
    return `<div class="mb-4">
        <label for="${id}" class="${DesignConfig.text.labelBlock}">${escapeHTML(label)}</label>
        <select
          id="${id}"
          class="${DesignConfig.inputs.base}"
        >${options}</select>
      </div>`;
  },

  /**
   * テキストエリアコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.id - textarea要素のid
   * @param {string} config.label - ラベルテキスト
   * @param {string} [config.value=''] - 初期値
   * @param {string} [config.placeholder=''] - プレースホルダー
   * @returns {string} HTML文字列
   */
  textarea: ({ id, label, value = '', placeholder = '' }) => {
    return `<div class="mb-4">
        <label for="${id}" class="${DesignConfig.text.labelBlock}">${escapeHTML(label)}</label>
        <textarea
          id="${id}"
          class="${DesignConfig.inputs.textarea}"
          placeholder="${escapeHTML(placeholder)}"
        >${escapeHTML(value)}</textarea>
      </div>`;
  },

  /**
   * チェックボックスコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.id - input要素のid
   * @param {string} config.label - ラベルテキスト
   * @param {boolean} [config.checked=false] - チェック状態
   * @returns {string} HTML文字列
   */
  checkbox: ({ id, label, checked = false }) => {
    return `<label class="flex items-center space-x-2 ${DesignConfig.colors.text}">
        <input
          type="checkbox"
          id="${id}"
          ${checked ? 'checked' : ''}
          class="accent-action-primary-bg"
        >
        <span>${escapeHTML(label)}</span>
      </label>`;
  },

  // =================================================================
  // --- 新設計コンポーネント ---
  // -----------------------------------------------------------------

  /**
   * 情報表示カード
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.title - カードタイトル
   * @param {Array<string>} config.items - 表示項目の配列
   * @returns {string} HTML文字列
   */
  infoCard: ({ title, items }) => {
    const itemsHtml = items
      .map(item => `<p class="text-brand-text">${escapeHTML(item)}</p>`)
      .join('');
    return `<div class="bg-ui-surface border border-ui-border p-3 rounded-lg">
        <h3 class="font-bold text-brand-text mb-2">${escapeHTML(title)}</h3>
        ${itemsHtml}
      </div>`;
  },

  /**
   * ステータスバッジ
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.type - バッジタイプ ('success'|'warning'|'error'|'info')
   * @param {string} config.text - バッジテキスト
   * @returns {string} HTML文字列
   */
  statusBadge: ({ type, text }) => {
    const typeClasses = {
      success: 'bg-state-success-bg text-state-success-text',
      warning: 'bg-ui-warning-bg text-ui-warning-text',
      error: 'bg-ui-error-bg text-ui-error-text',
      info: 'bg-action-secondary-bg text-action-secondary-text',
    };

    return `<span class="inline-block px-1 py-0.5 text-sm font-bold rounded ${typeClasses[type] || typeClasses.info}">${escapeHTML(text)}</span>`;
  },

  /**
   * 料金表示コンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {number|string} config.amount - 金額
   * @param {string} [config.label=''] - ラベル
   * @returns {string} HTML文字列
   */
  priceDisplay: ({ amount, label = '' }) => {
    const formattedAmount =
      typeof amount === 'number' ? amount.toLocaleString() : amount;
    return `<div class="text-right">
        ${label ? `<span class="text-brand-subtle text-sm">${escapeHTML(label)}: </span>` : ''}
        <span class="font-bold text-brand-text">${formattedAmount}円</span>
      </div>`;
  },

  // =================================================================
  // --- 会計系専用コンポーネント ---
  // -----------------------------------------------------------------

  /**
   * ナビゲーションヘッダー
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.title - ページタイトル
   * @param {string} config.backAction - 戻るボタンのaction
   * @returns {string} HTML文字列
   */
  navigationHeader: ({ title, backAction }) => {
    return `<div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-brand-text">${escapeHTML(title)}</h1>
        <button data-action="${backAction}" class="text-sm bg-action-secondary-bg text-action-secondary-text px-3 py-1.5 rounded-md active:bg-action-secondary-hover mobile-button">戻る</button>
      </div>`;
  },

  /**
   * 会計項目行（チェックボックス付き）
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.name - 項目名
   * @param {string} config.itemType - アイテムタイプ
   * @param {number} config.price - 単価
   * @param {boolean} [config.checked=false] - チェック状態
   * @param {boolean} [config.disabled=false] - 無効化状態
   * @returns {string} HTML文字列
   */
  accountingRow: ({
    name,
    itemType,
    price,
    checked = false,
    disabled = false,
  }) => {
    return `<div class="flex items-center justify-between mb-2">
        <label class="flex items-center space-x-2 text-brand-text">
          <input type="checkbox"
                 name="${name}"
                 data-item-type="${itemType}"
                 data-item-name="${name}"
                 class="accounting-item h-5 w-5 rounded border-ui-border text-brand-text focus:ring-brand-text accent-action-primary-bg"
                 ${checked ? 'checked' : ''}
                 ${disabled ? 'disabled' : ''}>
          <span>${escapeHTML(name)}</span>
        </label>
        <span class="text-brand-subtle">${price.toLocaleString()}円</span>
      </div>`;
  },

  /**
   * 材料入力行
   * @param {Object} config - 設定オブジェクト
   * @param {number} config.index - 行のインデックス
   * @param {Object} [config.values] - 初期値
   * @returns {string} HTML文字列
   */
  materialRow: ({ index, values = {} }) => {
    const { type = '', l = '', w = '', h = '' } = values;

    // マスターデータから材料オプションを動的に生成
    let materialOptions = '';
    try {
      const master = window.stateManager?.getState?.()?.accountingMaster;
      if (master && Array.isArray(master)) {
        materialOptions = master
          .filter(m => m['種別'] === C.itemTypes.MATERIAL)
          .map(
            m =>
              `<option value="${escapeHTML(m[HEADERS.ACCOUNTING.ITEM_NAME])}" ${type === m[HEADERS.ACCOUNTING.ITEM_NAME] ? 'selected' : ''}>${escapeHTML(m[HEADERS.ACCOUNTING.ITEM_NAME])}</option>`,
          )
          .join('');
      }
    } catch (e) {
      // フォールバック: 静的オプション
      const staticOptions = ['桂', 'シナ', '檜', '楠', '桜', '朴', 'その他'];
      materialOptions = staticOptions
        .map(
          option =>
            `<option value="${option}" ${type === option ? 'selected' : ''}>${option}</option>`,
        )
        .join('');
    }

    return `<div data-material-row-index="${index}">
        <div class="grid grid-cols-1 gap-y-2">
          <select id="material-type-${index}" name="materialType${index}" class="${DesignConfig.inputs.base} accounting-item">
            <option value="">-- 樹種を選択 --</option>
            ${materialOptions}
          </select>
        </div>
        <div class="grid grid-cols-4 gap-2 mt-2 items-center">
          <input type="number" id="material-l-${index}" name="materialL${index}" value="${l || ''}" placeholder="縦(mm)" step="5" class="${DesignConfig.inputs.base} accounting-item custom-placeholder">
          <input type="number" id="material-w-${index}" name="materialW${index}" value="${w || ''}" placeholder="横(mm)" step="5" class="${DesignConfig.inputs.base} accounting-item custom-placeholder">
          <input type="number" id="material-h-${index}" name="materialH${index}" value="${h || ''}" placeholder="厚(mm)" step="5" class="${DesignConfig.inputs.base} accounting-item custom-placeholder">
          <div id="material-price-${index}" class="text-right text-base text-brand-subtle">0円</div>
        </div>
      </div>`;
  },

  /**
   * その他販売項目行
   * @param {Object} config - 設定オブジェクト
   * @param {number} config.index - 行のインデックス
   * @param {Object} [config.values] - 初期値
   * @returns {string} HTML文字列
   */
  otherSalesRow: ({ index, values = {} }) => {
    const { name = '', price = '' } = values;
    return `<div data-other-sales-row="${index}" class="mt-2 pt-2 border-t border-ui-border grid grid-cols-3 gap-2 items-center">
        <input type="text" id="other-sales-name-${index}" name="otherSalesName${index}" value="${escapeHTML(name)}" placeholder="商品名" class="col-span-2 ${DesignConfig.inputs.base} accounting-item">
        <input type="text" inputmode="decimal" id="other-sales-price-${index}" name="otherSalesPrice${index}" value="${price}" placeholder="金額" class="${DesignConfig.inputs.base} accounting-item">
      </div>`;
  },

  /**
   * 会計済み表示
   * @param {Object} config - 設定オブジェクト
   * @param {Object} config.details - 会計詳細データ
   * @param {Object} config.reservation - 予約データ
   * @returns {string} HTML文字列
   */
  accountingCompleted: ({ details, reservation }) => {
    const tuitionItemsHtml = details.tuition.items
      .map(
        i =>
          `<div class="flex justify-between"><span>${escapeHTML(i.name)}</span><span>${i.price.toLocaleString()}円</span></div>`,
      )
      .join('');
    const salesItemsHtml = details.sales.items
      .map(
        i =>
          `<div class="flex justify-between"><span>${escapeHTML(i.name)}</span><span>${i.price.toLocaleString()}円</span></div>`,
      )
      .join('');
    const v = reservation.venue ? `（${reservation.venue}）` : '';

    return `<div class="text-center py-4">
        <h1 class="text-2xl font-bold text-brand-text mt-4 mb-2">会計済み</h1>
        <p class="text-brand-subtle mb-6"><b>${formatDate(reservation.date)}</b><br>${reservation.classroom}${v}</p>
      </div>
      <div class="p-4 bg-ui-surface border border-ui-border rounded-lg text-left space-y-4">
        <div><h3 class="font-bold text-brand-text border-b border-ui-border mb-1 pb-1">授業料</h3><div class="space-y-1 text-brand-text">${tuitionItemsHtml || 'なし'}</div></div>
        <div><h3 class="font-bold text-brand-text border-b border-ui-border mb-1 pb-1">販売</h3><div class="space-y-1 text-brand-text">${salesItemsHtml || 'なし'}</div></div>
        <div class="text-right font-bold text-xl pt-2 border-t border-ui-border text-brand-text">合計: ${details.grandTotal.toLocaleString()}円</div>
        <div class="text-right text-base pt-2 text-brand-subtle">支払方法: ${escapeHTML(details.paymentMethod)}</div>
      </div>
      <div class="mt-4 flex flex-col space-y-3">
        ${Components.button({ action: 'editAccountingRecord', text: '会計内容を修正する', style: 'secondary', size: 'full' })}
      </div>`;
  },

  /**
   * 会計フォーム全体
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.type - フォームタイプ ('timeBased' | 'fixed')
   * @param {Object} config.master - 会計マスターデータ
   * @param {Object} config.reservation - 予約データ
   * @param {Object} config.reservationDetails - 予約固有情報
   * @param {Object} config.scheduleInfo - 講座固有情報
   * @returns {string} HTML文字列
   */
  accountingForm: ({
    type,
    master,
    reservation,
    reservationDetails,
    scheduleInfo,
  }) => {
    // 授業料セクション
    let tuitionHtml;
    if (type === 'timeBased') {
      const tuitionItemRule = getTuitionItemRule(
        master,
        reservation.classroom,
        C.items.MAIN_LECTURE,
      );
      tuitionHtml = Components.timeBasedTuition({
        tuitionItemRule,
        reservationDetails,
        scheduleInfo,
      });
    } else {
      tuitionHtml = Components.fixedTuitionSection({
        master,
        reservation,
        reservationDetails,
      });
    }

    // 販売セクション
    const salesHtml = Components.salesSection({ master, reservationDetails });

    return `<div class="text-center py-4">
        <p class="text-brand-subtle mb-6"><b>${formatDate(reservation.date)}</b><br>${reservation.classroom}${reservation.venue ? `（${reservation.venue}）` : ''}</p>
      </div>
      <form id="accounting-form" class="space-y-6">
        ${tuitionHtml}
        ${salesHtml}
        <div class="text-right text-2xl font-bold py-4 border-t-2 border-ui-border flex flex-col items-end">
          <span id="grand-total-amount" class="text-brand-text">合計: 0円</span>
        </div>
        <div class="mt-4 text-center">
          <p class="text-base text-state-danger-text font-bold mb-2">金額を、先生に確認してもらってください</p>
          <div class="space-y-3">
            ${Components.button({ action: 'showAccountingConfirmation', text: '先生の確認が完了しました', style: 'primary', size: 'full' })}
          </div>
        </div>
      </form>`;
  },

  /**
   * 時間制授業料セクション
   * @param {Object} config - 設定オブジェクト
   * @param {Object} config.tuitionItemRule - 授業料ルール
   * @param {Object} config.reservationDetails - 予約固有情報
   * @param {Object} config.scheduleInfo - 講座固有情報
   * @returns {string} HTML文字列
   */
  timeBasedTuition: ({ tuitionItemRule, reservationDetails, scheduleInfo }) => {
    return getTimeBasedTuitionHtml(
      tuitionItemRule,
      reservationDetails,
      scheduleInfo,
    );
  },

  /**
   * 固定制授業料セクション
   * @param {Object} config - 設定オブジェクト
   * @param {Object} config.master - 会計マスター
   * @param {Object} config.reservation - 予約データ
   * @param {Object} config.reservationDetails - 予約固有情報
   * @returns {string} HTML文字列
   */
  fixedTuitionSection: ({ master, reservation, reservationDetails }) => {
    // isFirstTimeBooking をstateManagerから取得
    const isFirstTimeBooking = stateManager.getState().isFirstTimeBooking;

    // 使用する授業料項目を決定（初回授業料 or 基本授業料）
    const targetItemName = isFirstTimeBooking
      ? C.items.FIRST_LECTURE
      : C.items.MAIN_LECTURE;
    const tuitionItem = master.find(
      item =>
        item[HEADERS.ACCOUNTING.TYPE] === C.itemTypes.TUITION &&
        item[HEADERS.ACCOUNTING.ITEM_NAME] === targetItemName &&
        (item[HEADERS.ACCOUNTING.TARGET_CLASSROOM] === '共通' ||
          item[HEADERS.ACCOUNTING.TARGET_CLASSROOM]?.includes(
            reservation.classroom,
          )),
    );

    // 授業料の表示内容を生成
    let tuitionDisplayHtml = '';
    if (tuitionItem) {
      const price = tuitionItem[HEADERS.ACCOUNTING.UNIT_PRICE] || 0;
      const bgColor = isFirstTimeBooking
        ? 'bg-green-50 border-green-400'
        : 'bg-blue-50 border-blue-400';
      const textColor = isFirstTimeBooking ? 'text-green-800' : 'text-blue-800';
      const label = isFirstTimeBooking
        ? C.items.FIRST_LECTURE
        : C.items.MAIN_LECTURE;

      tuitionDisplayHtml = `<div class="mb-4 p-3 ${bgColor} rounded border-l-4">
          <div class="text-base ${textColor}">
            <span class="font-semibold">${label}:</span> ¥${price.toLocaleString()}
          </div>
        </div>`;
    }

    const tuitionItems = master.filter(
      item =>
        item[HEADERS.ACCOUNTING.TYPE] === C.itemTypes.TUITION &&
        (item[HEADERS.ACCOUNTING.TARGET_CLASSROOM] === '共通' ||
          item[HEADERS.ACCOUNTING.TARGET_CLASSROOM]?.includes(
            reservation.classroom,
          )),
    );

    const tuitionRowsHtml = tuitionItems
      .map(item => {
        const itemName = item[HEADERS.ACCOUNTING.ITEM_NAME];

        // メイン授業料項目の処理（初回参加時は差し替え）
        if (itemName === targetItemName) {
          return Components.accountingRow({
            name: itemName,
            itemType: C.itemTypes.TUITION,
            price: item[HEADERS.ACCOUNTING.UNIT_PRICE],
            checked: true,
            disabled: true,
          });
        }

        // 使わない授業料項目をスキップ
        if (
          (itemName === C.items.FIRST_LECTURE && !isFirstTimeBooking) ||
          (itemName === C.items.MAIN_LECTURE && isFirstTimeBooking)
        ) {
          return '';
        }

        // その他の項目（彫刻刀レンタルなど）
        const isChecked = !!(
          reservationDetails[itemName] ||
          (itemName === C.items.CHISEL_RENTAL &&
            reservationDetails.chiselRental)
        );

        return Components.accountingRow({
          name: itemName,
          itemType: C.itemTypes.TUITION,
          price: item[HEADERS.ACCOUNTING.UNIT_PRICE],
          checked: isChecked,
          disabled: false,
        });
      })
      .filter(html => html !== '')
      .join('');

    return `<div class="p-4 bg-ui-surface border border-ui-border rounded-lg">
        <h3 class="text-xl font-bold mb-3 text-brand-text">授業料</h3>
        ${tuitionDisplayHtml}
        <div class="space-y-3">${tuitionRowsHtml}</div>
        <div id="tuition-breakdown" class="mt-4 pt-4 border-t border-ui-border space-y-1 text-base text-brand-subtle"></div>
        <div class="text-right font-bold mt-2 text-brand-text" id="tuition-subtotal">小計: 0円</div>
      </div>`;
  },

  // =================================================================
  // --- Level 3: 画面セクション（Organisms） ---
  // -----------------------------------------------------------------
  // 複合的なUIセクション（ホーム、予約一覧等）
  // =================================================================

  /**
   * ホームセクション（予約または履歴）
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.title - セクションタイトル
   * @param {Array} config.items - 表示項目の配列（HTMLカード文字列の配列）
   * @param {boolean} [config.showNewButton=false] - 新規追加ボタンの表示制御
   * @param {string} [config.newAction] - 新規追加ボタンのaction
   * @param {boolean} [config.showMoreButton=false] - もっとみるボタンの表示制御
   * @param {string} [config.moreAction] - もっとみるボタンのaction
   * @returns {string} HTML文字列
   */
  dashboardSection: ({
    title,
    items,
    showNewButton = false,
    newAction,
    showMoreButton = false,
    moreAction,
  }) => {
    let newButtonHtml = '';
    if (showNewButton && newAction) {
      newButtonHtml = Components.newReservationCard({ action: newAction });
    }

    const itemsHtml = items.join('');

    let moreButtonHtml = '';
    if (showMoreButton && moreAction) {
      moreButtonHtml = `<div class="text-center mt-4">
          ${Components.button({ action: moreAction, text: 'もっとみる', style: 'secondary', size: 'small' })}
        </div>`;
    }

    return `
        <div class="mb-8 w-full">
          <div class="bg-ui-surface border border-ui-border p-3 rounded-lg space-y-3">
            <h2 class="text-xl font-medium text-brand-text text-center mb-2">${escapeHTML(title)}</h2>
            ${newButtonHtml}
            ${itemsHtml}
            ${moreButtonHtml}
          </div>
        </div>
      `;
  },

  /**
   * 新規予約カード（ホーム用）
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.action - data-action属性の値
   * @returns {string} HTML文字列
   */
  newReservationCard: ({ action }) => {
    return `
        <div data-action="${action}" class="w-full p-4 rounded-lg border-2 border-dashed border-action-primary-border bg-action-primary-light cursor-pointer mobile-card touch-friendly">
          <div class="text-center">
            <span class="text-xl font-bold text-action-primary-bg">+ あたらしく よやく する</span>
          </div>
        </div>
      `;
  },

  /**
   * 統一カードレイアウト（予約・履歴共通）- 純粋描画層
   * @param {Object} config - 設定オブジェクト
   * @param {Object} config.item - 予約または履歴データ
   * @param {string} config.item.reservationId - 予約ID
   * @param {string} config.item.classroom - 教室名
   * @param {string} config.item.date - 日付
   * @param {string} config.item.startTime - 開始時刻
   * @param {string} config.item.endTime - 終了時刻
   * @param {string} [config.item.workInProgress] - 制作メモ（履歴の場合）
   * @param {Array} config.badges - バッジ配列（表示準備済み）
   * @param {Array} config.editButtons - 編集ボタン配列（表示準備済み）
   * @param {Array} config.accountingButtons - 会計ボタン配列（表示準備済み）
   * @param {string} [config.type='booking'] - カードタイプ ('booking' | 'history')
   * @returns {string} HTML文字列
   */
  listCard: ({
    item,
    badges = [],
    editButtons = [],
    accountingButtons = [],
    type = 'booking',
  }) => {
    const isHistory = type === 'history';

    // カード基本スタイル
    const cardColorClass =
      type === 'booking'
        ? `booking-card ${DesignConfig.cards.state.booked.card}`
        : `record-card ${DesignConfig.cards.state.history.card}`;

    // バッジHTML生成
    const badgesHtml = badges
      .map(badge =>
        Components.statusBadge({ type: badge.type, text: badge.text }),
      )
      .join('');

    // 編集ボタンHTML生成
    const editButtonsHtml = editButtons
      .map(btn =>
        Components.button({
          action: btn.action,
          text: btn.text,
          style: btn.style || 'secondary',
          size: btn.size || 'xs',
          //          customClass: 'mobile-button',
          dataAttributes: {
            classroom: item.classroom,
            reservationId: item.reservationId,
            date: item.date,
            ...(btn.details && { details: JSON.stringify(btn.details) }),
          },
        }),
      )
      .join('');

    // 会計ボタンHTML生成
    const accountingButtonsHtml = accountingButtons
      .map(btn =>
        Components.button({
          action: btn.action,
          text: btn.text,
          style: btn.style || 'primary',
          size: 'small',
          //          customClass: `mobile-button ${DesignConfig.colors.accounting}`,
          dataAttributes: {
            classroom: item.classroom,
            reservationId: item.reservationId,
            date: item.date,
            ...(btn.details && { details: JSON.stringify(btn.details) }),
          },
        }),
      )
      .join('');

    // 日時・会場表示
    const dateTimeDisplay = item.startTime
      ? ` ${item.startTime} ~ ${item.endTime}`.trim()
      : '';
    const venueDisplay = `${HEADERS?.[item.classroom] || item.classroom}`;

    // 制作メモ表示（履歴の場合のみ）
    const memoSection = `<div class=" p-0.5 bg-white/75">
        <h4 class="text-xs font-bold text-brand-subtle mb-0">制作メモ</h4>
          <p class="text-sm text-brand-text whitespace-pre-wrap px-1 min-h-14">${escapeHTML(item.workInProgress)}</p>
      </div>`;

    return `
      <div class="w-full mb-4 px-0">
        <div class="${cardColorClass} p-2 rounded-lg shadow-sm">
          <!-- 上部：教室情報+編集ボタン -->
          <div class="flex justify-between items-start mb-0">
            <div class="flex-1 min-w-0">
              <div class="flex items-center flex-wrap">
                <h3 class="font-bold text-brand-text">${formatDate(item.date)} <span class="font-normal text-brand-subtle">${dateTimeDisplay}</span></h3>
              </div>
              <h4 class="text-base text-brand-text font-bold mt-0">${escapeHTML(venueDisplay)}  ${badgesHtml}</h4>
            </div>
            ${editButtonsHtml ? `<div class="flex-shrink-0 self-start">${editButtonsHtml}</div>` : ''}
          </div>

          ${memoSection}

          <!-- 会計ボタンセクション -->
          ${
            accountingButtonsHtml
              ? `
            <div class="flex justify-end">
              ${accountingButtonsHtml}
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  },

  /**
   * 販売セクション
   * @param {Object} config - 設定オブジェクト
   * @param {Object} config.master - 会計マスター
   * @param {Object} config.reservationDetails - 予約固有情報
   * @returns {string} HTML文字列
   */
  salesSection: ({ master, reservationDetails }) => {
    const salesItems = master.filter(
      item => item['種別'] === C.itemTypes.SALES,
    );
    const salesItemsHtml = salesItems
      .map(item => {
        // truthy値でチェック状態を判定（より柔軟）
        const isChecked =
          !!reservationDetails[item[HEADERS.ACCOUNTING.ITEM_NAME]];

        return Components.accountingRow({
          name: item[HEADERS.ACCOUNTING.ITEM_NAME],
          itemType: C.itemTypes.SALES,
          price: item[HEADERS.ACCOUNTING.UNIT_PRICE],
          checked: isChecked,
        });
      })
      .join('');

    return `<div class="p-4 bg-ui-surface border border-ui-border rounded-lg">
        <h3 class="text-xl font-bold mb-3 text-left text-brand-text">販売</h3>
        <div class="mb-3 space-y-4">
          <label class="block text-brand-text text-base font-bold">材料代</label>
          <div id="materials-container">
            ${Components.materialRow({
              index: 0,
              values: {
                type: reservationDetails.materialType0,
                l: reservationDetails.materialL0,
                w: reservationDetails.materialW0,
                h: reservationDetails.materialH0,
              },
            })}
          </div>
        </div>
        ${Components.button({ action: 'addMaterialRow', text: '+ 材料を追加', style: 'secondary', size: 'full' })}
        <details class="mt-4">
          <summary class="font-bold text-brand-text flex items-center">
            <span class="arrow mr-2">▶</span> その他の販売品
          </summary>
          <div class="mt-2 space-y-2 pt-2 border-t border-ui-border">
            ${salesItemsHtml}
            <div id="other-sales-container" class="mt-2 pt-2 border-t border-ui-border">
              ${Components.otherSalesRow({
                index: 0,
                values: {
                  name: reservationDetails.otherSalesName0,
                  price: reservationDetails.otherSalesPrice0,
                },
              })}
            </div>
          </div>
          ${Components.button({ action: 'addOtherSalesRow', text: '+ 自由入力欄を追加', style: 'secondary', size: 'full' })}
        </details>
        <div class="text-right font-bold mt-2 text-brand-text" id="sales-subtotal">小計: 0円</div>
      </div>`;
  },
};

// =================================================================
// --- Specialized Components ---
// -----------------------------------------------------------------
// 特定用途に特化したコンポーネント
// =================================================================

/**
 * 右上固定配置の戻るボタンを生成します
 * @param {string} action - アクション名（デフォルト: 'smartGoBack'）
 * @param {string} text - ボタンテキスト（デフォルト: '戻る'）
 * @returns {string} HTML文字列
 */
Components.createBackButton = (action = 'smartGoBack', text = '戻る') => {
  return `
      <div class="back-button-container fixed top-4 right-4 z-30">
        <button
          data-action="${escapeHTML(action)}"
          class="bg-action-secondary-bg text-action-secondary-text active:bg-action-secondary-hover font-bold py-2 px-4 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly shadow-lg"
        >
          ${escapeHTML(text)}
        </button>
      </div>`;
};

/**
 * 現在のビューに応じて適切な戻るボタンを生成します
 * @param {string} currentView - 現在のビュー名
 * @param {object} appState - アプリケーション状態
 * @returns {string} HTML文字列
 */
Components.createSmartBackButton = (currentView, appState = null) => {
  const state =
    appState || (window.stateManager ? window.stateManager.getState() : {});
  let action = 'smartGoBack';
  let text = '戻る';

  // ビューに応じて適切なアクションとテキストを設定
  switch (currentView) {
    case 'login':
      // ログイン画面では戻るボタンを表示しない
      return '';

    case 'register':
      text = 'ログインへ';
      action = 'goBackToLogin';
      break;

    case 'registrationStep2':
      text = '前へ';
      action = 'backToStep1';
      break;

    case 'registrationStep3':
      text = '前へ';
      action = 'backToStep2';
      break;

    case 'registrationStep4':
      text = '前へ';
      action = 'backToStep3';
      break;

    case 'userSearch':
      text = 'ログインへ';
      action = 'goBackToLogin';
      break;

    case 'dashboard':
      // ダッシュボードでは戻るボタンを表示しない
      return '';

    case 'bookingSlots':
      text = 'ホーム';
      action = 'goBackToDashboard';
      break;

    case 'newReservation':
      text = '予約一覧';
      action = 'goBackToBooking';
      break;

    case 'editReservation':
      text = 'ホーム';
      action = 'goBackToDashboard';
      break;

    case 'accounting':
      text = 'ホーム';
      action = 'goBackToDashboard';
      break;

    case 'complete':
      text = 'ホーム';
      action = 'goBackToDashboard';
      break;

    default:
      // デフォルトはスマート戻る
      break;
  }

  return Components.createBackButton(action, text);
};

// =================================================================
// --- レガシー互換性サポート ---
// -----------------------------------------------------------------
// 既存のコード互換性を維持するための旧式コンポーネント
// 段階的移行期間中のみ使用
// =================================================================

/**
 * レガシー createButton (既存コード互換用)
 * 新規コードではComponents.button()を使用してください
 */
Components.createButton = config => {
  // 旧形式を新形式にマッピング
  let style = 'primary';
  if (config.colorClass) {
    if (config.colorClass.includes('secondary')) style = 'secondary';
    if (config.colorClass.includes('danger')) style = 'danger';
  }

  let size = 'normal';
  if (config.widthClass && config.widthClass.includes('full')) size = 'full';

  // 旧式パラメータをHTMLに埋め込み（actionHandlers互換性のため）
  const dataAttributes = {};
  if (config.classroom) dataAttributes.classroom = config.classroom;
  if (config.date) dataAttributes.date = config.date;
  if (config.reservationId) dataAttributes.reservationId = config.reservationId;
  if (config.sheetName) dataAttributes.sheetName = config.sheetName;
  if (config.copyText) dataAttributes.copyText = config.copyText;
  if (config.details) dataAttributes.details = config.details;
  if (config.studentId) dataAttributes.studentId = config.studentId;
  if (config.realName) dataAttributes.realName = config.realName;
  if (config.nickname) dataAttributes.nickname = config.nickname;
  if (config.classroomName) dataAttributes.classroomName = config.classroomName;

  return Components.button({
    action: config.action,
    text: config.text,
    style: style,
    size: size,
    disabled: config.disabled,
    customClass: config.colorClass, // カスタムクラスを渡す
    dataAttributes: dataAttributes,
  });
};

/**
 * レガシー createInput (既存コード互換用)
 */
Components.createInput = config => {
  // 複雑な旧形式をサポート
  let inputHtml = `<div class="${config.containerClass || ''} mb-4">
      <label
        for="${config.id}"
        class="${config.labelClass || DesignConfig.text.labelBlock} ${config.isSrOnly ? 'sr-only' : ''}"
      >${escapeHTML(config.label)}</label>
      ${config.caption ? `<p class="${DesignConfig.text.caption} mb-2">${escapeHTML(config.caption)}</p>` : ''}
      <input
        type="${config.type}"
        id="${config.id}"
        value="${escapeHTML(config.value || '')}"
        class="${DesignConfig.inputs.base} ${config.inputClass || ''}"
        placeholder="${escapeHTML(config.placeholder || '')}"
        ${config.required ? 'required' : ''}
        autocomplete="${config.autocomplete || 'off'}"
        ${config.step ? `step="${config.step}"` : ''}
        ${config.inputmode ? `inputmode="${config.inputmode}"` : ''}
        ${config.pattern ? `pattern="${config.pattern}"` : ''}
      >
    </div>`;

  return inputHtml;
};

/**
 * レガシー createTextArea (既存コード互換用)
 */
Components.createTextArea = config => {
  return `<div class="${config.containerClass || ''} mb-4">
      <label for="${config.id}" class="${DesignConfig.text.labelBlock}">${escapeHTML(config.label)}</label>
      ${config.caption ? `<p class="${DesignConfig.text.caption} mb-2">${escapeHTML(config.caption)}</p>` : ''}
      <textarea
        id="${config.id}"
        class="${DesignConfig.inputs.textarea}"
        placeholder="${escapeHTML(config.placeholder || '')}"
      >${escapeHTML(config.value || '')}</textarea>
    </div>`;
};

/**
 * レガシー createSelect (既存コード互換用)
 */
Components.createSelect = config => {
  return `<div class="${config.containerClass || ''}">
      ${config.label ? `<label for="${config.id}" class="${DesignConfig.text.labelBlock}">${escapeHTML(config.label)}</label>` : ''}
      ${config.caption ? `<p class="${DesignConfig.text.caption} mb-2">${escapeHTML(config.caption)}</p>` : ''}
      <select
        id="${config.id}"
        class="${DesignConfig.inputs.base} ${config.sizeClass || ''} accounting-item"
        ${config.name ? `name="${config.name}"` : ''}
      >${config.options}</select>
    </div>`;
};

/**
 * レガシー createCheckbox (既存コード互換用)
 */
Components.createCheckbox = config => {
  return `<label class="flex items-center space-x-2 ${DesignConfig.colors.text}">
      <input
        type="checkbox"
        id="${config.id}"
        ${config.checked ? 'checked' : ''}
        class="accent-action-primary-bg"
      >
      <span>${escapeHTML(config.label)}</span>
    </label>`;
};

// =================================================================
// --- モーダルコンポーネント ---
// -----------------------------------------------------------------
// 汎用モーダル機能
// =================================================================

/**
 * 汎用モーダルコンポーネントを生成します
 * @param {Object} config - 設定オブジェクト
 * @param {string} config.id - モーダルのID
 * @param {string} config.title - モーダルのタイトル
 * @param {string} config.content - モーダルの内容（HTML文字列）
 * @param {string} [config.maxWidth] - 最大幅のCSSクラス（デフォルト: 'max-w-sm'）
 * @param {boolean} [config.showCloseButton] - 右上の×ボタンを表示するか（デフォルト: true）
 * @returns {string} HTML文字列
 */
Components.modal = config => {
  const maxWidth = config.maxWidth || 'max-w-sm';
  const showCloseButton = config.showCloseButton !== false;

  return `
      <div id="${escapeHTML(config.id)}" class="modal-fade fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden" onclick="Components.closeModalOnBackdrop(event, '${escapeHTML(config.id)}')">
        <div class="bg-white rounded-lg ${maxWidth} mx-4 max-h-[90vh] overflow-y-auto" onclick="Components.handleModalContentClick(event)" data-modal-content="true">
          <div class="flex justify-between items-center p-4 border-b border-ui-border">
            <h2 class="text-xl font-bold text-brand-text">${escapeHTML(config.title)}</h2>
            ${showCloseButton ? `<button onclick="Components.closeModal('${escapeHTML(config.id)}')" class="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none">&times;</button>` : ''}
          </div>
          <div class="p-4">
            ${config.content}
          </div>
        </div>
      </div>`;
};

/**
 * モーダルを表示します（フェードインアニメーション付き）
 * @param {string} modalId - モーダルのID
 */
Components.showModal = modalId => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    // フェードインアニメーションのための遅延
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
    // フォーカストラップの設定
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }
};

/**
 * モーダルを非表示にします（フェードアウトアニメーション付き）
 * @param {string} modalId - モーダルのID
 */
Components.closeModal = modalId => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    // フェードアウトアニメーション完了後に完全に非表示にする
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300); // CSS transitionと同じ時間
  }
};

/**
 * 背景クリックでモーダルを閉じる処理
 * @param {Event} event - クリックイベント
 * @param {string} modalId - モーダルのID
 */
Components.closeModalOnBackdrop = (event, modalId) => {
  if (event.target === event.currentTarget) {
    Components.closeModal(modalId);
  }
};

/**
 * モーダルコンテンツ内のクリック処理
 * ボタンなどのインタラクティブ要素はイベントを継続し、その他では伝播を停止
 * @param {Event} event - クリックイベント
 */
Components.handleModalContentClick = event => {
  // ボタンまたはdata-action要素の場合はイベントを継続
  const actionElement = event.target.closest('button, [data-action]');
  if (actionElement) {
    // ボタンクリックの場合は伝播を継続（外側のハンドラーで処理）
    return;
  }
  // それ以外の場合は伝播を停止
  event.stopPropagation();
};
