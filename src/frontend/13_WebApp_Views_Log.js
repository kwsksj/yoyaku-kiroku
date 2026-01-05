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
export function getLogView() {
  const state = logViewStateManager.getState();
  /** @type {LogEntry[]} */
  const logs = state['adminLogs'] || [];
  const isLoading = state['adminLogsLoading'] || false;

  // 最後に表示した日時を取得（未読判定用）
  const lastViewedKey = 'YOYAKU_KIROKU_ADMIN_LOG_LAST_VIEWED';
  const lastViewedTimeStr = localStorage.getItem(lastViewedKey);
  const lastViewedTime = lastViewedTimeStr
    ? new Date(lastViewedTimeStr).getTime()
    : 0;

  // 現在時刻を保存（次回用に更新）
  // 描画サイクルでのちらつきを防ぐため、少し遅延させるか、このまま保存
  setTimeout(() => {
    localStorage.setItem(lastViewedKey, new Date().toISOString());
  }, 1000);

  // 参加者ビューへ遷移するボタン
  const navigationButtons = `
    <div class="flex gap-2 mb-4">
      ${Components.button({
        text: '参加者ビューへ',
        action: 'goToParticipantsView',
        style: 'secondary',
        size: 'small',
      })}
    </div>
  `;

  // ローディング状態
  if (isLoading) {
    return `
      ${Components.pageHeader({
        title: '操作ログ',
        backAction: 'logout',
      })}
      <div class="${DesignConfig.layout.container}">
        ${navigationButtons}
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
      })}
      <div class="${DesignConfig.layout.container}">
        ${navigationButtons}
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
    })}
    <div class="${DesignConfig.layout.container}">
      ${navigationButtons}
      <p class="text-xs text-brand-subtle mb-2">直近30日分のログ（${logs.length}件）</p>
      <div class="overflow-x-auto -mx-4 px-4">
        ${tableHtml}
      </div>
    </div>
  `;
}

/**
 * 曜日を取得するユーティリティ
 * @param {Date} date
 * @returns {string} (月), (火) etc.
 */
function getDayOfWeek(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `(${days[date.getDay()]})`;
}

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
      label: 'タイムスタンプ',
      key: 'timestamp',
      width: '100px',
      render: (_val, row) => {
        const r = /** @type {LogEntry} */ (row);
        const d = new Date(r.timestamp);
        const date = `${d.getMonth() + 1}/${d.getDate()}${getDayOfWeek(d)}`;
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        // 未読判定（タイムスタンプが最終閲覧時間より新しい場合）
        const isNew = d.getTime() > lastViewedTime;
        const newBadge = isNew
          ? `<span class="inline-block bg-red-500 text-white text-[9px] px-1 rounded ml-1">NEW</span>`
          : '';

        return `
          <div class="text-brand-subtle leading-tight">
            <div class="font-bold flex items-center">${date}${newBadge}</div>
            <div class="text-[11px] font-mono mt-0.5">${time}</div>
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
        // 名前とニックネームを2行で表示
        return `
          <div class="leading-tight">
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
        return `<div class="${colorClass} text-xs font-bold">${escapeHTML(v)}</div>`;
      },
    },
    {
      label: '詳細',
      key: 'details',
      width: '100px',
      render: (val, row) => {
        const r = /** @type {LogEntry} */ (row);
        const classroom = r.classroom ? `教室:${r.classroom}` : '';
        const reservationId = r.reservationId ? `ID:${r.reservationId}` : '';
        const details = /** @type {string} */ (val) || '';

        // 重要な詳細情報をまとめて表示
        let content = '';
        if (classroom)
          content += `<div class="truncate">${escapeHTML(classroom)}</div>`;
        if (reservationId)
          content += `<div class="truncate text-[10px] text-brand-muted">${escapeHTML(reservationId)}</div>`;
        if (details)
          content += `<div class="truncate text-[10px] text-gray-400" title="${escapeHTML(details)}">${escapeHTML(details)}</div>`;

        return content || '<span class="text-gray-300">-</span>';
      },
    },
    {
      label: '教室日程',
      key: 'date',
      width: '80px',
      render: val => {
        const v = /** @type {string} */ (val);
        if (!v) return '<span class="text-gray-300">-</span>';
        // 日付文字列から曜日を追加しようと試みる（形式が YYYY/MM/DD の場合など）
        // ただしログの date カラムの形式が不明確なため、単純な日付パースを試みる
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          return `<div class="truncate text-xs font-medium">${d.getMonth() + 1}/${d.getDate()}${getDayOfWeek(d)}</div>`;
        }
        return `<div class="truncate text-xs">${escapeHTML(v)}</div>`;
      },
    },
    {
      label: 'メッセージ',
      key: 'message',
      width: '160px',
      render: val =>
        `<div class="text-xs text-gray-500 break-words whitespace-normal line-clamp-2" title="${escapeHTML(/** @type {string} */ (val))}">${escapeHTML(/** @type {string} */ (val) || '—')}</div>`,
    },
  ];

  // Components.table を使用して描画
  return Components.table({
    columns: columns,
    rows: logs,
    striped: true, // 縞々も維持しつつボーダーも破線にする
    bordered: true,
    hoverable: true,
    compact: true,
    responsive: true,
    minWidth: '800px',
    emptyMessage: '表示するログがありません',
    headerSize: 'text-xs font-bold bg-brand-light', // ヘッダー文字サイズxsと背景色調整
    rowBorderClass: 'border-b-2 border-dashed border-ui-border', // 行境界：破線、border-2
  });
}
