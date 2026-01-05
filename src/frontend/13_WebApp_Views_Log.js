/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Log.js
 * 目的: 管理者向けログビューの生成
 * 主な責務:
 *   - ログデータのテーブル表示
 *   - 参加者ビューへの遷移ボタン
 * =================================================================
 */

/** @type {SimpleStateManager} */
const logViewStateManager = appWindow.stateManager;

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp
 * @property {string} userId
 * @property {string} realName
 * @property {string} nickname
 * @property {string} action
 * @property {string} result
 * @property {string} classroom
 * @property {string} reservationId
 * @property {string} date
 * @property {string} message
 * @property {string} details
 */

/**
 * ログビューのメインHTMLを生成
 * @returns {string} HTML文字列
 */
/**
 * ログビューのメインHTMLを生成
 * @returns {string} HTML文字列
 */
export const getLogView = () => {
  const state = logViewStateManager.getState();

  /** @type {LogEntry[]} */
  const logs = state['adminLogs'] || [];
  const isLoading = state['adminLogsLoading'] || false;
  // リフレッシュ中かどうか（バックグラウンド更新）
  const isRefreshing = state['adminLogsRefreshing'] || false;

  // 最後に表示した日時を取得（未読判定用）
  const lastViewedKey = 'YOYAKU_KIROKU_ADMIN_LOG_LAST_VIEWED';
  const lastViewedTimeStr = localStorage.getItem(lastViewedKey);
  const lastViewedTime = lastViewedTimeStr
    ? new Date(lastViewedTimeStr).getTime()
    : 0;

  // 現在時刻を保存
  setTimeout(() => {
    localStorage.setItem(lastViewedKey, new Date().toISOString());
  }, 1000);

  // ヘッダー用カスタムアクションHTML
  const refreshIcon = `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`;

  const headerActions = `
    <div class="flex items-center gap-2">
      ${Components.button({
        action: 'refreshLogView',
        text: refreshIcon,
        style: 'secondary',
        size: 'xs',
        disabled: isRefreshing || isLoading,
      })}
      ${Components.button({
        action: 'backToParticipantsView',
        text: '参加者ビュー',
        style: 'primary',
        size: 'xs',
      })}
    </div>
  `;

  // ローディング状態（初期ロード）
  if (isLoading) {
    return `
      ${Components.pageHeader({
        title: '操作ログ',
        backAction: 'logout',
        customActionHtml: headerActions, // ヘッダーは表示しておく
      })}
      <div class="${DesignConfig.layout.container}">
        <div class="text-center py-12">
          <p class="text-brand-subtle">ログを読み込み中...</p>
        </div>
      </div>
    `;
  }

  // ログがない場合
  if (logs.length === 0) {
    return `
      ${Components.pageHeader({
        title: '操作ログ',
        backAction: 'logout',
        customActionHtml: headerActions,
      })}
      <div class="${DesignConfig.layout.container}">
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          customClass: 'bg-white',
          content: `
            <div class="text-center py-4">
              <p class="${DesignConfig.text.body}">ログがありません</p>
            </div>
          `,
        })}
      </div>
    `;
  }

  // ログテーブルを生成
  const tableHtml = renderLogTable(logs, lastViewedTime);

  return `
    ${Components.pageHeader({
      title: '操作ログ',
      backAction: 'logout',
      customActionHtml: headerActions,
    })}
    <div class="w-full px-4">
      <p class="text-xs text-brand-subtle mb-2 text-right">直近30日分のログ（${logs.length}件）</p>
      <div class="overflow-x-auto pb-8">
        ${tableHtml}
      </div>
    </div>
  `;
};

/**
 * ログテーブルを描画
 * @param {LogEntry[]} logs - ログデータ配列
 * @param {number} lastViewedTime - 最終閲覧時間（ミリ秒）
 * @returns {string} HTML文字列
 */
