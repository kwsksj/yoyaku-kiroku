/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Components.js
 * 目的: フロントエンドで再利用可能なUIコンポーネント群を提供する
 * 主な責務:
 *   - 原子的な部品から複合コンポーネントまでのビルディングブロックを定義
 *   - HTML文字列生成とエスケープ処理の統一
 *   - stateManager と連携したモーダル/フォーム操作のユーティリティを提供
 * AI向けメモ:
 *   - 新しいUIパターンは既存の責務レベル（Atomic/Molecular/Organisms）に合わせて追加する
 * =================================================================
 */

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { getTimeOptionsHtml } from './13_WebApp_Views_Utils.js';

const componentsStateManager = appWindow.stateManager;

const resolveComponentsBeginnerMode = () => {
  const getter = /** @type {any} */ (
    componentsStateManager['getEffectiveBeginnerMode']
  );
  if (typeof getter === 'function') {
    return Boolean(getter.call(componentsStateManager));
  }
  return componentsStateManager.getState().isFirstTimeBooking;
};

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
export const escapeHTML = str => {
  if (typeof str !== 'string') {
    return String(str);
  }
  return str.replace(/[&<>"']/g, match => {
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
};

appWindow.escapeHTML = escapeHTML;

// =================================================================
// --- Level 1: 基本要素（Atomic Components） ---
// -----------------------------------------------------------------
// 最小単位のUIコンポーネント。単一責任でパラメータ最小化。
// =================================================================

export const Components = {
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
            <div class="flex justify-between items-center p-4 border-b-2 border-ui-border">
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
    const target = /** @type {HTMLElement | null} */ (event.target);
    const actionElement = target?.closest('button, [data-action]');
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
      primary: DesignConfig.buttons['primary'],
      secondary: DesignConfig.buttons['secondary'],
      attention: DesignConfig.buttons['attention'],
      danger: DesignConfig.buttons['danger'],
      accounting: DesignConfig.buttons['accounting'],
      bookingCard: DesignConfig.buttons['bookingCard'],
      recordCard: DesignConfig.buttons['recordCard'],
      normal: '',
    };

    /** @type {Record<ComponentSize, string>} */
    const sizeClasses = {
      normal: '',
      xs: 'text-xs px-2 py-1',
      small: 'text-sm px-3 py-1.5',
      large: 'text-lg px-4 py-2.5',
      full: DesignConfig.buttons['full'],
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
    description = '',
    caption = '',
  }) => {
    // 電話番号・メールの場合は専用クラスを使用
    const inputClass =
      type === 'tel' || type === 'email'
        ? /** @type {any} */ (DesignConfig.inputs)['phone'] ||
          DesignConfig.inputs['base']
        : DesignConfig.inputs['base'];

    const descriptionHtml = description
      ? `<p class="text-xs text-brand-subtle mb-2">${escapeHTML(description)}</p>`
      : '';

    const captionHtml = caption
      ? `<p class="text-xs text-brand-subtle mt-1">${escapeHTML(caption)}</p>`
      : '';

    return `<div class="mb-4">
        <label
          for="${id}"
          class="${DesignConfig.text['labelBlock']}"
        >${escapeHTML(label)}</label>
        ${descriptionHtml}
        <input
          type="${type}"
          id="${id}"
          value="${escapeHTML(value)}"
          class="${inputClass}"
          placeholder="${escapeHTML(placeholder)}"
          ${required ? 'required' : ''}
          autocomplete="off"
        >
        ${captionHtml}
      </div>`;
  },

  /**
   * シンプル化されたセレクトボックスコンポーネント
   * @param {SelectConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  select: (
    /** @type {SelectConfig} */ {
      id,
      label,
      options,
      selectedValue = '',
      description = '',
      caption = '',
    },
  ) => {
    // options が文字列の場合はそのまま使用（後方互換性）
    // options が配列の場合は option タグを生成
    const optionsHtml =
      typeof options === 'string'
        ? options
        : /** @type {Array<{value?: string; label?: string} | string>} */ (
            options
          )
            .map(
              (
                /** @type {{value?: string; label?: string} | string} */ opt,
              ) => {
                const value = typeof opt === 'string' ? opt : opt.value || '';
                const label =
                  typeof opt === 'string' ? opt : opt.label || opt.value || '';
                return `<option value="${escapeHTML(value)}" ${selectedValue === value ? 'selected' : ''}>${escapeHTML(label)}</option>`;
              },
            )
            .join('');

    const descriptionHtml = description
      ? `<p class="text-xs text-brand-subtle mb-2">${escapeHTML(description)}</p>`
      : '';

    const captionHtml = caption
      ? `<p class="text-xs text-brand-subtle mt-1">${escapeHTML(caption)}</p>`
      : '';

    return `<div class="mb-4">
        <label for="${id}" class="${DesignConfig.text['labelBlock']}">${escapeHTML(label)}</label>
        ${descriptionHtml}
        <select
          id="${id}"
          class="${DesignConfig.inputs['base']}"
        >${optionsHtml}</select>
        ${captionHtml}
      </div>`;
  },

  /**
   * テキストエリアコンポーネント
   * @param {TextareaConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  textarea: ({
    id,
    label,
    value = '',
    placeholder = '',
    rows = 4,
    description = '',
    caption = '',
  }) => {
    const descriptionHtml = description
      ? `<p class="text-xs text-brand-subtle mb-2">${escapeHTML(description)}</p>`
      : '';

    const captionHtml = caption
      ? `<p class="text-xs text-brand-subtle mt-1">${escapeHTML(caption)}</p>`
      : '';

    return `<div class="mb-4">
        <label for="${id}" class="${DesignConfig.text['labelBlock']}">${escapeHTML(label)}</label>
        ${descriptionHtml}
        <textarea
          id="${id}"
          class="${DesignConfig.inputs['textarea']}"
          placeholder="${escapeHTML(placeholder)}"
          rows="${rows}"
        >${escapeHTML(value)}</textarea>
        ${captionHtml}
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
    description = '',
    caption = '',
    onChange = '',
    customLabelClass = '',
    required = false,
    size = 'medium',
  }) => {
    /** @type {Record<'small' | 'medium' | 'large', string>} */
    const checkboxSizeClasses = {
      small: 'h-4 w-4',
      medium: 'h-5 w-5',
      large: 'h-6 w-6',
    };
    const checkboxSizeClass =
      checkboxSizeClasses[/** @type {'small' | 'medium' | 'large'} */ (size)] ||
      checkboxSizeClasses.medium;
    const spacingClass = size === 'large' ? 'space-x-3' : 'space-x-2';
    const labelSizeClass =
      size === 'large' ? 'text-lg' : 'text-base leading-tight';

    // 動的スタイル用のクラス設定
    const labelClass = dynamicStyle
      ? checked
        ? 'font-bold text-brand-text'
        : 'text-brand-muted'
      : DesignConfig.colors['text'];

    // disabledの場合のスタイル調整
    const finalLabelClass = disabled
      ? `${labelClass} opacity-50 cursor-not-allowed`
      : customLabelClass || labelClass;

    // data属性を文字列として生成
    const dataAttributesString = Object.entries(dataAttributes)
      .map(([key, value]) => `data-${key}="${escapeHTML(String(value))}"`)
      .join(' ');

    const descriptionHtml = description
      ? `<p class="text-xs text-brand-subtle mb-2">${escapeHTML(description)}</p>`
      : '';

    const captionHtml = caption
      ? `<p class="text-xs text-brand-subtle mt-1 ml-7">${escapeHTML(caption)}</p>`
      : '';

    const onChangeAttr = onChange ? `onchange="${onChange}"` : '';
    const requiredAttr = required ? 'required' : '';

    return `<div>
        ${descriptionHtml}
        <label class="flex items-start ${spacingClass} ${labelSizeClass} ${finalLabelClass}">
          <input
            type="checkbox"
            id="${id}"
            ${checked ? 'checked' : ''}
            ${disabled ? 'disabled' : ''}
            ${requiredAttr}
            class="${checkboxSizeClass} accent-action-primary-bg mt-0.5"
            ${onChangeAttr}
            ${dynamicStyle ? 'data-dynamic-style="true"' : ''}
            ${dataAttributesString}
          >
          <span>${label}</span>
        </label>
        ${captionHtml}
      </div>`;
  },

  /**
   * トグルスイッチコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.id - スイッチのID
   * @param {string} config.label - ラベルテキスト
   * @param {boolean} [config.checked=false] - チェック状態
   * @param {string} [config.onchange=''] - onchangeイベントハンドラー
   * @param {string} [config.statusText=''] - 状態表示テキスト
   * @param {string} [config.helpAction=''] - ヘルプボタンのアクション
   * @param {string} [config.helpText=''] - ヘルプボタンのテキスト
   * @param {string} [config.className=''] - 追加のクラス名
   * @returns {string} HTML文字列
   */
  toggleSwitch: ({
    id,
    label,
    checked = false,
    onchange = '',
    statusText = '',
    helpAction = '',
    helpText = '',
    className = '',
  }) => {
    const checkedAttr = checked ? 'checked' : '';
    const onchangeAttr = onchange ? `onchange="${escapeHTML(onchange)}"` : '';

    const statusHtml = statusText
      ? `<span class="text-sm text-gray-500 ml-2">${escapeHTML(statusText)}</span>`
      : '';

    const helpHtml =
      helpAction && helpText
        ? `<button
          type="button"
          onclick="${escapeHTML(helpAction)}"
          class="text-xs text-blue-600 hover:underline ml-6 mt-1"
        >${escapeHTML(helpText)}</button>`
        : '';

    return `<div class="p-3 bg-gray-50 rounded-lg ${className}">
      <label class="flex items-center cursor-pointer">
        <div class="relative">
          <input
            type="checkbox"
            id="${escapeHTML(id)}"
            ${checkedAttr}
            ${onchangeAttr}
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
        </div>
        <span class="ml-3 font-medium text-brand-text">${escapeHTML(label)}</span>
        ${statusHtml}
      </label>
      ${helpHtml}
    </div>`;
  },

  /**
   * ボタングループコンポーネント（2択選択）
   * @param {Object} config - 設定オブジェクト
   * @param {Array<{value: string, label: string, onclick: string}>} config.buttons - ボタンの配列（2つ）
   * @param {string} config.selectedValue - 現在選択されている値
   * @param {string} [config.className=''] - 追加のCSSクラス
   * @returns {string} HTML文字列
   */
  buttonGroup: ({ buttons, selectedValue, className = '' }) => {
    if (!Array.isArray(buttons) || buttons.length !== 2) {
      console.error('buttonGroup: buttons must be an array of 2 items');
      return '';
    }

    const buttonHtml = buttons
      .map(btn => {
        const isSelected = btn.value === selectedValue;
        const baseClasses =
          'flex-1 py-2.5 font-base text-center transition-all duration-200';
        const selectedClasses = isSelected
          ? 'bg-action-secondary-bg text-action-secondary-text font-bold'
          : 'bg-white text-brand-muted border-2 border-ui-border-light';

        // 左右のボタンで角丸を調整
        const positionClasses =
          btn === buttons[0] ? 'rounded-l-lg' : 'rounded-r-lg';

        return `<button
          type="button"
          onclick="${escapeHTML(btn.onclick)}"
          class="${baseClasses} ${selectedClasses} ${positionClasses}"
        >${escapeHTML(btn.label)}</button>`;
      })
      .join('');

    return `<div class="flex gap-0 ${className}">${buttonHtml}</div>`;
  },

  /**
   * ラジオボタングループコンポーネント
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.name - ラジオボタングループの名前
   * @param {string} config.label - グループのラベル
   * @param {Array<{value: string, label: string}>} config.options - 選択肢の配列
   * @param {string} [config.selectedValue] - 選択されている値
   * @param {string} [config.layout='vertical'] - レイアウト（vertical/horizontal）
   * @param {string} [config.description=''] - ラベル下の説明文
   * @param {string} [config.caption=''] - 要素下の補足説明
   * @returns {string} HTML文字列
   */
  radioGroup: ({
    name,
    label,
    options,
    selectedValue = '',
    layout = 'vertical',
    description = '',
    caption = '',
  }) => {
    const layoutClass =
      layout === 'horizontal' ? 'flex space-x-4' : 'space-y-2';
    const radioButtons = options
      .map(
        opt => `
        <label class="flex items-center space-x-2 cursor-pointer">
          <input type="radio" name="${escapeHTML(name)}" value="${escapeHTML(opt.value)}"
                 ${selectedValue === opt.value ? 'checked' : ''}
                 class="text-action-primary-bg focus:ring-action-primary-bg">
          <span class="text-brand-text">${escapeHTML(opt.label)}</span>
        </label>
      `,
      )
      .join('');

    const descriptionHtml = description
      ? `<p class="text-xs text-brand-subtle mb-2">${escapeHTML(description)}</p>`
      : '';

    const captionHtml = caption
      ? `<p class="text-xs text-brand-subtle mt-1">${escapeHTML(caption)}</p>`
      : '';

    return `<div class="mb-4">
        <label class="${DesignConfig.text['labelBlock']}">${escapeHTML(label)}</label>
        ${descriptionHtml}
        <div class="${layoutClass}">${radioButtons}</div>
        ${captionHtml}
      </div>`;
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
      : 'rounded-lg border-2';

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
      attention: 'bg-action-attention-bg text-action-attention-text',
      accounting: 'bg-action-attention-bg text-action-attention-text',
    };

    return `<span class="inline-block px-1 py-0.5 text-sm font-bold rounded ${typeClasses[type] || typeClasses.info}">${escapeHTML(text)}</span>`;
  },

  /**
   * テーブル形式リストコンポーネント
   * @param {TableConfig} config - 設定オブジェクト
   * @returns {string} HTML文字列
   */
  table: ({
    columns,
    rows,
    striped = true,
    bordered = true,
    hoverable = true,
    compact = false,
    responsive = true,
    emptyMessage = 'データがありません',
    minWidth = '',
  }) => {
    if (!columns || columns.length === 0) {
      console.error('table: columns must be provided');
      return '';
    }

    // ヘッダー生成
    const headerHtml = /** @type {TableColumn[]} */ (columns)
      .map(col => {
        const align = col.align || 'left';
        /** @type {Record<string, string>} */
        const alignClasses = {
          left: 'text-left',
          center: 'text-center',
          right: 'text-right',
        };
        const alignClass = alignClasses[align] || alignClasses['left'];
        const widthStyle = col.width
          ? `style="width: ${escapeHTML(col.width)}"`
          : '';
        return `<th class="px-1 py-0.5 font-bold text-brand-text border-b-2 border-ui-border ${alignClass}" ${widthStyle}>${escapeHTML(col.label)}</th>`;
      })
      .join('');

    // データ行生成
    const rowsHtml =
      rows && rows.length > 0
        ? /** @type {Record<string, any>[]} */ (rows)
            .map(row => {
              const cellsHtml = /** @type {TableColumn[]} */ (columns)
                .map(col => {
                  const value = row[col.key] || '';
                  const align = col.align || 'left';
                  /** @type {Record<string, string>} */
                  const alignClasses = {
                    left: 'text-left',
                    center: 'text-center',
                    right: 'text-right',
                  };
                  const alignClass =
                    alignClasses[align] || alignClasses['left'];

                  // カスタムレンダラーがある場合はそれを使用
                  const content = col.render
                    ? col.render(value, row)
                    : escapeHTML(String(value));

                  const widthStyle = col.width
                    ? `style="width: ${escapeHTML(col.width)}"`
                    : '';
                  return `<td class="px-0.5 py-0.5 ${bordered ? 'border-b border-ui-border-light' : ''} ${alignClass}" ${widthStyle}>${content}</td>`;
                })
                .join('');

              return `<tr class="${hoverable ? 'hover:bg-gray-50' : ''}">${cellsHtml}</tr>`;
            })
            .join('')
        : `<tr><td colspan="${columns.length}" class="px-2 py-2 text-center text-brand-muted">${escapeHTML(emptyMessage)}</td></tr>`;

    // スタイルクラス
    const tableClasses = [
      'w-full',
      compact ? 'text-sm' : 'text-base',
      striped ? '[&_tbody_tr:nth-child(odd)]:bg-gray-50' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const containerClass = [
      bordered ? 'border-2 border-ui-border' : '',
      responsive ? 'overflow-x-auto rounded-lg' : 'rounded-lg',
    ]
      .filter(Boolean)
      .join(' ');

    const tableStyle = minWidth
      ? `style="min-width: ${escapeHTML(minWidth)}"`
      : '';

    return `
      <div class="${containerClass}">
        <table class="${tableClasses}" ${tableStyle}>
          <thead class="bg-ui-surface">
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
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
      default: 'text-brand-text font-normal',
      light: 'text-brand-subtle font-thin',
      muted: 'text-brand-muted font-thin',
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
    const buttons = /** @type {ButtonConfig[]} */ (
      [secondaryButton, primaryButton, dangerButton].filter(Boolean)
    ).map(btn =>
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
   * ページヘッダー（タイトル + もどるボタン + オプションアクションボタン）
   * @param {Object} config - 設定オブジェクト
   * @param {string} config.title - ページタイトル
   * @param {string} [config.backAction='smartGoBack'] - もどるボタンのアクション
   * @param {boolean} [config.showBackButton=true] - もどるボタンを表示するか
   * @param {{text: string, action: string, style?: string, size?: string} | null} [config.actionButton=null] - オプションのアクションボタン設定
   * @returns {string} HTML文字列
   */
  pageHeader: ({
    title,
    backAction = 'smartGoBack',
    showBackButton = true,
    actionButton = null,
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

    const actionButtonHtml = actionButton
      ? Components.button({
          action: actionButton.action,
          text: actionButton.text,
          style: /** @type {ComponentStyle} */ (
            actionButton.style || 'primary'
          ),
          size: /** @type {ComponentSize} */ (actionButton.size || 'xs'),
          customClass: 'ml-2',
        })
      : '';

    return `
      <div class="sticky top-0 bg-white border-b-2 border-ui-border z-10 py-3 mb-4 -mx-4">
        <div class="flex justify-between items-center px-4">
          <h1 class="text-lg font-bold text-brand-text flex-1">${escapeHTML(title)}</h1>
          <div class="flex items-center gap-2">
            ${actionButtonHtml}
            ${backButtonHtml}
          </div>
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
      const master = appWindow.stateManager?.getState?.()?.accountingMaster;
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
      } else {
        console.warn(
          '⚠️ 会計マスタデータが利用できません。材料リストが表示されません。',
        );
      }
    } catch (error) {
      console.error('❌ 材料オプション生成エラー:', error.message);
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
   * @param {AccountingMasterItemCore[]} config.master - 会計マスター
   * @param {ReservationCore} config.reservation - 予約データ
   * @param {ReservationCore} config.reservationDetails - 予約固有情報
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
    // isFirstTimeBooking をcomponentsStateManagerから取得
    const isFirstTimeBooking = resolveComponentsBeginnerMode();

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
          /** @param {AccountingMasterItemCore} item */
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
        /** @param {AccountingMasterItemCore} item */ item => {
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
        <span class="text-xs text-brand-subtle rounded-md bg-ui-surface border-2 border-ui-border p-1">タップで展開</span>
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
          <div class="bg-ui-surface border-2 border-ui-border p-3 rounded-lg space-y-3">
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
          style: /** @type {ComponentStyle} */ (
            btn.style || (type === 'booking' ? 'bookingCard' : 'recordCard')
          ),
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
          style: /** @type {ComponentStyle} */ (
            btn.style || (type === 'accounting' ? 'accounting' : 'normal')
          ),
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
      workInProgress: item.workInProgress || '',
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
                <h3 class="font-bold text-base text-brand-text">${formatDate(item.date)} <span class="font-normal text-base text-brand-subtle">${dateTimeDisplay}</span></h3>
              </div>
              <h4 class="text-base text-brand-text font-bold mt-0">${escapeHTML(classroomDisplay)}${escapeHTML(venueDisplay)} ${badgesHtml}</h4>
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
  memoSection: ({
    reservationId,
    workInProgress,
    isEditMode = false,
    showSaveButton = true,
  }) => {
    if (isEditMode) {
      // 編集モード：textareaと保存ボタン
      const textareaId = `memo-edit-textarea-${reservationId}`;
      const saveButtonHtml = showSaveButton
        ? `<div class="flex justify-end mt-2">
            ${Components.button({
              action: 'saveMemo',
              text: 'メモを保存',
              style: 'primary',
              size: 'small',
              dataAttributes: {
                reservationId,
              },
            })}
          </div>`
        : '';
      return `
        <div class="p-0.5 bg-white/75">
          <h4 class="text-xs font-bold text-brand-subtle mb-0">制作メモ</h4>
          <textarea
            id="${textareaId}"
            class="memo-edit-textarea ${DesignConfig.inputs.textarea} min-h-14 w-full mt-1 px-1"
            rows="4"
            placeholder="制作内容や進捗をメモしてね"
            data-reservation-id="${reservationId}"
          >${escapeHTML(workInProgress || '')}</textarea>
          ${saveButtonHtml}
        </div>
      `;
    } else {
      // 通常モード：読み取り専用表示
      return `
        <div class="p-0.5 bg-white/75">
          <h4 class="text-xs font-bold text-brand-subtle mb-0">制作メモ</h4>
          <p class="text-sm text-brand-text whitespace-pre-wrap px-1 min-h-14">${escapeHTML(workInProgress || '')}</p>
        </div>
      `;
    }
  },

  /**
   * 販売セクション
   * @param {Object} config - 設定オブジェクト
   * @param {AccountingMasterItemCore[]} config.master - 会計マスター
   * @param {ReservationCore} config.reservationDetails - 予約固有情報
   * @returns {string} HTML文字列
   */
  salesSection: ({ master, reservationDetails }) => {
    const toStringOrEmpty = (/** @type {unknown} */ value) =>
      value === null || value === undefined ? '' : String(value);

    const salesItems = Array.isArray(master)
      ? master.filter(
          /** @param {AccountingMasterItemCore} item */
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

    return `<div class="p-4 bg-ui-surface border-2 border-ui-border rounded-lg">
        <h3 class="text-xl font-bold mb-3 text-left text-brand-text">販売</h3>
        <div class="mb-3 space-y-4">
          <label class="block text-brand-text text-base font-bold">材料代</label>
          <div id="materials-container">
            ${Components.materialRow({
              index: 0,
              values: {
                type: toStringOrEmpty(reservationDetails?.['materialType0']),
                l: toStringOrEmpty(reservationDetails?.['materialL0']),
                w: toStringOrEmpty(reservationDetails?.['materialW0']),
                h: toStringOrEmpty(reservationDetails?.['materialH0']),
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
                  name: toStringOrEmpty(
                    reservationDetails?.['otherSalesName0'],
                  ),
                  price: toStringOrEmpty(
                    reservationDetails?.['otherSalesPrice0'],
                  ),
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
   * @param {UIState|null} _appState - アプリケーション状態
   * @returns {string} HTML文字列
   */
  createSmartBackButton: (currentView, _appState = null) => {
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

  // =================================================================
  // --- Participants View Components ---
  // -----------------------------------------------------------------
  // 参加者ビュー専用の再利用可能コンポーネント
  // =================================================================

  /**
   * @typedef {object} BadgeConfig
   * @property {string} text - バッジテキスト
   * @property {'gray'|'blue'|'green'|'red'|'orange'|'purple'|'yellow'} [color='gray'] - 色
   * @property {'xs'|'sm'|'md'} [size='sm'] - サイズ
   * @property {boolean} [border=false] - 枠線を表示するか
   */

  /**
   * 汎用バッジコンポーネント
   * @param {BadgeConfig} config
   * @returns {string} HTML文字列
   */
  badge: ({ text, color = 'gray', size = 'sm', border = false }) => {
    /** @type {Record<string, string>} */
    const colorClasses = {
      gray: 'bg-gray-100 text-gray-700',
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      orange: 'bg-orange-100 text-orange-700',
      purple: 'bg-purple-100 text-purple-700',
      yellow: 'bg-yellow-100 text-yellow-800',
    };

    /** @type {Record<string, string>} */
    const borderClasses = {
      gray: 'border-gray-300',
      blue: 'border-blue-300',
      green: 'border-green-300',
      red: 'border-red-300',
      orange: 'border-orange-300',
      purple: 'border-purple-300',
      yellow: 'border-yellow-300',
    };

    /** @type {Record<string, string>} */
    const sizeClasses = {
      xs: 'text-xs px-0.5 py-0',
      sm: 'text-sm px-1 py-0.5',
      md: 'text-base px-1.5 py-1',
    };

    const colorClass = colorClasses[color] || colorClasses['gray'];
    const sizeClass = sizeClasses[size] || sizeClasses['sm'];
    const borderClass = border
      ? `border-2 ${borderClasses[color] || 'border-gray-300'}`
      : '';

    return `<span class="font-medium rounded ${sizeClass} ${colorClass} ${borderClass}">${escapeHTML(text)}</span>`;
  },

  /**
   * タブナビゲーショングループ
   * @param {Object} config
   * @param {Array<{label: string, count: number, isActive: boolean, onclick: string}>} config.tabs - タブ配列
   * @returns {string} HTML文字列
   */
  tabGroup: ({ tabs }) => {
    const tabsHtml = tabs
      .map(tab => {
        const activeClass = tab.isActive
          ? 'border-ui-border text-brand-text font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700';
        const count =
          typeof tab.count === 'number' && tab.count > 0
            ? ` (${tab.count})`
            : '';
        return `<button
          class="pb-0.5 px-1 text-xs border-b-4 transition-colors ${activeClass}"
          onclick="${escapeHTML(tab.onclick)}"
        >
          ${escapeHTML(tab.label)}${count}
        </button>`;
      })
      .join('');

    return `<div class="mb-2 border-b-2 border-brand-accent-border">
      <div class="flex space-x-3">
        ${tabsHtml}
      </div>
    </div>`;
  },

  /**
   * フィルターチップボタングループ
   * @param {Object} config
   * @param {Array<{value: string, label: string}>} config.options - オプション配列
   * @param {string} config.selectedValue - 選択中の値
   * @param {string} config.onClickHandler - クリックハンドラー名（例: 'filterByClassroom'）
   * @returns {string} HTML文字列
   */
  filterChips: ({ options, selectedValue, onClickHandler }) => {
    const chipsHtml = options
      .map(option => {
        const isSelected = option.value === selectedValue;
        const buttonClass = isSelected
          ? 'bg-action-primary-bg text-action-primary-text border-ui-border'
          : 'bg-white text-ui-text border-ui-border hover:bg-gray-50';
        return `<button
          class="px-2 py-0.5 text-xs font-medium border-2 rounded ${buttonClass}"
          onclick="actionHandlers.${onClickHandler}('${escapeHTML(option.value)}')"
        >${escapeHTML(option.label)}</button>`;
      })
      .join('');

    return `<div class="mb-1 flex gap-1 flex-wrap">${chipsHtml}</div>`;
  },

  /**
   * 空状態メッセージ
   * @param {Object} config
   * @param {string} config.message - メッセージ
   * @param {string} [config.icon] - アイコン（絵文字またはSVG）
   * @param {{text: string, onClick: string, style?: string}} [config.actionButton] - アクションボタン設定
   * @returns {string} HTML文字列
   */
  emptyState: ({ message, icon, actionButton }) => {
    const iconHtml = icon ? `<div class="text-4xl mb-2">${icon}</div>` : '';
    const buttonHtml = actionButton
      ? Components.button({
          text: actionButton.text,
          onClick: actionButton.onClick,
          style: /** @type {ComponentStyle} */ (
            actionButton.style || 'secondary'
          ),
        })
      : '';

    return `<div class="bg-white border-2 border-ui-border rounded-lg p-2">
      <div class="text-xs text-gray-500 text-center">
        ${iconHtml}
        <p>${escapeHTML(message)}</p>
        ${buttonHtml}
      </div>
    </div>`;
  },

  /**
   * アコーディオンアイテム
   * @param {Object} config
   * @param {string} config.id - 一意なID
   * @param {string} config.headerContent - ヘッダー内容（HTML）
   * @param {string} config.bodyContent - ボディ内容（HTML）
   * @param {string} config.toggleHandler - トグルハンドラー名
   * @param {string} [config.borderColor='border-gray-300'] - ボーダー色クラス
   * @param {string} [config.bgColor='bg-white'] - 背景色クラス
   * @param {boolean} [config.isExpanded=false] - 初期展開状態
   * @returns {string} HTML文字列
   */
  accordionItem: ({
    id,
    headerContent,
    bodyContent,
    toggleHandler,
    borderColor = 'border-gray-300',
    bgColor = 'bg-white',
    isExpanded = false,
  }) => {
    const expandedClass = isExpanded ? '' : 'hidden';
    const arrowClass = isExpanded ? 'rotate-180' : '';

    return `<div class="mb-0.5" data-lesson-container="${escapeHTML(id)}">
      <div class="${bgColor} border-2 ${borderColor} rounded-lg overflow-hidden">
        <button
          class="p-1 w-full hover:opacity-100"
          onclick="actionHandlers.${toggleHandler}('${escapeHTML(id)}')"
          data-lesson-id="${escapeHTML(id)}"
        >
          <div class="flex items-center justify-between">
            ${headerContent}
            <svg class="w-4 h-4 transition-transform ${arrowClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </button>
        <div class="accordion-content participants-table-body bg-transparent ${expandedClass} overflow-x-auto" data-lesson-id="${escapeHTML(id)}">
          ${bodyContent}
        </div>
      </div>
    </div>`;
  },

  /**
   * 固定ヘッダーテーブル
   * @param {Object} config
   * @param {string} config.headerId - ヘッダー要素のID
   * @param {Array<{label: string, width?: string, align?: string}>} config.columns - カラム定義
   * @param {string} config.gridTemplate - grid-template-columnsの値
   * @returns {string} HTML文字列
   */
  stickyTableHeader: ({ headerId, columns, gridTemplate }) => {
    const columnsHtml = columns
      .map(col => {
        const alignClass =
          col.align === 'center'
            ? 'text-center'
            : col.align === 'right'
              ? 'text-right'
              : '';
        return `<div class="${alignClass} py-0.5">${escapeHTML(col.label)}</div>`;
      })
      .join('');

    return `<div class="bg-ui-surface border-2 border-ui-border rounded-lg sticky top-16 z-[5] mb-1 participants-table-sticky-header">
      <div id="${escapeHTML(headerId)}" class="overflow-x-auto scrollbar-hide">
        <div class="grid gap-1 text-xs font-medium text-gray-600" style="grid-template-columns: ${gridTemplate}; min-width: 1200px;height: 1rem;">
          ${columnsHtml}
        </div>
      </div>
    </div>`;
  },

  /**
   * グリッド行
   * @param {Object} config
   * @param {Array<{content: string, width?: string, align?: string, className?: string}>} config.columns - カラムデータ
   * @param {string} config.gridTemplate - grid-template-columnsの値
   * @param {string} [config.rowClassName=''] - 行に追加するクラス
   * @param {string} [config.onClick] - クリックハンドラー
   * @param {string} [config.rowHeight] - 行の高さ（CSSの値）
   * @returns {string} HTML文字列
   */
  gridRow: ({
    columns,
    gridTemplate,
    rowClassName = '',
    onClick,
    rowHeight,
  }) => {
    const columnsHtml = columns
      .map(col => {
        const alignClass =
          col.align === 'center'
            ? 'text-center'
            : col.align === 'right'
              ? 'text-right'
              : '';
        const customClass = col.className || '';
        return `<div class="overflow-hidden ${alignClass} ${customClass}">${col.content}</div>`;
      })
      .join('');

    const clickAttr = onClick ? `onclick="${escapeHTML(onClick)}"` : '';
    const heightStyle = rowHeight ? `height: ${rowHeight};` : '';

    return `<div
      class="grid gap-1 border-t border-dashed border-gray-200 hover:bg-gray-50 ${rowClassName}"
      style="grid-template-columns: ${gridTemplate}; min-width: 1200px; ${heightStyle}"
      ${clickAttr}
    >
      ${columnsHtml}
    </div>`;
  },

  /**
   * 詳細行（ラベル・値のペア）
   * @param {Object} config
   * @param {string} config.label - ラベル
   * @param {string} config.value - 値
   * @param {string} [config.className=''] - 追加クラス
   * @returns {string} HTML文字列
   */
  detailRow: ({ label, value, className = '' }) => {
    if (!value) return '';
    return `<div class="${className}"><span class="font-bold">${escapeHTML(label)}:</span> ${escapeHTML(value)}</div>`;
  },

  /**
   * 履歴アイテム
   * @param {Object} config
   * @param {string} config.date - 日付（フォーマット済み）
   * @param {string} config.title - タイトル
   * @param {string} [config.subtitle] - サブタイトル
   * @param {string} [config.content] - 内容
   * @returns {string} HTML文字列
   */
  historyItem: ({ date, title, subtitle, content }) => {
    const subtitleHtml = subtitle
      ? `<div class="text-sm text-gray-600">${escapeHTML(subtitle)}</div>`
      : '';
    const contentHtml = content
      ? `<div class="text-sm mt-1">${escapeHTML(content)}</div>`
      : '';

    return `<div class="border-b border-gray-200 py-3">
      <div class="font-bold">${escapeHTML(date)} - ${escapeHTML(title)}</div>
      ${subtitleHtml}
      ${contentHtml}
    </div>`;
  },
};

// =================================================================
// --- Specialized Components ---
// -----------------------------------------------------------------
// 特定用途に特化したコンポーネント
// =================================================================


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
appWindow.Components = Components;
