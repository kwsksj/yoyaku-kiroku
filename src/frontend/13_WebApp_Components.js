// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

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
 * @param {string | number | boolean} str - エスケープする文字列、数値、真偽値
 * @returns {string} エスケープされた文字列
 */
window.escapeHTML = /** @type {HTMLEscapeFunction} */ (
  str => {
    if (typeof str !== 'string') {
      return String(str);
    }
    return str.replace(/[&<>"']/g, function (match) {
      /** @type {Record<string, string>} */
      const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return escapeMap[match] || match;
    });
  }
);

// =================================================================
// --- Level 1: 基本要素（Atomic Components） ---
// -----------------------------------------------------------------
// 最小単位のUIコンポーネント。単一責任でパラメータ最小化。
// =================================================================

const Components = {
  /**
   * 汎用モーダルコンポーネントを生成します
   * @param {ModalConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  modal: config => {
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
  },

  /**
   * モーダルを表示します（フェードインアニメーション付き）
   * @param {string} modalId - モーダルのID
   */
  showModal: modalId => {
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
        const firstElement = /** @type {HTMLElement} */ (focusableElements[0]);
        if (firstElement && typeof firstElement.focus === 'function') {
          firstElement.focus();
        }
      }
    }
  },

  /**
   * モーダルを非表示にします（フェードアウトアニメーション付き）
   * @param {string} modalId - モーダルのID
   */
  closeModal: modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      // フェードアウトアニメーション完了後に完全に非表示にする
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 300); // CSS transitionと同じ時間
    }
  },

  /**
   * 背景クリックでモーダルを閉じる処理
   * @param {Event} event - クリックイベント
   * @param {string} modalId - モーダルのID
   */
  closeModalOnBackdrop: (event, modalId) => {
    if (event.target === event.currentTarget) {
      Components.closeModal(modalId);
    }
  },

  /**
   * モーダルコンテンツ内のクリック処理
   * ボタンなどのインタラクティブ要素はイベントを継続し、その他では伝播を停止
   * @param {Event} event - クリックイベント
   */
  handleModalContentClick: event => {
    // ボタンまたはdata-action要素の場合はイベントを継続
    const actionElement = event.target.closest('button, [data-action]');
    if (actionElement) {
      // ボタンクリックの場合は伝播を継続（外側のハンドラーで処理）
      return;
    }
    // それ以外の場合は伝播を停止
    event.stopPropagation();
  },

  /**
   * 進化版ボタンコンポーネント
   * @param {ButtonConfig} config - 設定オブジェクト
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
    id = '',
    disabledStyle = 'auto', // 'auto', 'none', 'custom'
  }) => {
    // スタイルマッピング
    const styleClasses = {
      primary: DesignConfig.colors['primary'],
      secondary: DesignConfig.colors['secondary'],
      danger: DesignConfig.colors['danger'],
    };

    /** @type {Record<ComponentSize, string>} */
    const sizeClasses = {
      normal: '',
      full: DesignConfig.buttons['full'],
      small: 'text-sm px-3 py-1.5',
      xs: 'text-xs px-2 py-1',
      large: 'text-lg px-4 py-2.5',
    };

    // データ属性をHTML文字列に変換
    const dataAttrs = Object.entries(dataAttributes)
      .map(
        ([key, value]) =>
          `data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}="${escapeHTML(String(value))}"`,
      )
      .join(' ');

    // スタイルが'none'の場合は基本クラスを最小限にする
    const baseClass = style === 'none' ? '' : DesignConfig.buttons['base'];
    const styleClass = style === 'none' ? '' : styleClasses[style] || '';

    const sizeClass = size && sizeClasses[size] ? sizeClasses[size] : '';

    // 無効状態の自動スタイル適用
    let disabledClass = '';
    let inlineStyle = '';

    if (disabled && disabledStyle === 'auto') {
      // 自動無効状態スタイル：視覚的に押せないことを明確にする
      disabledClass = 'opacity-60 cursor-not-allowed';
      inlineStyle =
        'pointer-events: none; background-color: #d1d5db !important; color: #6b7280 !important; border-color: #d1d5db !important;';
    }

    // ID属性の生成
    const idAttr = id ? `id="${escapeHTML(id)}"` : '';

    return `<button type="button"
        ${idAttr}
        data-action="${escapeHTML(action || '')}"
        class="${[baseClass, styleClass, sizeClass, disabledClass, customClass || ''].filter(Boolean).join(' ')}"
        ${dataAttrs}
        ${disabled ? 'disabled' : ''}
        ${inlineStyle ? `style="${inlineStyle}"` : ''}
      >${text}</button>`;
  },

  /**
   * シンプル化された入力フィールドコンポーネント
   * @param {InputConfig} config - 設定オブジェクト
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
    // 電話番号・メールの場合は専用クラスを使用
    const inputClass = type === 'tel' || type === 'email'
      ? DesignConfig.inputs['phone']
      : DesignConfig.inputs['base'];

    return `<div class="mb-4">
        <label
          for="${id}"
          class="${DesignConfig.text['labelBlock']}"
        >${escapeHTML(label)}</label>
        <input
          type="${type}"
          id="${id}"
          value="${escapeHTML(value)}"
          class="${inputClass}"
          placeholder="${escapeHTML(placeholder)}"
          ${required ? 'required' : ''}
          autocomplete="off"
        >
      </div>`;
  },

  /**
   * シンプル化されたセレクトボックスコンポーネント
   * @param {SelectConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  select: ({ id, label, options }) => {
    return `<div class="mb-4">
        <label for="${id}" class="${DesignConfig.text['labelBlock']}">${escapeHTML(label)}</label>
        <select
          id="${id}"
          class="${DesignConfig.inputs['base']}"
        >${options}</select>
      </div>`;
  },

  /**
   * テキストエリアコンポーネント
   * @param {TextareaConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  textarea: ({ id, label, value = '', placeholder = '' }) => {
    return `<div class="mb-4">
        <label for="${id}" class="${DesignConfig.text['labelBlock']}">${escapeHTML(label)}</label>
        <textarea
          id="${id}"
          class="${DesignConfig.inputs['textarea']}"
          placeholder="${escapeHTML(placeholder)}"
        >${escapeHTML(value)}</textarea>
      </div>`;
  },

  /**
   * チェックボックスコンポーネント
   * @param {CheckboxConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  checkbox: ({
    id,
    label,
    checked = false,
    disabled = false,
    dynamicStyle = false,
    dataAttributes = {},
  }) => {
    // 動的スタイル用のクラス設定
    const labelClass = dynamicStyle
      ? checked
        ? 'font-bold text-brand-text'
        : 'text-brand-muted'
      : DesignConfig.colors['text'];

    // disabledの場合のスタイル調整
    const finalLabelClass = disabled
      ? `${labelClass} opacity-50 cursor-not-allowed`
      : labelClass;

    // data属性を文字列として生成
    const dataAttributesString = Object.entries(dataAttributes)
      .map(([key, value]) => `data-${key}="${escapeHTML(String(value))}"`)
      .join(' ');

    return `<label class="flex items-center space-x-2 ${finalLabelClass}">
        <input
          type="checkbox"
          id="${id}"
          ${checked ? 'checked' : ''}
          ${disabled ? 'disabled' : ''}
          class="accent-action-primary-bg"
          ${dynamicStyle ? 'data-dynamic-style="true"' : ''}
          ${dataAttributesString}
        >
        <span>${label}</span>
      </label>`;
  },

  // =================================================================
  // --- UI統一化コンポーネント ---
  // -----------------------------------------------------------------

  /**
   * 統一ページコンテナ
   * @param {PageContainerConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  pageContainer: ({ content, maxWidth = '2xl' }) => {
    return `<div class="max-w-${maxWidth} mx-auto px-4">${content}</div>`;
  },

  /**
   * 統一カードコンテナ
   * @param {CardContainerConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  cardContainer: ({
    content,
    variant = 'default',
    padding = 'normal',
    touchFriendly = false,
    customClass = '',
    dataAttributes = '',
  }) => {
    const variants = {
      default: DesignConfig.cards.background,
      highlight: 'bg-blue-50 border-blue-200',
      success: 'bg-green-50 border-green-200',
      warning: 'bg-yellow-50 border-yellow-200',
      available: `${DesignConfig.cards.base} ${DesignConfig.cards.state.available.card}`,
      waitlist: `${DesignConfig.cards.base} ${DesignConfig.cards.state.waitlist.card}`,
      booked: `${DesignConfig.cards.base} ${DesignConfig.cards.state.booked.card}`,
      history: `record-card ${DesignConfig.cards.state.history.card}`,
    };

    const paddings = {
      compact: 'p-2',
      normal: 'p-3',
      spacious: 'p-4',
    };

    // タッチフレンドリー対応
    const touchClass = touchFriendly
      ? 'touch-friendly transition-all duration-150'
      : '';

    // 状態バリエーションではDesignConfig.cards.baseが含まれている
    const baseClasses = ['available', 'waitlist', 'booked', 'history'].includes(
      variant,
    )
      ? ''
      : 'rounded-lg border';

    const finalClasses =
      `${variants[variant]} ${paddings[padding]} ${baseClasses} ${touchClass} ${customClass}`.trim();

    return `<div class="${finalClasses}" ${dataAttributes}>
      ${content}
    </div>`;
  },

  // =================================================================
  // --- 新設計コンポーネント ---
  // -----------------------------------------------------------------

  /**
   * ステータスバッジ
   * @param {StatusBadgeConfig} config - 設定オブジェクト
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
   * 拡張料金表示コンポーネント
   * @param {PriceDisplayConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  priceDisplay: ({
    amount,
    label = '',
    size = 'normal',
    style = 'default',
    showCurrency = true,
    align = 'right',
  }) => {
    const sizes = {
      small: 'text-sm',
      normal: 'text-base',
      large: 'text-xl',
    };

    const styles = {
      default: 'text-brand-text',
      highlight: 'text-brand-text font-semibold',
      subtotal: 'text-brand-text font-semibold text-lg',
      total: 'text-brand-text font-bold text-xl',
    };

    // 負の値の場合は赤い文字色を適用
    const isNegative = typeof amount === 'number' && amount < 0;
    const negativeClass = isNegative ? 'text-red-600' : '';

    const aligns = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    };

    const formattedAmount =
      typeof amount === 'number' ? amount.toLocaleString() : amount;
    const currency = showCurrency ? '¥' : '';

    // サイズに応じて価格表示の幅クラスを決定
    let priceWidthClass = '';
    if (size === 'large') {
      priceWidthClass = 'large';
    } else if (size === 'small') {
      priceWidthClass = 'small';
    }

    return `<span class="${aligns[align] || aligns.right}">
        ${label ? `<span class="text-brand-subtle text-sm">${escapeHTML(label)}: </span>` : ''}
        <span class="${sizes[size] || sizes.normal} ${negativeClass || styles[style] || styles.default} price-amount ${priceWidthClass}">${currency}${formattedAmount}</span>
      </span>`;
  },

  /**
   * 統一ボタンセクション
   * @param {ActionButtonSectionConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  actionButtonSection: ({
    primaryButton,
    secondaryButton,
    dangerButton,
    layout = 'vertical',
    spacing = 'normal',
  }) => {
    const buttons = [secondaryButton, primaryButton, dangerButton]
      .filter(btn => btn)
      .map(btn =>
        Components.button({
          ...btn,
          size: btn.size || (layout === 'horizontal' ? 'large' : 'full'),
        }),
      );

    if (buttons.length === 0) return '';

    const layoutClasses = {
      vertical: 'flex flex-col',
      horizontal: 'flex justify-between items-center gap-4',
    };

    const spacingClasses = {
      compact: layout === 'vertical' ? 'space-y-2' : '',
      normal: layout === 'vertical' ? 'space-y-3' : '',
      spacious: layout === 'vertical' ? 'space-y-4' : '',
    };

    return `<div class="mt-8 ${layoutClasses[layout] || layoutClasses.vertical} ${spacingClasses[spacing] || spacingClasses.normal}">
      ${buttons.join('')}
    </div>`;
  },

  // =================================================================
  // --- ページヘッダー ---
  // -----------------------------------------------------------------

  /**
   * ページヘッダー（タイトル + もどるボタン）
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.title - ページタイトル
   * @param {string} [config.backAction='smartGoBack'] - もどるボタンのアクション
   * @param {boolean} [config.showBackButton=true] - もどるボタンを表示するか
   * @returns {string} HTML文字列
   */
  pageHeader: ({
    title,
    backAction = 'smartGoBack',
    showBackButton = true,
  }) => {
    const backButtonHtml = showBackButton
      ? Components.button({
          action: backAction,
          text: 'もどる',
          style: 'secondary',
          size: 'xs',
          customClass: 'mobile-button',
        })
      : '';

    return `
      <div class="sticky top-0 bg-white border-b border-ui-border z-10 py-2 mb-2 -mx-4">
        <div class="flex justify-between items-center px-4">
          <h1 class="text-lg font-bold text-brand-text">${escapeHTML(title)}</h1>
          ${backButtonHtml}
        </div>
      </div>`;
  },

  // =================================================================
  // --- 会計系専用コンポーネント ---
  // -----------------------------------------------------------------

  /**
   * 会計項目行（チェックボックス付き）
   * @param {AccountingRowConfig} config - 設定オブジェクト
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
        <span class="text-brand-subtle">¥${price.toLocaleString()}</span>
      </div>`;
  },

  /**
   * 材料入力行
   * @param {MaterialRowConfig} config - 設定オブジェクト
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
          .filter(
            m =>
              m[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
              CONSTANTS.ITEM_TYPES.MATERIAL,
          )
          .map(
            m =>
              `<option value="${escapeHTML(m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME])}" ${type === m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ? 'selected' : ''}>${escapeHTML(m[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME])}</option>`,
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
          <div id="material-price-${index}" class="text-right text-base text-brand-subtle">¥0</div>
        </div>
      </div>`;
  },

  /**
   * その他販売項目行
   * @param {OtherSalesRowConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  otherSalesRow: ({ index, values = {} }) => {
    const { name = '', price = '' } = values;
    return `<div data-other-sales-row="${index}" class="mt-2 pt-2 border-t border-ui-border grid grid-cols-3 gap-2 items-center">
        <input type="text" id="other-sales-name-${index}" name="otherSalesName${index}" value="${escapeHTML(name)}" placeholder="商品名" class="col-span-2 ${DesignConfig.inputs.base} accounting-item">
        <input type="text" inputted="decimal" id="other-sales-price-${index}" name="otherSalesPrice${index}" value="${price}" placeholder="金額" class="${DesignConfig.inputs.base} accounting-item">
      </div>`;
  },

  /**
   * 統一された授業料セクション（セッション制ベース、時間制対応）
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.type - 授業料タイプ（'timeBased' | 'fixed'）
   * @param {AccountingMasterData[]} config.master - 会計マスター
   * @param {ReservationData} config.reservation - 予約データ
   * @param {ReservationData} config.reservationDetails - 予約固有情報
   * @param {ScheduleInfo} config.scheduleInfo - 講座固有情報
   * @returns {string} HTML文字列
   */
  unifiedTuitionSection: ({
    type,
    master,
    reservation,
    reservationDetails,
    scheduleInfo,
  }) => {
    // isFirstTimeBooking をstateManagerから取得
    const state = stateManager.getState();
    const isFirstTimeBooking = state['isFirstTimeBooking'];

    // 使用する授業料項目を決定（初回授業料 or 基本授業料）
    const targetItemName = isFirstTimeBooking
      ? CONSTANTS.ITEMS.FIRST_LECTURE
      : CONSTANTS.ITEMS.MAIN_LECTURE;

    // 時間制の場合のみ時間選択UIを追加
    let timeSelectionHtml = '';
    if (type === 'timeBased' && scheduleInfo) {
      if (!scheduleInfo.firstStart || !scheduleInfo.firstEnd) {
        return `<div class="text-ui-error-text p-4 bg-ui-error-bg rounded-lg">エラー: この教室の講座時間が設定されていません。</div>`;
      }

      // 講座時間の設定
      const startParts = scheduleInfo.firstStart.split(':');
      const endParts = scheduleInfo.firstEnd.split(':');
      const classStart = parseInt(startParts[0] || '0');
      const classEnd = parseInt(endParts[0] || '0');
      const endBuffer = 3;

      // 時間プルダウンのオプション生成
      const startTimeOptions = getTimeOptionsHtml(
        classStart,
        classEnd + endBuffer,
        30,
        reservationDetails.startTime || '',
      );
      const endTimeOptions = getTimeOptionsHtml(
        classStart,
        classEnd + endBuffer,
        30,
        reservationDetails.endTime || '',
      );
      const breakOptions = [...Array(5).keys()]
        .map(
          i =>
            `<option value="${i * 30}" ${String(i * 30) === (reservationDetails['breakTime'] || '0') ? 'selected' : ''}>${i * 30}分</option>`,
        )
        .join('');

      timeSelectionHtml = `
        <div class="mb-4 p-4 bg-gray-50 rounded-lg border">
          <h4 class="text-sm font-medium text-gray-700 mb-3">参加時間を選択してください</h4>
          <div class="grid grid-cols-3 gap-2 items-end">
            <div class="col-span-1">
              ${Components.select({
                id: 'start-time',
                label: '開始時刻',
                options: startTimeOptions,
              })}
            </div>
            <div class="col-span-1">
              ${Components.select({
                id: 'end-time',
                label: '終了時刻',
                options: endTimeOptions,
              })}
            </div>
            <div class="col-span-1">
              ${Components.select({
                id: 'break-time',
                label: '休憩時間',
                options: breakOptions,
              })}
            </div>
          </div>
          <div id="calculated-hours" class="text-left text-base ${DesignConfig.colors['textSubtle']} mt-2"></div>
        </div>`;
    }

    const tuitionItems = Array.isArray(master)
      ? master.filter(
          /** @param {AccountingMasterData} item */
          item =>
            item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
              CONSTANTS.ITEM_TYPES.TUITION &&
            (item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] === '共通' ||
              item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM]?.includes(
                reservation.classroom,
              )),
        )
      : [];

    const tuitionRowsHtml = tuitionItems
      .map(
        /** @param {AccountingMasterData} item */ item => {
          const itemName = item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME];

          // メイン授業料項目の処理（初回参加時は差し替え）
          if (itemName === targetItemName) {
            return Components.accountingRow({
              name: itemName,
              itemType: CONSTANTS.ITEM_TYPES.TUITION,
              price: item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
              checked: true,
              disabled: true,
            });
          }

          // 使わない授業料項目をスキップ
          if (
            (itemName === CONSTANTS.ITEMS.FIRST_LECTURE &&
              !isFirstTimeBooking) ||
            (itemName === CONSTANTS.ITEMS.MAIN_LECTURE && isFirstTimeBooking)
          ) {
            return '';
          }

          // その他の項目（彫刻刀レンタルなど）
          const isChecked = !!(
            reservationDetails && reservationDetails[itemName]
          );

          return Components.accountingRow({
            name: itemName,
            itemType: CONSTANTS.ITEM_TYPES.TUITION,
            price: item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
            checked: isChecked,
            disabled: false,
          });
        },
      )
      .filter(html => html !== '')
      .join('');

    return Components.cardContainer({
      variant: 'default',
      padding: 'spacious',
      content: `
        <div class="space-y-3">
          <h3 class="${DesignConfig.text['heading']} mb-2">授業料</h3>

          ${timeSelectionHtml}
          <div class="space-y-3">${tuitionRowsHtml}</div>

          <div id="tuition-breakdown" class="mt-4 pt-4 border-t border-ui-border space-y-1 text-base ${DesignConfig.colors['textSubtle']}"></div>
          <div class="text-right font-bold mt-2" id="tuition-subtotal">小計: ¥0</div>
        </div>
      `,
    });
  },

  /**
   * セクションヘッダーコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.title - ヘッダータイトル
   * @param {string} [config.symbol='■'] - 先頭記号
   * @param {boolean} [config.asSummary=false] - サマリー表示スタイル
   * @returns {string} HTML文字列
   */
  sectionHeader: ({ title, symbol = '■', asSummary = false }) => {
    const baseClasses = 'text-lg font-bold text-brand-text';

    if (asSummary) {
      // summaryの場合は▶記号のみ使用（二重記号を避ける）
      // スマホユーザー向けに押しやすく、分かりやすいデザイン
      return `<summary class="${baseClasses} flex items-center justify-between hover:bg-ui-hover active:bg-ui-pressed transition-colors">
        <div class="flex items-center">
          <span class="mr-3 text-brand-accent transition-transform">▶</span>
          ${escapeHTML(title)}
        </div>
        <span class="text-xs text-brand-subtle rounded-md bg-ui-surface border border-ui-border p-1">タップで展開</span>
      </summary>`;
    }

    // 通常のh3の場合は指定されたsymbolを使用
    const content = `${escapeHTML(symbol)} ${escapeHTML(title)}`;
    return `<h3 class="${baseClasses} mb-3">${content}</h3>`;
  },

  /**
   * 小計表示セクションコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.title - 小計タイトル
   * @param {number} config.amount - 小計金額
   * @param {string} [config.id=''] - 金額表示要素のID
   * @returns {string} HTML文字列
   */
  subtotalSection: ({ title, amount, id = '' }) => {
    return `<div class="subtotal mt-4 pt-3 border-t border-ui-border text-right">
      <span class="text-lg font-bold text-brand-text">${escapeHTML(title)}: </span>
      <span ${id ? `id="${escapeHTML(id)}"` : ''} class="text-lg font-bold text-brand-text">${Components.priceDisplay({ amount, size: 'large' })}</span>
    </div>`;
  },

  /**
   * 時刻選択用のselect options生成
   * @param {Object} config - 設定オブジェクト
   * @param {string} [config.startTime='09:00'] - 開始時刻
   * @param {string} [config.endTime='17:00'] - 終了時刻
   * @param {number} [config.interval=30] - 間隔（分）
   * @param {string} [config.selectedValue=''] - 選択済みの値
   * @returns {string} HTML文字列
   */
  timeOptions: ({
    startTime = '09:00',
    endTime = '17:00',
    interval = 30,
    selectedValue = '',
  }) => {
    const options = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (
      let minutes = startMinutes;
      minutes <= endMinutes;
      minutes += interval
    ) {
      const hour = Math.floor(minutes / 60);
      const min = minutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const selected = timeString === selectedValue ? 'selected' : '';
      options.push(
        `<option value="${timeString}" ${selected}>${timeString}</option>`,
      );
    }

    return options.join('');
  },

  // =================================================================
  // --- Level 3: 画面セクション（Organisms） ---
  // -----------------------------------------------------------------
  // 複合的なUIセクション（ホーム、予約一覧等）
  // =================================================================

  /**
   * ホームセクション（予約または履歴）
   * @param {DashboardSectionConfig} config - 設定オブジェクト
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
   * @param {ComponentConfig & {action: string}} config - 設定オブジェクト
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
   * @param {ListCardConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  listCard: ({
    item,
    badges = [],
    editButtons = [],
    accountingButtons = [],
    type = 'booking',
    isEditMode = false,
    showMemoSaveButton = true,
  }) => {
    // カード基本スタイル
    const cardColorClass =
      type === 'booking'
        ? `booking-card ${DesignConfig.cards.state.booked.card}`
        : `record-card ${DesignConfig.cards.state.history.card}`;

    // バッジHTML生成
    const badgesHtml = badges
      .map(badge =>
        Components.statusBadge({
          type: /** @type {BadgeType} */ (badge.type),
          text: badge.text,
        }),
      )
      .join('');

    // 編集ボタンHTML生成
    const editButtonsHtml = editButtons
      .map(btn =>
        Components.button({
          action: btn.action,
          text: btn.text,
          style: /** @type {ComponentStyle} */ (btn.style || 'secondary'),
          size: /** @type {ComponentSize} */ (btn.size || 'xs'),
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
          style: /** @type {ComponentStyle} */ (btn.style || 'primary'),
          size: /** @type {ComponentSize} */ ('xs'),
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
      ? ` <span class="time-display">${item.startTime}~${item.endTime}</span>`.trim()
      : '';
    const classroomDisplay = item.classroom ? ` ${item.classroom}` : '';
    const venueDisplay = item.venue ? ` ${item.venue}` : '';

    // 制作メモ表示（予約・履歴共通） - 編集モード対応
    const memoSection = Components.memoSection({
      reservationId: item.reservationId,
      workInProgress: item.workInProgress,
      isEditMode: isEditMode, // パラメータで制御
      showSaveButton: showMemoSaveButton, // 保存ボタン表示制御
    });

    return `
      <div class="w-full mb-4 px-0">
        <div class="${cardColorClass} p-2 rounded-lg shadow-sm" data-reservation-id="${item.reservationId}">
          <!-- 上部：教室情報+会計・編集ボタン -->
          <div class="flex justify-between items-start mb-0">
            <div class="flex-1 min-w-0">
              <div class="flex items-center flex-wrap">
                <h3 class="font-bold text-brand-text">${formatDate(item.date)} <span class="font-normal text-brand-subtle text-sm">${dateTimeDisplay}</span></h3>
              </div>
              <h4 class="text-sm text-brand-text font-bold mt-0">${escapeHTML(classroomDisplay)}${escapeHTML(venueDisplay)} ${badgesHtml}</h4>
            </div>
            ${accountingButtonsHtml || editButtonsHtml ? `<div class="flex-shrink-0 self-start flex gap-1">${accountingButtonsHtml}${editButtonsHtml}</div>` : ''}
          </div>

          ${memoSection}
        </div>
      </div>
    `;
  },

  /**
   * 制作メモセクション（表示・編集両対応）
   * @param {MemoSectionConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  memoSection: ({ reservationId, workInProgress, isEditMode = false, showSaveButton = true }) => {
    if (isEditMode) {
      // 編集モード：textareaと保存ボタン
      return `
        <div class="p-0.5 bg-white/75">
          <h4 class="text-xs font-bold text-brand-subtle mb-0">制作メモ</h4>
          <textarea
            class="memo-edit-textarea ${DesignConfig.inputs.textarea} min-h-14 w-full mt-1 px-1"
            rows="4"
            placeholder="制作内容や進捗をメモしてください"
          >${escapeHTML(workInProgress || '')}</textarea>
        </div>
      `;
    } else {
      // 通常モード：読み取り専用表示
      return `
        <div class="p-0.5 bg-white/75">
          <h4 class="text-xs font-bold text-brand-subtle mb-0">制作メモ</h4>
          <p class="text-sm text-brand-text whitespace-pre-wrap px-1 min-h-14">${escapeHTML(workInProgress)}</p>
        </div>
      `;
    }
  },

  /**
   * 販売セクション
   * @param {Object} config - 設定オブジェクト
   * @param {AccountingMasterData[]} config.master - 会計マスター
   * @param {ReservationData} config.reservationDetails - 予約固有情報
   * @returns {string} HTML文字列
   */
  salesSection: ({ master, reservationDetails }) => {
    const salesItems = Array.isArray(master)
      ? master.filter(
          /** @param {AccountingMasterData} item */
          item =>
            item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
            CONSTANTS.ITEM_TYPES.SALES,
        )
      : [];
    const salesItemsHtml = salesItems
      .map(item => {
        // truthy値でチェック状態を判定（より柔軟）
        const isChecked = !!(
          reservationDetails &&
          reservationDetails[item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]]
        );

        return Components.accountingRow({
          name: item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
          itemType: CONSTANTS.ITEM_TYPES.SALES,
          price: item[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
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
                type: reservationDetails?.materialType0,
                l: reservationDetails?.materialL0,
                w: reservationDetails?.materialW0,
                h: reservationDetails?.materialH0,
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
                  name: reservationDetails?.otherSalesName0,
                  price: reservationDetails?.otherSalesPrice0,
                },
              })}
            </div>
          </div>
          ${Components.button({ action: 'addOtherSalesRow', text: '+ 自由入力欄を追加', style: 'secondary', size: 'full' })}
        </details>
        <div class="text-right font-bold mt-2 text-brand-text" id="sales-subtotal">小計: ¥0</div>
      </div>`;
  },

  /**
   * 右上固定配置のもどるボタンを生成します
   * @param {string} action - アクション名（デフォルト: 'smartGoBack'）
   * @param {string} text - ボタンテキスト（デフォルト: 'もどる'）
   * @returns {string} HTML文字列
   */
  createBackButton: (action = 'smartGoBack', text = 'もどる') => {
    return `
        <div class="back-button-container fixed top-4 right-4 z-30">
          <button
            data-action="${escapeHTML(action)}"
            class="bg-action-secondary-bg text-action-secondary-text active:bg-action-secondary-hover font-bold py-2 px-4 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 mobile-button touch-friendly shadow-lg"
          >
            ${escapeHTML(text)}
          </button>
        </div>`;
  },

  /**
   * 現在のビューに応じて適切なもどるボタンを生成します
   * @param {string} currentView - 現在のビュー名
   * @param {UIState|null} appState - アプリケーション状態
   * @returns {string} HTML文字列
   */
  createSmartBackButton: (currentView, appState = null) => {
    // 現在のビューに応じてアクションとテキストを決定
    let action = 'smartGoBack';
    let text = 'もどる';

    // 特定のビューでの動作をカスタマイズ
    switch (currentView) {
      case 'bookingSuccess':
        action = 'goToMainMenu';
        text = 'メインメニュー';
        break;
      case 'history':
        action = 'goToMainMenu';
        text = 'メインメニュー';
        break;
      default:
        action = 'smartGoBack';
        text = 'もどる';
    }

    return Components.createBackButton(action, text);
  },
};

// =================================================================
// --- Specialized Components ---
// -----------------------------------------------------------------
// 特定用途に特化したコンポーネント
// =================================================================

/**
 * 右上固定配置のもどるボタンを生成します
 * @param {string} action - アクション名（デフォルト: 'smartGoBack'）
 * @param {string} text - ボタンテキスト（デフォルト: 'もどる'）
 * @returns {string} HTML文字列
 */
Components.createBackButton = (action = 'smartGoBack', text = 'もどる') => {
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
 * 現在のビューに応じて適切なもどるボタンを生成します
 * @param {string} currentView - 現在のビュー名
 * @returns {string} HTML文字列
 */
Components.createSmartBackButton = currentView => {
  let action = 'smartGoBack';
  let text = 'もどる';

  // ビューに応じて適切なアクションとテキストを設定
  switch (currentView) {
    case 'login':
      // ログイン画面ではもどるボタンを表示しない
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
      // ダッシュボードではもどるボタンを表示しない
      return '';

    case 'bookingLessons':
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
      // デフォルトはスマートもどる
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

// =================================================================
// --- モーダルコンポーネント ---
// -----------------------------------------------------------------
// 汎用モーダル機能
// =================================================================

// 注意: createBackButton と createSmartBackButton は Components オブジェクト内で定義済み

// グローバルに公開
window.Components = Components;