function renderLogTable(logs, lastViewedTime) {
  // テーブル設定（列定義）
  /** @type {TableColumn[]} */
  const columns = [
    {
      label: '日時',
      key: 'timestamp',
      width: '110px',
      render: (_val, row) => {
        const r = /** @type {LogEntry} */ (row);
        // window.formatDateを使用（HTMLが返る）
        const dateHtml = window.formatDate
          ? window.formatDate(r.timestamp)
          : r.timestamp;
        const d = new Date(r.timestamp);
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        // 未読判定
        const isNew = d.getTime() > lastViewedTime;
        const newBadge = isNew
          ? `<span class="inline-block bg-red-500 text-white text-[9px] px-1 rounded ml-1 align-top">NEW</span>`
          : '';

        return `
          <div class="leading-snug">
            <div class="text-xs">${dateHtml}${newBadge}</div>
            <div class="text-[10px] text-brand-subtle font-mono">${time}</div>
          </div>
        `;
      },
    },
    {
      label: 'ユーザー',
      key: 'userId',
      width: '120px',
      render: (_val, row) => {
        const r = /** @type {LogEntry} */ (row);
        const realName = r.realName || '—';
        const nickname = r.nickname || '—';
        return `
          <div class="leading-snug">
             <div class="text-xs font-bold truncate" title="${escapeHTML(realName)}">${escapeHTML(realName)}</div>
             <div class="text-[10px] text-brand-muted truncate" title="${escapeHTML(nickname)}">${escapeHTML(nickname)}</div>
          </div>
        `;
      },
    },
    {
      label: 'アクション',
      key: 'action',
      width: '90px',
      render: val =>
        `<div class="truncate text-xs font-medium text-brand-text" title="${escapeHTML(/** @type {string} */ (val))}">${escapeHTML(/** @type {string} */ (val))}</div>`,
    },
    {
      label: '結果',
      key: 'result',
      width: '50px',
      render: val => {
        const v = /** @type {string} */ (val);
        const colorClass =
          v === '成功'
            ? 'text-green-600'
            : v === '失敗'
              ? 'text-red-600'
              : 'text-gray-600';
        return `<div class="${colorClass} text-xs font-bold text-center">${escapeHTML(v)}</div>`;
      },
    },
    {
      label: '詳細',
      key: 'details',
      width: '140px',
      render: (val, row) => {
        const r = /** @type {LogEntry} */ (row);
        const classroom = r.classroom ? `教室:${r.classroom}` : '';
        const reservationId = r.reservationId ? `ID:${r.reservationId}` : '';
        const details = /** @type {string} */ (val) || '';

        // 重要な詳細情報をまとめて表示
        let content = '';
        if (classroom)
          content += `<div class="truncate font-medium">${escapeHTML(classroom)}</div>`;
        if (reservationId)
          content += `<div class="truncate text-[10px] text-brand-muted font-mono">${escapeHTML(reservationId)}</div>`;
        if (details) {
          try {
            const parsed = JSON.parse(details);
            if (typeof parsed === 'object' && parsed !== null) {
              content += '<div class="mt-1 space-y-0.5">';
              for (const [k, v] of Object.entries(parsed)) {
                // 値がオブジェクトの場合も文字列化して表示
                const displayVal =
                  typeof v === 'object' ? JSON.stringify(v) : String(v);
                content += `
                  <div class="flex items-baseline text-[9px] leading-tight">
                    <span class="font-mono text-gray-400 w-16 shrink-0 truncate mr-1">${escapeHTML(k)}:</span>
                    <span class="text-gray-600 break-all">${escapeHTML(displayVal)}</span>
                  </div>`;
              }
              content += '</div>';
            } else {
              content += `<div class="truncate text-[10px] text-gray-500" title="${escapeHTML(details)}">${escapeHTML(details)}</div>`;
            }
          } catch (e) {
            content += `<div class="truncate text-[10px] text-gray-500" title="${escapeHTML(details)}">${escapeHTML(details)}</div>`;
          }
        }

        return content || '<span class="text-gray-300">-</span>';
      },
    },
    {
      label: '日程',
      key: 'date',
      width: '90px',
      render: val => {
        const v = /** @type {string} */ (val);
        if (!v) return '<span class="text-gray-300">-</span>';
        const dateHtml = window.formatDate
          ? window.formatDate(v)
          : escapeHTML(v);
        return `<div class="truncate text-xs">${dateHtml}</div>`;
      },
    },
    {
      label: 'メッセージ',
      key: 'message',
      width: '180px',
      render: val =>
        `<div class="text-xs text-gray-500 break-words whitespace-normal line-clamp-2" title="${escapeHTML(/** @type {string} */ (val))}">${escapeHTML(/** @type {string} */ (val) || '—')}</div>`,
    },
  ];

  // Components.table を使用して描画
  return Components.table({
    columns: columns,
    rows: logs,
    striped: false,
    bordered: true,
    hoverable: true,
    compact: true,
    responsive: true,
    minWidth: '',
    emptyMessage: '表示するログがありません',
    headerSize: 'text-xs font-bold bg-brand-light',
    rowBorderClass: 'border-b border-dashed border-ui-border',
  });
}
