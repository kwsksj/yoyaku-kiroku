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
  // リフレッシュ中かどうか（統合フラグ使用）
  const isRefreshing =
    state['adminLogsRefreshing'] || state['participantDataRefreshing'] || false;

  // 最後に表示した日時を取得（未読判定用）
  const lastViewedKey = 'YOYAKU_KIROKU_ADMIN_LOG_LAST_VIEWED';
  const lastViewedTimeStr = localStorage.getItem(lastViewedKey);
  const lastViewedTime = lastViewedTimeStr
    ? new Date(lastViewedTimeStr).getTime()
    : 0;

  // ヘッダー用カスタムアクションHTML
  const refreshIcon = `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`;

  const headerActions = `
    <div class="flex items-center gap-2">
      ${Components.button({
        action: 'markAllLogsAsViewed',
        text: 'すべて既読<br>にする',
        style: 'secondary',
        size: 'xs',
      })}
      ${Components.button({
        action: 'refreshLogView',
        text: refreshIcon,
        style: 'secondary',
        size: 'xs',
        disabled: isRefreshing || isLoading,
      })}
      ${Components.button({
        action: 'backToParticipantsView',
        text: '参加者<br>ビュー',
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

  // データ取得日時を表示
  const dataFetchedAt = state['dataFetchedAt'];
  let fetchedAtHtml = '';
  if (dataFetchedAt) {
    const fetchedDate = new Date(dataFetchedAt);
    const dateStr = `${fetchedDate.getMonth() + 1}/${fetchedDate.getDate()}`;
    const timeStr = `${String(fetchedDate.getHours()).padStart(2, '0')}:${String(fetchedDate.getMinutes()).padStart(2, '0')}`;
    fetchedAtHtml = `<span class="text-[10px] text-gray-400 ml-2">最終更新: ${dateStr} ${timeStr}</span>`;
  }

  return `
    ${Components.pageHeader({
      title: '<span class="hidden sm:inline">操作ログ</span>', // ボタン干渉時は非表示（モバイル）
      showBackButton: false,
      customActionHtml: headerActions,
    })}
    <div class="${DesignConfig.layout.containerNoPadding}">
      <p class="text-xs text-brand-subtle mb-2 text-right">直近30日分のログ（${logs.length}件）${fetchedAtHtml}</p>
      <div class="bg-white ${DesignConfig.borderRadius.container}">
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
      label: '更新日時',
      key: 'timestamp',
      width: '40px',
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
          ? `<div class="inline-block bg-red-500 text-white text-[9px] px-1 rounded ml-1 align-top">NEW</div>`
          : '';

        return `
          <div class="leading-snug">
            ${newBadge}
            <div class="text-xs">${dateHtml}</div>
            <div class="text-[10px] text-brand-subtle font-mono">${time}</div>
          </div>
        `;
      },
    },
    {
      label: 'ユーザー',
      key: 'userId',
      width: '60px',
      render: (_val, row) => {
        const r = /** @type {LogEntry} */ (row);
        const realName = r.realName || '—';
        const nickname = r.nickname || '—';
        const studentId = r.userId || '';
        const hasId = studentId && studentId !== '—' && studentId !== 'system';

        if (hasId) {
          return `
            <div class="leading-snug">
               <button
                 class="text-left w-full hover:bg-gray-50 rounded px-1 -mx-1 transition-colors group"
                 onclick="actionHandlers.selectParticipantStudent('${escapeHTML(studentId)}')"
               >
                   <div class="text-xs font-bold text-action-primary group-hover:underline">${escapeHTML(realName)}</div>
                   <div class="text-[10px] text-brand-muted group-hover:text-gray-600">${escapeHTML(nickname)}</div>
               </button>
            </div>
          `;
        }

        return `
          <div class="leading-snug">
             <div class="text-xs font-bold">${escapeHTML(realName)}</div>
             <div class="text-[10px] text-brand-muted">${escapeHTML(nickname)}</div>
          </div>
        `;
      },
    },
    {
      label: 'アクション',
      key: 'action',
      width: '60px',
      align: 'center',
      render: val => {
        const action = /** @type {string} */ (val);
        /** @type {Record<string, {bg: string, text: string}>} */
        const actionStyles = {
          // よやく作成系: 緑
          よやく作成: { bg: 'bg-green-100', text: 'text-green-800' },
          'よやく作成（終了フロー）': {
            bg: 'bg-green-100',
            text: 'text-green-800',
          },
          'よやく作成（よやく日変更）': {
            bg: 'bg-amber-100',
            text: 'text-amber-800',
          },
          '空き通知 登録': { bg: 'bg-green-100', text: 'text-green-800' },
          'よやく確定（空き通知から）': {
            bg: 'bg-green-100',
            text: 'text-green-800',
          },
          // よやくキャンセル系: 赤
          よやくキャンセル: { bg: 'bg-red-100', text: 'text-red-800' },
          'よやくキャンセル（よやく日変更）': {
            bg: 'bg-amber-100',
            text: 'text-amber-800',
          },
          // よやく更新系: 青
          よやく詳細更新: { bg: 'bg-blue-100', text: 'text-blue-800' },
          よやく編集: { bg: 'bg-blue-100', text: 'text-blue-800' },
          セッションノート更新: { bg: 'bg-blue-100', text: 'text-blue-800' },
          'セッションノート更新（終了フロー）': {
            bg: 'bg-blue-100',
            text: 'text-blue-800',
          },
          // 会計系: オレンジ
          会計記録保存: { bg: 'bg-orange-100', text: 'text-orange-800' },
          会計記録修正: { bg: 'bg-orange-100', text: 'text-orange-800' },
          // ユーザー管理系: 紫
          プロフィール更新: { bg: 'bg-blue-100', text: 'text-blue-800' },
          けいかく更新: { bg: 'bg-purple-100', text: 'text-purple-800' },
          'けいかく更新（終了フロー）': {
            bg: 'bg-purple-100',
            text: 'text-purple-800',
          },
          次回目標更新: { bg: 'bg-purple-100', text: 'text-purple-800' },
          新規登録: { bg: 'bg-green-100', text: 'text-green-800' },
          退会: { bg: 'bg-red-100', text: 'text-red-800' },
          // ログイン系: グレー
          ログイン: { bg: 'bg-gray-100', text: 'text-gray-700' },
          ログアウト: { bg: 'bg-gray-100', text: 'text-gray-700' },
          データ再取得: { bg: 'bg-gray-100', text: 'text-gray-700' },
          // コミュニケーション: シアン
          メッセージ送信: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
          空き通知メール送信: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
          // 管理者系: 黄
          管理者トークン発行: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
          管理者トークン検証エラー: { bg: 'bg-red-100', text: 'text-red-800' },
          管理者トークン失効: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
          // システム系: グレー
          売上転載バッチ開始: { bg: 'bg-gray-100', text: 'text-gray-700' },
          売上転載バッチ完了: { bg: 'bg-green-100', text: 'text-green-700' },
          売上転載バッチエラー: { bg: 'bg-red-100', text: 'text-red-800' },
          'バッチ処理: よやくソート成功': {
            bg: 'bg-gray-100',
            text: 'text-gray-700',
          },
          'バッチ処理: よやくソートエラー': {
            bg: 'bg-red-100',
            text: 'text-red-800',
          },
          システムエラー: { bg: 'bg-red-100', text: 'text-red-800' },
        };
        const style = actionStyles[action] || {
          bg: 'bg-gray-50',
          text: 'text-brand-text',
        };

        // テーブルセルのpaddingを打ち消すためにネガティブマージンを使用
        // Components.tableの設定(px-1 py-1)に合わせて調整
        return `<div class="${style.bg} ${style.text} -m-1 p-1 h-full w-full flex items-center justify-center text-xs font-medium break-words whitespace-normal leading-tight text-center min-h-[40px]" title="${escapeHTML(action)}">
          ${escapeHTML(action)}
        </div>`;
      },
    },
    {
      label: '結果',
      key: 'result',
      width: '20px',
      align: 'center',
      render: val => {
        const v = /** @type {string} */ (val);
        const colorClass =
          v === '成功'
            ? 'text-green-600'
            : v === '失敗'
              ? 'text-red-600'
              : 'text-brand-muted';
        return `<div class="${colorClass} text-xs font-bold text-center">${escapeHTML(v)}</div>`;
      },
    },
    {
      label: 'メッセージ',
      key: 'message',
      width: '120px',
      render: val =>
        `<div class="text-xs text-brand-text break-words whitespace-pre-wrap">${escapeHTML(/** @type {string} */ (val) || '—')}</div>`,
    },
    {
      label: '詳細',
      key: 'details',
      width: '160px',
      render: (val, row) => {
        const r = /** @type {LogEntry} */ (row);
        const classroom = r.classroom ? `教室:${r.classroom}` : '';
        const reservationId = r.reservationId ? `ID:${r.reservationId}` : '';
        const dateStr = r.date; // 日程情報
        const details = /** @type {string} */ (val) || '';

        let content = '';

        // 1. 日程情報の表示（最優先）
        if (dateStr) {
          const formattedDate = window.formatDate
            ? window.formatDate(dateStr)
            : dateStr;
          content += `<div class="mb-1 text-xs font-semibold text-brand-text bg-brand-light/50 px-1 py-0.5 rounded inline-block">よやく日: ${formattedDate}</div>`;
        }

        // 2. 教室・予約ID情報
        if (classroom || reservationId) {
          content += `<div class="flex flex-wrap gap-x-2 text-[10px] text-brand-muted mb-1">`;
          if (classroom) content += `<span>${escapeHTML(classroom)}</span>`;
          if (reservationId)
            content += `<span class="font-mono">${escapeHTML(reservationId)}</span>`;
          content += `</div>`;
        }

        // 3. 詳細情報のJSON展開
        if (details) {
          try {
            const parsed = JSON.parse(details);
            if (typeof parsed === 'object' && parsed !== null) {
              content +=
                '<div class="space-y-0.5 border-t border-dashed border-gray-200 pt-1 mt-1">';

              // detailsオブジェクト内の details キーがあればそれを展開、なければトップレベルを展開
              // 構造として { details: { ... } } の場合と、直接 { ... } の場合があるため考慮
              const targetObj =
                parsed.details && typeof parsed.details === 'object'
                  ? parsed.details
                  : parsed;

              for (const [k, v] of Object.entries(targetObj)) {
                // 値がオブジェクトの場合も文字列化して表示
                const displayVal =
                  typeof v === 'object' ? JSON.stringify(v) : String(v);
                content += `
                  <div class="flex items-baseline text-[9px] leading-tight group hover:bg-gray-50 rounded px-0.5 -mx-0.5 transition-colors">
                    <span class="font-bold text-gray-500 w-20 shrink-0 truncate mr-1 text-right select-none">${escapeHTML(k)}</span>
                    <span class="text-gray-700 break-all">${escapeHTML(displayVal)}</span>
                  </div>`;
              }
              content += '</div>';
            } else {
              content += `<div class="truncate text-[10px] text-gray-500 mt-1" title="${escapeHTML(details)}">${escapeHTML(details)}</div>`;
            }
          } catch (_e) {
            content += `<div class="truncate text-[10px] text-gray-500 mt-1" title="${escapeHTML(details)}">${escapeHTML(details)}</div>`;
          }
        }

        return content || '<span class="text-gray-300">-</span>';
      },
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
    fixedLayout: true,
    minWidth: '600px', // スマホで潰れすぎないように最低幅確保
    emptyMessage: '表示するログがありません',
    headerSize: 'text-xs font-bold bg-brand-light',
    rowBorderClass: 'border-b border-dashed border-ui-border',
  });
}
