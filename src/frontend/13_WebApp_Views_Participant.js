/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Participant.js
 * 目的: 参加者リスト画面のビュー生成
 * 主な責務:
 *   - レッスン選択画面のレンダリング
 *   - 参加者リスト画面のレンダリング
 *   - 生徒詳細画面のレンダリング
 * =================================================================
 */

/** @type {SimpleStateManager} */
const participantStateManager = appWindow.stateManager;

/** @typedef {import('../../types/core/lesson').LessonCore} LessonCore */

// Note: 教室の色はDesignConfigで一元管理
// getClassroomColorClass関数を使用して取得する

/**
 * @typedef {Object} ParticipantColumnConfig
 * @property {string} key - データのキー
 * @property {string} label - 列のラベル
 * @property {string} width - 列の幅（CSS grid用）
 * @property {string} [align] - テキスト配置（center, left, right）
 * @property {boolean} [adminOnly] - 管理者のみ表示
 * @property {boolean} [pastOnly] - 過去表示のみ
 * @property {boolean} [futureOnly] - 未来表示のみ
 * @property {(row: any) => string} [render] - カスタムレンダリング関数
 */

/**
 * 参加者テーブルの列定義
 * @type {ParticipantColumnConfig[]}
 */
const PARTICIPANT_TABLE_COLUMNS = [
  {
    key: 'participant',
    label: 'なまえ',
    width: '80px',
    align: 'center',
    adminOnly: false,
    render: /** @param {any} row */ row => {
      const isAdmin =
        participantStateManager.getState().participantIsAdmin || false;
      let displayName = row.nickname || row.displayName || '名前なし';
      const hasRealName = row.realName && row.realName.trim() !== '';

      // 管理者でない、かつ表示名が本名と同じ場合は、表示名を最初の2文字にする
      if (!isAdmin && hasRealName && displayName === row.realName) {
        displayName = displayName.substring(0, 2);
      }

      // バッジを生成
      const badges = [];
      if (row._pending) {
        badges.push(Components.badge({ text: '未', color: 'red', size: 'xs' }));
      }
      if (row.status === CONSTANTS.STATUS.WAITLISTED) {
        badges.push(
          Components.badge({ text: '待', color: 'yellow', size: 'xs' }),
        );
      }
      if (row.firstLecture) {
        badges.push(
          Components.badge({ text: '初', color: 'green', size: 'xs' }),
        );
      } else if (row.participationCount) {
        badges.push(
          Components.badge({
            text: `${row.participationCount}`,
            color: 'blue',
            size: 'xs',
          }),
        );
      }
      if (row.chiselRental) {
        badges.push(
          Components.badge({ text: '刀', color: 'orange', size: 'xs' }),
        );
      }

      const badgesHtml = badges.length > 0 ? badges.join(' ') : '';

      // レッスンIDがあれば渡す（プリロード用）
      const lessonIdArg = row.lessonId ? `, '${escapeHTML(row.lessonId)}'` : '';

      return `
        <div>
          <div class="text-xs" align="center">
            <button
              class="text-action-primary font-bold text-center hover:opacity-80 hover:underline"
              onclick="actionHandlers.selectParticipantStudent('${escapeHTML(row.studentId)}'${lessonIdArg})"
            >
              ${escapeHTML(displayName)}
            </button>
          </div>
          ${isAdmin && hasRealName ? `<div class="text-xs text-gray-400 text-center">${escapeHTML(row.realName)}</div>` : ''}
          <div class="pl-2 gap-0.5 text-[13px] font-light">
            ${badgesHtml}
          </div>
        </div>
      `;
    },
  },
  {
    key: 'time',
    label: 'じかん',
    width: '60px',
    align: 'center',
    adminOnly: false,
    render: /** @param {any} row */ row => {
      const startTime = row.startTime || '—';
      const endTime = row.endTime || '—';
      return `
        <div class="text-xs font-light">
          <div class="text-left"> ${escapeHTML(startTime)}</div>
          <div class="text-right">-${escapeHTML(endTime)} </div>
        </div>
      `;
    },
  },
  {
    key: 'sessionNote',
    label: 'ノート',
    width: '160px',
    align: 'left',
    adminOnly: false,
    pastOnly: true, // 過去表示のみ（未来では非表示）
    render: /** @param {any} row */ row =>
      `<div class="text-xs ${row.sessionNote ? '' : 'text-gray-400 italic'}">${escapeHTML(row.sessionNote || '—')}</div>`,
  },
  {
    key: 'nextLessonGoal',
    label: 'けいかく・もくひょう',
    width: '160px',
    align: 'left',
    adminOnly: false,
    futureOnly: true, // 未来表示のみ（過去では非表示）
    render: /** @param {any} row */ row =>
      `<div class="text-xs ${row.nextLessonGoal ? '' : 'text-gray-400 italic'}">${escapeHTML(row.nextLessonGoal || '—')}</div>`,
  },
  {
    key: 'order',
    label: 'ちゅうもん',
    width: '120px',
    align: 'left',
    adminOnly: false,
    render: /** @param {any} row */ row =>
      `<div class="text-xs ${row.order ? '' : 'text-gray-400 italic'}">${escapeHTML(row.order || '—')}</div>`,
  },
  {
    key: 'messageToTeacher',
    label: 'メッセージ',
    width: '160px',
    adminOnly: true,
    render: /** @param {any} row */ row =>
      `<div class="text-xs break-words" title="${escapeHTML(row.messageToTeacher || '—')}">${escapeHTML(row.messageToTeacher || '—')}</div>`,
  },
  {
    key: 'ageGroup',
    label: '*年代*',
    width: '40px',
    align: 'center',
    adminOnly: true,
    render: /** @param {any} row */ row =>
      `<div class="text-xs text-center">${escapeHTML(row.ageGroup || '—')}</div>`,
  },
  {
    key: 'gender',
    label: '*性別*',
    width: '40px',
    align: 'center',
    adminOnly: true,
    render: /** @param {any} row */ row =>
      `<div class="text-xs text-center">${escapeHTML(row.gender || '—')}</div>`,
  },
  {
    key: 'address',
    label: '*住所*',
    width: '40px',
    adminOnly: true,
    render: /** @param {any} row */ row =>
      `<div class="text-xs break-words" title="${escapeHTML(row.address || '—')}">${escapeHTML(row.address || '—')}</div>`,
  },
  {
    key: 'futureCreations',
    label: '将来制作したいもの',
    width: '160px',
    adminOnly: false,
    render: /** @param {any} row */ row =>
      `<div class="text-xs break-words" title="${escapeHTML(row.futureCreations || '—')}">${escapeHTML(row.futureCreations || '—')}</div>`,
  },
  {
    key: 'companion',
    label: '同行者',
    width: '40px',
    adminOnly: false,
    render: /** @param {any} row */ row =>
      `<div class="text-xs break-words" title="${escapeHTML(row.companion || '—')}">${escapeHTML(row.companion || '—')}</div>`,
  },
  {
    key: 'transportation',
    label: '来場手段',
    width: '40px',
    adminOnly: false,
    render: /** @param {any} row */ row =>
      `<div class="text-xs break-words" title="${escapeHTML(row.transportation || '—')}">${escapeHTML(row.transportation || '—')}</div>`,
  },
  {
    key: 'pickup',
    label: '送迎',
    width: '40px',
    align: 'center',
    adminOnly: false,
    render: /** @param {any} row */ row =>
      `<div class="text-xs text-center">${escapeHTML(row.pickup || '—')}</div>`,
  },
  {
    key: 'car',
    label: '車',
    width: '40px',
    align: 'center',
    adminOnly: false,
    render: /** @param {any} row */ row =>
      `<div class="text-xs text-center">${escapeHTML(row.car || '—')}</div>`,
  },
  {
    key: 'notes',
    label: '*備考*',
    width: '160px',
    adminOnly: true,
    render: /** @param {any} row */ row =>
      `<div class="text-xs break-words" title="${escapeHTML(row.notes || '—')}">${escapeHTML(row.notes || '—')}</div>`,
  },
  {
    key: 'action',
    label: 'アクション',
    width: '110px',
    align: 'center',
    adminOnly: true,
    render: /** @param {any} row */ row => {
      if (row.status !== CONSTANTS.STATUS.CONFIRMED) {
        return '';
      }
      return `
        <button
          class="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 font-bold"
          data-action="startSessionConclusion"
          data-reservation-id="${escapeHTML(row.reservationId)}"
        >
          まとめ
        </button>
      `;
    },
  },
];

/**
 * 教室の色オブジェクトを取得（DesignConfigから）
 * @param {string} classroom - 教室名
 * @returns {{bg: string, border: string, text: string, badge: string}} 色定義オブジェクト
 */
function getClassroomColor(classroom) {
  /** @type {Record<string, string>} */
  const classroomKeyMap = {
    東京教室: 'tokyo',
    沼津教室: 'numazu',
    つくば教室: 'tsukuba',
  };

  /** @type {any} */
  const classroomConfig = DesignConfig.classroomColors || {};
  const key = classroomKeyMap[classroom] || 'default';
  const config = classroomConfig[key] || classroomConfig['default'] || {};

  // colorClassからbg, border, textを抽出
  const colorClass = config.colorClass || '';
  /** @type {string[]} */
  const classes = colorClass.split(' ');
  const bg =
    classes.find((/** @type {string} */ c) => c.startsWith('bg-')) ||
    'bg-gray-50';
  const border =
    classes.find((/** @type {string} */ c) => c.startsWith('border-')) ||
    'border-gray-300';
  const text =
    classes.find((/** @type {string} */ c) => c.startsWith('text-')) ||
    'text-gray-700';
  const badge =
    config.badgeClass || 'bg-gray-100 text-gray-600 border border-gray-300';

  return { bg, border, text, badge };
}

/**
 * 会場の色オブジェクトを取得（DesignConfigから）
 * @param {string} venue - 会場名
 * @returns {{colorClass: string, badgeClass: string}} 色定義オブジェクト
 */
function getVenueColor(venue) {
  /** @type {any} */
  const venueConfig = DesignConfig.venueColors || {};
  const config = venueConfig[venue] || venueConfig['default'] || {};

  return {
    colorClass: config.colorClass || 'bg-gray-50 border-gray-200 text-gray-600',
    badgeClass:
      config.badgeClass || 'bg-gray-100 text-gray-600 border border-gray-300',
  };
}

/**
 * 日付値をローカル日付の YYYY-MM-DD に正規化します。
 * 文字列の区切り揺れ（`/`, `.`）や Date オブジェクトも許容します。
 * @param {string | Date | null | undefined} dateValue
 * @returns {string}
 */
function normalizeLocalYmd(dateValue) {
  if (!dateValue) return '';

  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const slashOrDotMatch = trimmed.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
    if (slashOrDotMatch) {
      return `${slashOrDotMatch[1]}-${String(Number(slashOrDotMatch[2])).padStart(2, '0')}-${String(Number(slashOrDotMatch[3])).padStart(2, '0')}`;
    }
  }

  const parsedDate =
    dateValue instanceof Date
      ? new Date(dateValue.getTime())
      : new Date(String(dateValue));
  if (Number.isNaN(parsedDate.getTime())) return '';

  const y = parsedDate.getFullYear();
  const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const d = String(parsedDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 参加者リストメインビュー
 * stateManagerの状態に応じて適切なサブビューを返す
 * @returns {string} HTML文字列
 */
export function getParticipantView() {
  const state = participantStateManager.getState();
  const subView = state.participantSubView || 'list';

  debugLog('🎨 参加者リストビュー表示:', subView);

  switch (subView) {
    case 'list':
      return renderLessonList(
        /** @type {LessonCore[]} */ (state.participantLessons || []),
      );
    case 'salesCelebration':
      return renderSalesCelebrationView();
    case 'studentDetail':
      return renderStudentDetailModalContent(
        state.participantSelectedStudent,
        state.participantIsAdmin || false,
      );
    default:
      return renderError('不明なビューです');
  }
}

/**
 * 売上達成演出を画面全体に表示するオーバーレイを生成します。
 * @param {boolean} isActive
 * @param {string} message
 * @returns {string}
 */
function renderFullScreenSalesCelebrationOverlay(isActive, message) {
  if (!isActive) return '';

  const particlesHtml = Array.from({ length: 46 })
    .map((_, i) => {
      const left = ((i * 23) % 100) + 0.5;
      const delay = (i % 12) * 0.08;
      const duration = 1.6 + (i % 5) * 0.22;
      const hue = 24 + (i % 4) * 14;
      return `<span class="sales-screen-particle" style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s; --sales-particle-h:${hue};"></span>`;
    })
    .join('');

  return `
    <div class="sales-screen-overlay" aria-hidden="true">
      <div class="sales-screen-glow"></div>
      <div class="sales-screen-particles">${particlesHtml}</div>
      <div class="sales-screen-message-wrap">
        <div class="sales-screen-message">${escapeHTML(message)}</div>
      </div>
    </div>
    <style>
      .sales-screen-overlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        pointer-events: none;
        overflow: hidden;
      }
      .sales-screen-glow {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 20%, rgba(251, 191, 36, 0.35), transparent 45%),
          radial-gradient(circle at 80% 30%, rgba(249, 115, 22, 0.25), transparent 46%),
          radial-gradient(circle at 50% 85%, rgba(253, 186, 116, 0.28), transparent 50%);
        animation: sales-screen-glow-fade 2.2s ease-out forwards;
      }
      .sales-screen-particles {
        position: absolute;
        inset: 0;
      }
      .sales-screen-particle {
        position: absolute;
        bottom: -12vh;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          hsl(var(--sales-particle-h), 94%, 60%),
          hsl(calc(var(--sales-particle-h) + 24), 95%, 70%)
        );
        box-shadow: 0 0 8px rgba(251, 146, 60, 0.4);
        opacity: 0;
        animation-name: sales-screen-rise;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
      }
      .sales-screen-message-wrap {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 1rem;
      }
      .sales-screen-message {
        background: rgba(255, 255, 255, 0.92);
        border: 2px solid rgba(251, 146, 60, 0.5);
        color: #9a3412;
        font-size: 1.125rem;
        font-weight: 700;
        padding: 0.7rem 1rem;
        border-radius: 999px;
        box-shadow: 0 8px 20px rgba(194, 65, 12, 0.2);
        animation: sales-screen-message-pop 2.2s ease-out forwards;
      }
      @keyframes sales-screen-rise {
        0% { transform: translateY(0) scale(0.45); opacity: 0; }
        14% { opacity: 1; }
        100% { transform: translateY(-115vh) scale(1.1); opacity: 0; }
      }
      @keyframes sales-screen-glow-fade {
        0% { opacity: 0; }
        15% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes sales-screen-message-pop {
        0% { transform: scale(0.7); opacity: 0; }
        12% { transform: scale(1.06); opacity: 1; }
        100% { transform: scale(1); opacity: 0; }
      }
    </style>
  `;
}

/**
 * 売上集計・転記の処理中に表示する演出オーバーレイを生成します。
 * @param {boolean} isLoading
 * @param {string} targetDate
 * @returns {string}
 */
function renderSalesProcessingOverlay(isLoading, targetDate) {
  if (!isLoading) return '';

  const sparksHtml = Array.from({ length: 28 })
    .map((_, i) => {
      const left = ((i * 17) % 100) + 0.3;
      const delay = (i % 10) * 0.12;
      const duration = 1.5 + (i % 4) * 0.25;
      return `<span class="sales-processing-spark" style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s;"></span>`;
    })
    .join('');

  return `
    <div class="sales-processing-overlay" aria-live="polite" aria-busy="true">
      <div class="sales-processing-backdrop"></div>
      <div class="sales-processing-panel">
        <div class="sales-processing-title">売上を集計中です...</div>
        <div class="sales-processing-subtitle">${escapeHTML(targetDate)} のデータを整えています</div>
        <div class="sales-processing-meter-wrap">
          <div class="sales-processing-meter"></div>
        </div>
        <div class="sales-processing-coins">
          ${sparksHtml}
        </div>
      </div>
    </div>
    <style>
      .sales-processing-overlay {
        position: fixed;
        inset: 0;
        z-index: 140;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }
      .sales-processing-backdrop {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 20%, rgba(251, 191, 36, 0.3), transparent 45%),
          radial-gradient(circle at 75% 25%, rgba(251, 146, 60, 0.28), transparent 45%),
          rgba(255, 250, 242, 0.95);
        backdrop-filter: blur(2px);
      }
      .sales-processing-panel {
        position: relative;
        width: min(92vw, 460px);
        border-radius: 1rem;
        border: 2px solid rgba(251, 146, 60, 0.45);
        background: rgba(255, 255, 255, 0.96);
        padding: 1rem 1rem 1.2rem;
        box-shadow: 0 20px 48px rgba(194, 65, 12, 0.18);
        text-align: center;
      }
      .sales-processing-title {
        font-size: 1rem;
        font-weight: 800;
        color: #9a3412;
      }
      .sales-processing-subtitle {
        margin-top: 0.25rem;
        font-size: 0.78rem;
        color: #9a3412;
        opacity: 0.85;
      }
      .sales-processing-meter-wrap {
        margin-top: 0.75rem;
        border-radius: 999px;
        background: rgba(251, 146, 60, 0.16);
        overflow: hidden;
        height: 10px;
      }
      .sales-processing-meter {
        height: 100%;
        width: 36%;
        border-radius: inherit;
        background: linear-gradient(90deg, #f97316, #f59e0b, #fb923c);
        animation: sales-processing-meter-move 1.1s ease-in-out infinite;
      }
      .sales-processing-coins {
        position: relative;
        margin-top: 0.85rem;
        height: 58px;
        overflow: hidden;
      }
      .sales-processing-spark {
        position: absolute;
        bottom: -20px;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, #fff7ed 0%, #f59e0b 55%, #ea580c 100%);
        box-shadow: 0 0 8px rgba(251, 146, 60, 0.5);
        opacity: 0;
        animation-name: sales-processing-rise;
        animation-timing-function: ease-out;
        animation-iteration-count: infinite;
      }
      @keyframes sales-processing-meter-move {
        0% { transform: translateX(-90%); }
        50% { transform: translateX(170%); }
        100% { transform: translateX(360%); }
      }
      @keyframes sales-processing-rise {
        0% { transform: translateY(0) scale(0.5); opacity: 0; }
        20% { opacity: 1; }
        100% { transform: translateY(-72px) scale(1.05); opacity: 0; }
      }
    </style>
  `;
}

/**
 * 管理者向けの「教室完了」専用ビューを描画します。
 * 売上転載実行と、売上細目/集計結果の確認を同一画面で行います。
 * @returns {string}
 */
function renderSalesCelebrationView() {
  const state = participantStateManager.getState();
  const isAdmin =
    state.participantIsAdmin || state.currentUser?.isAdmin || false;
  if (!isAdmin) {
    return renderError('管理者のみ利用できます');
  }

  const toYen = (/** @type {number | string | null | undefined} */ amount) =>
    `¥${Number(amount || 0).toLocaleString()}`;
  const localToday = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();
  const targetDate = String(
    state['adminSalesTransferTargetDate'] || localToday,
  );
  const isFutureTargetDate = targetDate > localToday;
  const isLoading = Boolean(state['adminSalesTransferLoading']);
  const report = state['adminSalesTransferReport'] || null;
  const transferResult = state['adminSalesTransferLastTransferResult'] || null;
  const isReportDateMismatch = Boolean(
    report?.targetDate && String(report.targetDate) !== targetDate,
  );
  const celebrationActive = Boolean(
    state['adminSalesTransferCelebrationActive'],
  );
  const celebrationMessage = String(
    state['adminSalesTransferCelebrationMessage'] ||
      'きょうの教室 完了！おつかれさまでした。',
  );
  const celebrationOverlayHtml = renderFullScreenSalesCelebrationOverlay(
    celebrationActive,
    celebrationMessage,
  );
  const processingOverlayHtml = renderSalesProcessingOverlay(
    isLoading,
    targetDate,
  );
  const updatedStatusCount = Number(
    state['adminSalesTransferUpdatedStatusCount'] || 0,
  );
  const transferSuccessCount = Number(transferResult?.successCount || 0);
  const transferTotalCount = Number(transferResult?.totalCount || 0);
  const reportGrandTotal = Number(report?.totals?.grandTotal || 0);
  const rewardPoints =
    Math.max(0, Math.floor(reportGrandTotal / 1000) * 5) +
    Math.max(0, transferSuccessCount * 2);
  const stepStates = [
    {
      label: '対象日を確定',
      done: true,
      running: false,
    },
    {
      label: '売上を集計',
      done: Boolean(report) && !isReportDateMismatch,
      running: isLoading,
    },
    {
      label: '売上表へ転記',
      done: Boolean(transferResult),
      running: isLoading,
    },
    {
      label: '日程を開催済みに更新',
      done: Boolean(transferResult) || updatedStatusCount > 0,
      running: isLoading,
    },
  ];
  const completionStepsHtml = `
    <div class="mt-3 p-3 rounded-xl border border-orange-200 bg-white/90">
      <div class="text-xs font-bold text-orange-800">進行ステップ</div>
      <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${stepStates
          .map(
            step => `
              <div class="sales-step-item ${step.done ? 'is-done' : ''} ${
                !step.done && step.running ? 'is-running' : ''
              }">
                <span class="sales-step-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.5L6.8 11.8L12.5 5.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                </span>
                <span class="text-xs sm:text-sm">${escapeHTML(step.label)}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
    <style>
      .sales-step-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.48rem 0.55rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(251, 146, 60, 0.28);
        background: rgba(255, 255, 255, 0.94);
        color: #9a3412;
      }
      .sales-step-check {
        width: 1.2rem;
        height: 1.2rem;
        border-radius: 999px;
        border: 2px solid rgba(251, 146, 60, 0.5);
        background: #fff7ed;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .sales-step-check svg {
        width: 0.8rem;
        height: 0.8rem;
      }
      .sales-step-check path {
        stroke: #ffffff;
        stroke-dasharray: 18;
        stroke-dashoffset: 18;
      }
      .sales-step-item.is-done .sales-step-check {
        border-color: #16a34a;
        background: #16a34a;
        animation: sales-step-pop 0.35s ease-out;
      }
      .sales-step-item.is-done .sales-step-check path {
        stroke-dashoffset: 0;
        transition: stroke-dashoffset 0.32s ease-out;
      }
      .sales-step-item.is-running {
        border-color: #f59e0b;
        animation: sales-step-running 1.2s ease-in-out infinite;
      }
      @keyframes sales-step-pop {
        0% { transform: scale(0.72); }
        100% { transform: scale(1); }
      }
      @keyframes sales-step-running {
        0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.28); }
        100% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
      }
    </style>
  `;
  const rewardPanelHtml =
    !isLoading && transferResult
      ? `
        <div class="mt-4 p-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-lime-50 to-white shadow-sm reward-panel">
          <div class="text-xs font-bold tracking-wide text-emerald-700">MISSION CLEAR</div>
          <div class="mt-1 text-lg sm:text-xl font-extrabold text-emerald-800">おつかれさまでした！</div>
          <div class="text-xs text-emerald-700">教室完了の記録ができました。</div>
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="rounded-lg border border-emerald-200 bg-white p-2">
              <div class="text-[11px] text-emerald-700">計上金額</div>
              <div class="text-lg font-extrabold text-emerald-800 reward-amount">${toYen(reportGrandTotal)}</div>
            </div>
            <div class="rounded-lg border border-emerald-200 bg-white p-2">
              <div class="text-[11px] text-emerald-700">計上件数</div>
              <div class="text-base font-bold text-emerald-800">${transferSuccessCount}/${transferTotalCount}</div>
            </div>
            <div class="rounded-lg border border-emerald-200 bg-white p-2">
              <div class="text-[11px] text-emerald-700">達成ポイント</div>
              <div class="text-base font-bold text-emerald-800">+${rewardPoints} pt</div>
            </div>
          </div>
        </div>
        <style>
          .reward-panel {
            animation: reward-panel-pop 0.48s ease-out;
          }
          .reward-amount {
            animation: reward-amount-pop 0.56s ease-out;
          }
          @keyframes reward-panel-pop {
            0% { transform: scale(0.97); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes reward-amount-pop {
            0% { transform: translateY(4px) scale(0.9); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
        </style>
      `
      : '';

  let reportHtml = `
    <div class="mt-4">
      ${Components.cardContainer({
        variant: 'default',
        padding: 'normal',
        customClass: 'bg-white',
        content: `
          <div class="text-sm font-bold text-brand-text mb-1">売上集計</div>
          <p class="text-xs text-brand-subtle">「集計だけ更新」または「教室完了 ⇢ 売上集計」を実行すると、ここに売上細目と集計が表示されます。</p>
        `,
      })}
    </div>
  `;

  if (report) {
    const breakdownRows = (report.itemBreakdown || [])
      .slice(0, 15)
      .map(
        (/** @type {any} */ item) => `
          <tr class="border-b border-ui-border-light text-xs">
            <td class="py-1 pr-2 text-brand-subtle whitespace-nowrap">${escapeHTML(item.category || '')}</td>
            <td class="py-1 pr-2">${escapeHTML(item.itemName || '')}</td>
            <td class="py-1 pr-2 text-right">${Number(item.quantity || 0).toLocaleString()}</td>
            <td class="py-1 text-right font-semibold">${toYen(item.amount || 0)}</td>
          </tr>
        `,
      )
      .join('');

    const reservationRows = (report.reservationSummaries || [])
      .slice(0, 12)
      .map(
        (/** @type {any} */ summary) => `
          <tr class="border-b border-ui-border-light text-xs">
            <td class="py-1 pr-2">${escapeHTML(summary.displayName || summary.studentId || '')}</td>
            <td class="py-1 pr-2 text-brand-subtle">${escapeHTML(summary.classroom || '')}</td>
            <td class="py-1 pr-2 text-right">${summary.itemCount || 0}</td>
            <td class="py-1 text-right font-semibold">${toYen(summary.grandTotal || 0)}</td>
          </tr>
        `,
      )
      .join('');

    const warnings = Array.isArray(report.warnings) ? report.warnings : [];
    const warningsHtml =
      warnings.length > 0
        ? `<div class="mt-2 p-2 text-xs rounded border border-yellow-300 bg-yellow-50 text-yellow-800">${warnings
            .slice(0, 3)
            .map(
              (/** @type {string} */ warning) =>
                `<div>・${escapeHTML(warning)}</div>`,
            )
            .join('')}</div>`
        : '';

    const transferStatusHtml = transferResult
      ? `<div class="mt-2 p-2 text-xs rounded border border-green-300 bg-green-50 text-green-800">
          転記結果: 成功 ${Number(transferResult.successCount || 0)} / 対象 ${Number(transferResult.totalCount || 0)}
        </div>`
      : '';

    const hasTransferTargets = Number(report.totalReservations || 0) > 0;
    const reportSummaryHtml = hasTransferTargets
      ? `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
          <div class="p-2 rounded border border-ui-border bg-white"><div class="text-brand-subtle">対象よやく</div><div class="text-base font-bold">${Number(report.totalReservations || 0)}件</div></div>
          <div class="p-2 rounded border border-ui-border bg-white"><div class="text-brand-subtle">転記行数</div><div class="text-base font-bold">${Number(report.salesRowCount || 0)}行</div></div>
          <div class="p-2 rounded border border-ui-border bg-white"><div class="text-brand-subtle">授業料</div><div class="text-base font-bold">${toYen(report.totals?.tuitionSubtotal || 0)}</div></div>
          <div class="p-2 rounded border border-ui-border bg-white"><div class="text-brand-subtle">物販</div><div class="text-base font-bold">${toYen(report.totals?.salesSubtotal || 0)}</div></div>
        </div>
        <div class="mt-2 p-2 rounded border border-brand-subtle/40 bg-brand-light">
          <div class="text-xs text-brand-subtle">合計金額</div>
          <div class="text-lg font-bold">${toYen(report.totals?.grandTotal || 0)}</div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <div class="p-2 rounded border border-ui-border bg-white">
            <div class="text-xs font-bold mb-1">売上細目（上位15件）</div>
            ${
              breakdownRows
                ? `<table class="w-full"><thead><tr class="text-[10px] text-brand-subtle border-b border-ui-border"><th class="py-1 pr-2 text-left">区分</th><th class="py-1 pr-2 text-left">項目</th><th class="py-1 pr-2 text-right">数量</th><th class="py-1 text-right">金額</th></tr></thead><tbody>${breakdownRows}</tbody></table>`
                : '<p class="text-xs text-brand-subtle">細目データがありません。</p>'
            }
          </div>
          <div class="p-2 rounded border border-ui-border bg-white">
            <div class="text-xs font-bold mb-1">予約別集計（上位12件）</div>
            ${
              reservationRows
                ? `<table class="w-full"><thead><tr class="text-[10px] text-brand-subtle border-b border-ui-border"><th class="py-1 pr-2 text-left">名前</th><th class="py-1 pr-2 text-left">教室</th><th class="py-1 pr-2 text-right">項目数</th><th class="py-1 text-right">合計</th></tr></thead><tbody>${reservationRows}</tbody></table>`
                : '<p class="text-xs text-brand-subtle">予約別データがありません。</p>'
            }
          </div>
        </div>
      `
      : `<div class="mt-3 text-xs text-brand-subtle">対象日の会計済みよやくはありません。</div>`;

    reportHtml = `
      <div class="mt-4">
        ${Components.cardContainer({
          variant: 'default',
          padding: 'normal',
          customClass: 'bg-white',
          content: `
            <div class="text-sm font-bold text-brand-text">売上集計</div>
            <div class="text-xs text-brand-subtle mt-1">対象日: ${escapeHTML(report.targetDate || targetDate)}</div>
            ${reportSummaryHtml}
            ${warningsHtml}
            ${transferStatusHtml}
          `,
        })}
      </div>
    `;
  }

  return Components.pageContainer({
    maxWidth: '5xl',
    content: `
      ${processingOverlayHtml}
      ${celebrationOverlayHtml}
      ${Components.pageHeader({
        title: '教室しめ・売上確認',
        showBackButton: false,
        customActionHtml: Components.button({
          action: 'closeSalesCelebrationView',
          text: '一覧にもどる',
          style: 'secondary',
          size: 'xs',
        }),
      })}

      <div class="relative overflow-hidden rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-white p-4 sm:p-5">
        <div class="relative z-10">
          <h2 class="text-lg sm:text-xl font-bold text-brand-text">きょうの教室 完了！</h2>
          <p class="text-xs sm:text-sm text-brand-subtle mt-1">売上転載と日程ステータス更新を一体で実行し、集計と細目を確認できます。</p>

          <div class="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div>
              <label class="text-xs text-brand-subtle mb-1 block" for="admin-sales-celebration-date">対象日</label>
              <input
                id="admin-sales-celebration-date"
                type="date"
                value="${escapeHTML(targetDate)}"
                onchange="actionHandlers.updateSalesTransferTargetDate({ date: this.value })"
                class="${DesignConfig.inputs.base}"
                ${isLoading ? 'disabled' : ''}
              />
            </div>
            <div>
              ${Components.button({
                action: 'previewSalesTransfer',
                text: isLoading ? '更新中...' : '集計だけ更新',
                style: 'secondary',
                size: 'small',
                disabled: isLoading,
              })}
            </div>
            <div>
              ${Components.button({
                action: 'completeTodayClassroom',
                text: isLoading
                  ? '集計・転載中...'
                  : isFutureTargetDate
                    ? '未来日は実行不可'
                    : '教室完了 ⇢ 売上集計',
                style: 'attention',
                size: 'small',
                disabled: isLoading || isFutureTargetDate,
              })}
            </div>
          </div>

          <div class="mt-2 text-xs text-brand-subtle">会計済みよやくの売上を売上表へ転送し、日程ステータスも更新します。</div>
          ${
            isFutureTargetDate
              ? '<div class="mt-2 p-2 rounded border border-red-200 bg-red-50 text-xs text-red-700">未来日程は「教室完了 ⇢ 売上集計」を実行できません。</div>'
              : ''
          }
          ${
            isReportDateMismatch
              ? '<div class="mt-2 p-2 rounded border border-blue-200 bg-blue-50 text-xs text-blue-700">対象日を変更しました。必要に応じて「集計だけ更新」で表示内容を最新化してください。</div>'
              : ''
          }
          ${
            celebrationActive
              ? `<div class="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-300 bg-white/90 px-3 py-1 text-sm font-bold text-orange-700 shadow-sm">${escapeHTML(celebrationMessage)}</div>`
              : ''
          }
          ${completionStepsHtml}
          ${rewardPanelHtml}
        </div>
      </div>

      ${reportHtml}

      <div class="mt-4">
        ${Components.button({
          action: 'closeSalesCelebrationView',
          text: '参加者一覧にもどる',
          style: 'secondary',
          size: 'full',
        })}
      </div>
    `,
  });
}

// createBadge関数は削除 - Components.badge()を使用

/**
 * 表示する列をフィルタリング（管理者権限と表示モードに基づく）
 * @param {boolean} isAdmin - 管理者フラグ
 * @param {boolean} showPastLessons - 過去表示フラグ
 * @returns {ParticipantColumnConfig[]} フィルタリングされた列定義
 */
function getVisibleColumns(isAdmin, showPastLessons = false) {
  return PARTICIPANT_TABLE_COLUMNS.filter(col => {
    // 管理者専用カラムの判定
    if (col.adminOnly && !isAdmin) return false;
    // 過去表示のみのカラム
    if (col.pastOnly && !showPastLessons) return false;
    // 未来表示のみのカラム
    if (col.futureOnly && showPastLessons) return false;
    return true;
  });
}

/**
 * アコーディオン展開時のよやく詳細コンテンツを生成（ヘッダーなし、データ行のみ）
 * @param {LessonCore} _lesson - レッスン情報（未使用）
 * @param {any[]} reservations - よやく一覧
 * @param {boolean} isAdmin - 管理者フラグ
 * @param {boolean} showPastLessons - 過去表示フラグ
 * @returns {string} HTML文字列
 */
function renderAccordionContent(
  _lesson,
  reservations,
  isAdmin = true,
  showPastLessons = false,
) {
  if (!reservations || reservations.length === 0) {
    return '<div class="text-center text-gray-500 text-xs py-2">参加者がいません</div>';
  }

  // 表示する列を取得
  const visibleColumns = getVisibleColumns(isAdmin, showPastLessons);
  const gridTemplate = visibleColumns.map(col => col.width).join(' ');

  // データ行のみを生成（ヘッダーなし）
  return reservations
    .map(row => {
      const isPending =
        showPastLessons && row.status === CONSTANTS.STATUS.CONFIRMED;
      // レッスンIDを注入（プリロード用）
      const rowForRender = {
        ...row,
        lessonId: _lesson.lessonId,
        _pending: isPending,
      };

      // 各列のHTMLを生成
      const columnsHtml = visibleColumns
        .map(col => {
          const content = col.render
            ? col.render(rowForRender)
            : escapeHTML(rowForRender[col.key] || '—');
          return `<div class="overflow-hidden">${content}</div>`;
        })
        .join('');

      const rowBgColor = isPending
        ? 'bg-red-50 hover:bg-red-100'
        : row.status === CONSTANTS.STATUS.WAITLISTED
          ? 'bg-yellow-50 hover:bg-yellow-100'
          : 'hover:bg-gray-50';

      // グリッドレイアウトでデータ行を生成
      // min-heightを設定して内容量に応じて自動で広がるようにする (h-autoを使用)
      return `
        <div class="px-0.5 grid gap-1 border-t border-dashed border-gray-200 ${rowBgColor} items-start py-1" style="grid-template-columns: ${gridTemplate}; min-width: 1200px; min-height: 3rem;">
          ${columnsHtml}
        </div>
      `;
    })
    .join('');
}

/**
 * レッスン一覧を描画
 * @param {LessonCore[]} lessons - レッスン一覧
 * @returns {string} HTML文字列
 */
function renderLessonList(lessons) {
  if (!lessons || lessons.length === 0) {
    return `
      ${Components.pageHeader({
        title: 'みんな の よやく・きろく',
        backAction: 'smartGoBack',
      })}
      <div class="${DesignConfig.layout.container}">
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          customClass: 'bg-white',
          content: `
            <div class="text-center py-4">
              <p class="${DesignConfig.text.body} mb-4">レッスンが見つかりません</p>
              ${Components.button({
                text: 'ホームへもどる',
                action: 'goToDashboard',
                style: 'primary',
                size: 'full',
              })}
            </div>
          `,
        })}
      </div>
    `;
  }

  // stateManagerからよやくデータを取得
  const state = participantStateManager.getState();
  const reservationsMap = state.participantReservationsMap || {};
  const selectedClassroom = state.selectedParticipantClassroom || 'all';
  const showPastLessons = state.showPastLessons || false;
  const isAdmin =
    state.participantIsAdmin || state.currentUser?.isAdmin || false;
  const isSalesTransferLoading = Boolean(state['adminSalesTransferLoading']);
  const currentSalesTargetDate = String(
    state['adminSalesTransferTargetDate'] || '',
  );
  const celebrationOverlayHtml = renderFullScreenSalesCelebrationOverlay(
    Boolean(state['adminSalesTransferCelebrationActive']),
    String(
      state['adminSalesTransferCelebrationMessage'] ||
        'きょうの教室 完了！おつかれさまでした。',
    ),
  );

  // 教室一覧を取得（重複を除く）
  const classrooms = [
    'all',
    ...new Set(lessons.map(l => l.classroom).filter(Boolean)),
  ];

  // 今日の日付（時刻を00:00:00にリセット）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYmd = normalizeLocalYmd(today);

  // 未来と過去のレッスンに分ける（当日は両方に含める）
  const futureLessons = lessons
    .filter(l => {
      const lessonDate = new Date(l.date);
      lessonDate.setHours(0, 0, 0, 0);
      return lessonDate >= today; // 当日を含む
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // 昇順

  const pastLessons = lessons
    .filter(l => {
      const lessonDate = new Date(l.date);
      lessonDate.setHours(0, 0, 0, 0);
      return lessonDate <= today; // 当日を含む
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 降順

  // 表示対象のレッスンを選択
  const targetLessons = showPastLessons ? pastLessons : futureLessons;

  // フィルタリングされたレッスン
  const filteredLessons =
    selectedClassroom === 'all'
      ? targetLessons
      : targetLessons.filter(l => l.classroom === selectedClassroom);

  // 未処理件数を計算（管理者向け）
  let totalPendingCount = 0;
  if (isAdmin) {
    pastLessons.forEach(lesson => {
      const lessonReservations = reservationsMap[lesson.lessonId] || [];
      const confirmedCount = lessonReservations.filter(
        r => r.status === CONSTANTS.STATUS.CONFIRMED,
      ).length;
      totalPendingCount += confirmedCount;
    });
  }

  // ビュー切り替えUIの生成（pillToggleを使用、教室フィルターと同じ形式）
  const viewToggleOptions = [
    {
      value: 'future',
      label: 'みんな の よやく',
      onclick: 'actionHandlers.togglePastLessons(false)',
    },
    {
      value: 'past',
      label:
        isAdmin && totalPendingCount > 0
          ? `みんな の きろく ⚠${totalPendingCount}`
          : 'みんな の きろく',
      onclick: 'actionHandlers.togglePastLessons(true)',
    },
  ];
  const viewToggleHtml = Components.pillToggle({
    options: viewToggleOptions,
    selectedValue: showPastLessons ? 'past' : 'future',
    size: 'small',
  });

  // フィルタUIの生成（pillToggleを使用、教室ごとの色を反映）
  // 教室順序でソート
  const desiredOrder = DesignConfig.classroomOrder || [
    '東京教室',
    'つくば教室',
    '沼津教室',
  ];
  const sortedClassrooms = [...classrooms].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    const indexA = desiredOrder.indexOf(a);
    const indexB = desiredOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // pillToggle用オプションを生成（教室ごとの色付き）
  /** @type {Array<{value: string, label: string, action: string, dataAttributes: Record<string, string>, colorClass: string}>} */
  const filterOptions = sortedClassrooms.map(classroom => {
    const colorConfig = getClassroomColor(classroom);
    return {
      value: classroom,
      label: classroom === 'all' ? 'すべて' : classroom.replace('教室', ''),
      action: 'filterParticipantByClassroom',
      dataAttributes: { 'data-classroom': classroom },
      colorClass: classroom === 'all' ? '' : colorConfig.badge,
    };
  });
  const filterHtml = Components.pillToggle({
    options: filterOptions,
    selectedValue: selectedClassroom,
    size: 'small',
  });

  // 共通テーブルヘッダー（列定義から生成）
  const visibleColumns = getVisibleColumns(isAdmin, showPastLessons);
  const gridTemplate = visibleColumns.map(col => col.width).join(' ');
  const tableHeaderHtml = Components.stickyTableHeader({
    headerId: 'participants-table-header',
    columns: visibleColumns.map(col => {
      /** @type {{label: string, align?: string}} */
      const headerCol = { label: col.label };
      if (col.align) headerCol.align = col.align;
      return headerCol;
    }),
    gridTemplate,
  });

  const lessonsHtml = filteredLessons
    .map(lesson => {
      // よやくデータをフィルタリング
      const allLessonReservations = reservationsMap[lesson.lessonId] || [];
      const confirmedReservations = allLessonReservations.filter(
        r => r.status === CONSTANTS.STATUS.CONFIRMED,
      );
      const completedReservations = allLessonReservations.filter(
        r => r.status === CONSTANTS.STATUS.COMPLETED,
      );
      const waitlistedReservations = allLessonReservations.filter(
        r => r.status === CONSTANTS.STATUS.WAITLISTED,
      );

      // 表示対象となるベースのよやく（未来は確定、過去は完了）
      const baseBadgeReservations = showPastLessons
        ? completedReservations
        : confirmedReservations;

      // 初回参加者数を計算（対象よやくのみ）
      const firstLectureCount = baseBadgeReservations.filter(
        /** @param {any} r */ r => r.firstLecture,
      ).length;

      // formatDate関数を使用して日付を表示（xsサイズに調整）
      const formattedDateHtml = window.formatDate(lesson.date);
      // formatDateの結果のfont-sizeをxsに変更
      const formattedDate = formattedDateHtml.replace(
        /class="font-mono-numbers font-bold"/,
        'class="text-sm font-bold"',
      );

      // ========================================
      // バッジ生成（新フォーマット）
      // 通常: 人数:[5,初2], 待機:[2,初1], 刀:[3]
      // 2部制: 人数:[5,3,初2], 待機:[2,0,初1], 刀:[3,2]
      // 過去: 人数:[5,初2] or [5,3,初2], 未処理:[1]
      // ========================================

      // 教室形式で2部制かどうかを判定（classroomTypeを優先、フォールバックとしてclassroom名も確認）
      const isTwoSession =
        lesson.classroomType === '時間制・2部制' ||
        (lesson.classroom &&
          (lesson.classroom.includes('午前') ||
            lesson.classroom.includes('午後')));

      /**
       * よやくの時間帯を判定（午前・午後）
       * @param {any} reservation - よやくデータ
       * @returns {'morning' | 'afternoon' | 'both'}
       */
      const getTimeSlot = reservation => {
        const start = reservation.startTime || '';
        const end = reservation.endTime || '';
        if (!start && !end) return 'both';

        const parseTime = /** @param {string|undefined} time */ time => {
          if (!time) return null;
          const [h, m] = time.split(':').map(Number);
          if (Number.isNaN(h) || Number.isNaN(m)) return null;
          return h + m / 60;
        };

        // 1部終了時刻と2部開始時刻を基準に判定
        const session1End =
          parseTime(lesson.firstEnd) || parseTime(lesson.endTime) || 12;
        const session2Start =
          parseTime(lesson.secondStart) || parseTime(lesson.startTime) || 13;

        const startNum = parseTime(start);
        const endNum = parseTime(end);
        if (startNum === null || endNum === null) return 'both';

        const inMorning = startNum < session1End;
        const inAfternoon = endNum > session2Start;
        if (inMorning && inAfternoon) return 'both';
        if (inMorning) return 'morning';
        if (inAfternoon) return 'afternoon';
        return 'both';
      };

      /**
       * バッジ用テキストを生成するヘルパー（通常）
       * @param {string} label - ラベル
       * @param {number} count - メインカウント
       * @returns {string} バッジテキスト（例: "人数 5"）
       */
      const formatBadgeText = (label, count) => {
        return `${label}${count}`;
      };

      /**
       * バッジ用テキストを生成するヘルパー（2部制）
       * @param {string} label - ラベル
       * @param {number} morningCount - 午前カウント
       * @param {number} afternoonCount - 午後カウント
       * @returns {string} バッジテキスト（例: "人数 5 3"）
       */
      const formatTwoSessionBadgeText = (
        label,
        morningCount,
        afternoonCount,
      ) => {
        return `${label}${morningCount} ${afternoonCount}`;
      };

      /**
       * よやくを午前・午後でカウント
       * @param {any[]} reservations
       * @returns {{morning: number, afternoon: number}}
       */
      const countBySlot = reservations =>
        reservations.reduce(
          /**
           * @param {{morning: number, afternoon: number}} acc
           * @param {any} r
           */
          (acc, r) => {
            const slot = getTimeSlot(r);
            if (slot === 'morning' || slot === 'both') acc.morning += 1;
            if (slot === 'afternoon' || slot === 'both') acc.afternoon += 1;
            return acc;
          },
          { morning: 0, afternoon: 0 },
        );

      // 人数バッジ（メイン）
      const mainCount = baseBadgeReservations.length;
      let mainBadge = '';
      let firstLectureBadge = ''; // 初回バッジ（分離）
      if (mainCount > 0) {
        if (isTwoSession) {
          const baseCounts = countBySlot(baseBadgeReservations);
          mainBadge = Components.badge({
            text: formatTwoSessionBadgeText(
              '人数',
              baseCounts.morning,
              baseCounts.afternoon,
            ),
            color: 'gray',
            size: 'xs',
            border: true,
          });
        } else {
          mainBadge = Components.badge({
            text: formatBadgeText('人数', mainCount),
            color: 'gray',
            size: 'xs',
            border: true,
          });
        }
        // 初回バッジ（分離して緑色で表示）
        if (firstLectureCount > 0) {
          firstLectureBadge = Components.badge({
            text: `初${firstLectureCount}`,
            color: 'green',
            size: 'xs',
            border: true,
          });
        }
      }

      // 待機バッジ（未来のみ）
      let waitlistBadge = '';
      if (!showPastLessons && waitlistedReservations.length > 0) {
        if (isTwoSession) {
          const waitlistCounts = countBySlot(waitlistedReservations);
          waitlistBadge = Components.badge({
            text: formatTwoSessionBadgeText(
              '待機',
              waitlistCounts.morning,
              waitlistCounts.afternoon,
            ),
            color: 'yellow',
            size: 'xs',
            border: true,
          });
        } else {
          waitlistBadge = Components.badge({
            text: formatBadgeText('待機', waitlistedReservations.length),
            color: 'yellow',
            size: 'xs',
            border: true,
          });
        }
      }

      // 刀バッジ（未来のみ）
      let chiselBadge = '';
      if (!showPastLessons) {
        const chiselRentalCount = baseBadgeReservations.filter(
          /** @param {any} r */ r => r.chiselRental,
        ).length;
        if (chiselRentalCount > 0) {
          if (isTwoSession) {
            const chiselCounts = countBySlot(
              baseBadgeReservations.filter(
                /** @param {any} r */ r => r.chiselRental,
              ),
            );
            chiselBadge = Components.badge({
              text: `刀${chiselCounts.morning} ${chiselCounts.afternoon}`,
              color: 'orange',
              size: 'xs',
              border: true,
            });
          } else {
            chiselBadge = Components.badge({
              text: `刀${chiselRentalCount}`,
              color: 'orange',
              size: 'xs',
              border: true,
            });
          }
        }
      }

      // 未処理バッジ（過去のみ）
      const pendingCount = confirmedReservations.length;
      const pendingBadge =
        showPastLessons && pendingCount > 0
          ? Components.badge({
              text: `未処理 ${pendingCount}`,
              color: 'red',
              size: 'xs',
              border: true,
            })
          : '';

      // 売上転載状態バッジ（管理者向け）
      let salesTransferBadge = '';
      if (isAdmin) {
        const rawTransferStatus = String(lesson['salesTransferStatus'] || '');
        if (rawTransferStatus) {
          /** @type {Record<string, { text: string; color: 'gray'|'blue'|'green'|'red'|'orange'|'purple'|'yellow' }>} */
          const transferBadgeMap = {
            [CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.PENDING]: {
              text: '売上 未転載',
              color: 'yellow',
            },
            [CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.COMPLETED]: {
              text: '売上 転載済',
              color: 'green',
            },
            [CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.PARTIAL]: {
              text: '売上 一部失敗',
              color: 'orange',
            },
            [CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.FAILED]: {
              text: '売上 失敗',
              color: 'red',
            },
          };
          const transferInfo = transferBadgeMap[rawTransferStatus] || {
            text: `売上 ${rawTransferStatus}`,
            color: 'blue',
          };
          salesTransferBadge = Components.badge({
            text: transferInfo.text,
            color: transferInfo.color,
            size: 'xs',
            border: true,
          });
        }
      }

      // アコーディオンが展開されているか（ローカル変数ではなくDOMから判定）
      // すべてのレッスンはデフォルト全開。DOM状態があればそれを優先
      let isExpanded = true; // デフォルト設定（全展開）
      const container = document.querySelector(
        `[data-lesson-container="${escapeHTML(lesson.lessonId)}"]`,
      );
      if (container) {
        const content = container.querySelector('.accordion-content');
        if (content) {
          isExpanded = !content.classList.contains('hidden');
        }
      }

      // 教室の色を取得
      const classroomColor = getClassroomColor(lesson.classroom);

      // 完了済みかどうかを判定
      const isCompleted =
        lesson.status === '完了' || lesson.status === 'キャンセル';

      // アコーディオンのボタン（パディング調整: py-0.5 -> py-2 で高さを少し確保）
      // バッジ表示エリアのレイアウト調整（左寄せ、justify-between廃止）
      const accordionButton = `
        <button
          class="px-2 py-2 w-full ${isCompleted ? 'opacity-75' : ''} hover:opacity-100 group text-left"
          onclick="actionHandlers.toggleParticipantLessonAccordion('${escapeHTML(lesson.lessonId)}')"
          data-lesson-id="${escapeHTML(lesson.lessonId)}"
        >
          <div class="flex items-center gap-1 sm:gap-2">
            <svg class="w-4 h-4 flex-shrink-0 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''} ${classroomColor.text} opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
            <div class="flex items-center gap-1 sm:gap-2 min-w-0 w-[140px] sm:w-[200px] flex-shrink-0">
              <span class="text-xs sm:text-sm font-bold text-action-primary whitespace-nowrap">${formattedDate.replace(/class=".*?"/g, '')}</span>
              <span class="font-bold text-xs sm:text-sm ${classroomColor.text} truncate">${escapeHTML(lesson.classroom.replace('教室', ''))}</span>
              ${lesson.venue ? `<span class="px-1 rounded-full text-xs ${getVenueColor(lesson.venue).badgeClass}">${escapeHTML(lesson.venue)}</span>` : ''}
              ${isCompleted ? '<span class="text-xs text-gray-500">✓</span>' : ''}
            </div>
            <div class="flex flex-wrap gap-0.5 items-center font-light">
              ${mainBadge}
              ${firstLectureBadge}
              ${waitlistBadge}
              ${chiselBadge}
              ${pendingBadge}
              ${salesTransferBadge}
            </div>
          </div>
        </button>
      `;

      // よやくボタンまたは管理ボタン
      let reserveButtonHtml;
      if (isAdmin) {
        const lessonDateYmd = normalizeLocalYmd(lesson.date);
        const isPastOrToday = lessonDateYmd ? lessonDateYmd <= todayYmd : false;
        const lessonStatus = String(lesson.status || '');
        const scheduledStatusValue = String(
          CONSTANTS.SCHEDULE_STATUS.SCHEDULED,
        );
        const salesTransferStatus = String(lesson['salesTransferStatus'] || '');
        const pendingTransferStatusValue = String(
          CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.PENDING,
        );
        const partialTransferStatusValue = String(
          CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.PARTIAL,
        );
        const failedTransferStatusValue = String(
          CONSTANTS.ACCOUNTING_SYSTEM.SALES_TRANSFER_STATUS.FAILED,
        );
        const normalizedLessonStatus = lessonStatus.replace(/\s+/g, '');
        const normalizedScheduledStatus = scheduledStatusValue.replace(
          /\s+/g,
          '',
        );
        const normalizedSalesTransferStatus = salesTransferStatus.replace(
          /\s+/g,
          '',
        );
        const normalizedPendingTransferStatus =
          pendingTransferStatusValue.replace(/\s+/g, '');
        const normalizedPartialTransferStatus =
          partialTransferStatusValue.replace(/\s+/g, '');
        const normalizedFailedTransferStatus =
          failedTransferStatusValue.replace(/\s+/g, '');
        const isScheduledStatus =
          normalizedLessonStatus === normalizedScheduledStatus ||
          normalizedLessonStatus.includes(normalizedScheduledStatus);
        const isPendingSalesTransfer =
          normalizedSalesTransferStatus === normalizedPendingTransferStatus ||
          normalizedSalesTransferStatus.includes(
            normalizedPendingTransferStatus,
          );
        const isPartialSalesTransfer =
          normalizedSalesTransferStatus === normalizedPartialTransferStatus ||
          normalizedSalesTransferStatus.includes(
            normalizedPartialTransferStatus,
          );
        const isFailedSalesTransfer =
          normalizedSalesTransferStatus === normalizedFailedTransferStatus ||
          normalizedSalesTransferStatus.includes(
            normalizedFailedTransferStatus,
          );
        const isRetryableSalesTransferStatus =
          isPendingSalesTransfer ||
          isPartialSalesTransfer ||
          isFailedSalesTransfer;
        const isRunningThisLessonDate =
          isSalesTransferLoading && currentSalesTargetDate === lessonDateYmd;
        const shouldShowCompleteButton =
          isPastOrToday &&
          (isScheduledStatus || isRetryableSalesTransferStatus);
        const isCompleteButtonEnabled =
          shouldShowCompleteButton && !isSalesTransferLoading;
        const completeDisabledReason = isSalesTransferLoading
          ? '売上集計を処理中です'
          : '';
        const completeButtonClass = isCompleteButtonEnabled
          ? 'bg-action-attention-bg text-action-attention-text hover:opacity-90'
          : 'bg-orange-100 text-orange-300 cursor-not-allowed';
        const shouldShowRetryLabel =
          !isScheduledStatus &&
          (isPartialSalesTransfer || isFailedSalesTransfer);
        // 管理者用「管理」ボタン（モーダルでリスト表示・編集）
        reserveButtonHtml = `
        <div class="pt-1 text-right px-2 pb-1">
          <div class="flex flex-wrap justify-end gap-1">
            <button
                    type="button"
                    class="inline-flex items-center justify-center whitespace-nowrap text-[11px] sm:text-xs font-bold leading-none py-1.5 px-2.5 rounded-md bg-action-primary-bg text-white shadow-sm hover:bg-action-primary-hover"
                    data-action="showLessonParticipants"
                    data-lesson-id="${lesson.lessonId}">
              管理
            </button>
            ${
              shouldShowCompleteButton
                ? `<button
                    type="button"
                    class="inline-flex items-center justify-center whitespace-nowrap text-[11px] sm:text-xs font-bold leading-none py-1.5 px-2.5 rounded-md shadow-sm ${completeButtonClass}"
                    data-action="completeLessonSalesTransfer"
                    data-date="${escapeHTML(lessonDateYmd)}"
                    ${isCompleteButtonEnabled ? '' : 'disabled'}
                    title="${escapeHTML(completeDisabledReason)}"
                  >
                    ${
                      isSalesTransferLoading && isRunningThisLessonDate
                        ? '集計中...'
                        : shouldShowRetryLabel
                          ? '売上集計を再実行'
                          : '教室完了 ⇢ 売上集計'
                    }
                  </button>`
                : ''
            }
          </div>
        </div>`;
      } else {
        // 通常ユーザー用ボタン（状態に応じて出し分け）
        if (showPastLessons) {
          reserveButtonHtml = '';
        } else {
          // ボタン状態判定ロジック
          const buttonState = _getLocalButtonState(
            lesson,
            state.currentUser?.studentId,
            reservationsMap[lesson.lessonId] || [],
          );

          if (buttonState) {
            reserveButtonHtml = `
            <div class="pt-1 text-right px-2 pb-1">
              <button class="${buttonState.class}"
                      data-action="${buttonState.action}"
                      data-lesson-id="${lesson.lessonId}">
                ${buttonState.text}
              </button>
            </div>`;
          } else {
            reserveButtonHtml = '';
          }
        }
      }

      // アコーディオンコンテンツ
      // 【変更】未来はデフォルト表示(hiddenクラスなし)、過去は非表示(hiddenクラスあり)
      const hiddenClass = isExpanded ? '' : 'hidden';

      // 表示対象のよやくをフィルタリング
      // - 未来（よやく）: 確定（CONFIRMED） + 待機（WAITLISTED）のみ表示、完了は非表示
      // - 過去（きろく）: 完了（COMPLETED）のみ表示
      const displayReservations = showPastLessons
        ? allLessonReservations.filter(
            r =>
              r.status === CONSTANTS.STATUS.COMPLETED ||
              r.status === CONSTANTS.STATUS.CONFIRMED,
          )
        : allLessonReservations.filter(
            r =>
              r.status === CONSTANTS.STATUS.CONFIRMED ||
              r.status === CONSTANTS.STATUS.WAITLISTED,
          );

      const accordionContent = `
        <div class="accordion-content bg-white ${hiddenClass}" data-lesson-id="${escapeHTML(lesson.lessonId)}">
          <div class="overflow-x-auto participants-table-body">
            ${renderAccordionContent(
              lesson,
              displayReservations,
              isAdmin,
              showPastLessons,
            )}
          </div>
          ${reserveButtonHtml}
        </div>
      `;

      // レッスンカード（白背景、コンパクト表示）
      return `
        <div class="mb-0.5" data-lesson-container="${escapeHTML(lesson.lessonId)}">
          <div class="border-2 ${classroomColor.bg}  ${classroomColor.border} ${DesignConfig.borderRadius.container} overflow-hidden">
            ${accordionButton}
            ${accordionContent}
          </div>
        </div>
      `;
    })
    .join('');

  // データがない場合のメッセージ
  const emptyMessage =
    filteredLessons.length === 0
      ? `<div class="bg-white border-2 border-ui-border ${DesignConfig.borderRadius.container} p-2">
           <p class="text-xs text-gray-500 text-center">${escapeHTML(showPastLessons ? '過去の記録がありません' : '未来のよやくがありません')}</p>
         </div>`
      : '';

  const participantPastPaginationState =
    typeof appWindow.getParticipantPastPaginationState === 'function'
      ? appWindow.getParticipantPastPaginationState()
      : {
          hasMorePastLessons: false,
          isLoadingMorePastLessons: false,
        };

  const loadMorePastButtonHtml =
    showPastLessons && participantPastPaginationState.hasMorePastLessons
      ? `<div class="mt-3">
          ${Components.button({
            text: participantPastPaginationState.isLoadingMorePastLessons
              ? '読み込み中...'
              : 'もっと表示する',
            action: 'loadMorePastParticipantLessons',
            style: 'secondary',
            size: 'full',
            disabled: participantPastPaginationState.isLoadingMorePastLessons,
          })}
        </div>`
      : '';

  // 管理者向けのアクションボタン（更新・操作ログ）
  // LogViewと統一されたデザイン
  // 統合リフレッシュ状態を判定（参加者データまたはログデータのどちらかが更新中ならスピン）
  const isRefreshing =
    state['adminLogsRefreshing'] || state['participantDataRefreshing'] || false;

  const refreshIcon = `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`;

  // アクションボタン（更新は全員、操作ログ・ログアウトは管理者のみ）
  const actionButtons = `<div class="flex items-center gap-2">
      ${Components.button({
        action: 'refreshParticipantView',
        text: refreshIcon,
        style: 'secondary',
        size: 'xs',
        disabled: isRefreshing,
      })}
      ${
        isAdmin
          ? `${Components.button({
              text: '操作<br>ログ',
              action: 'goToLogView',
              style: 'primary',
              size: 'xs',
            })}
            ${Components.button({
              text: 'ログ<br>アウト',
              action: 'logout',
              style: 'danger',
              size: 'xs',
            })}`
          : ''
      }
     </div>`;

  // データ取得日時を表示
  const dataFetchedAt =
    state['participantDataFetchedAt'] || state['dataFetchedAt'];
  let fetchedAtHtml = '';
  if (dataFetchedAt) {
    const fetchedDate = new Date(dataFetchedAt);
    const dateStr = `${fetchedDate.getMonth() + 1}/${fetchedDate.getDate()}`;
    const timeStr = `${String(fetchedDate.getHours()).padStart(2, '0')}:${String(fetchedDate.getMinutes()).padStart(2, '0')}`;
    fetchedAtHtml = `<p class="text-[10px] text-gray-400 text-right mb-1">最終更新: ${dateStr} ${timeStr}</p>`;
  }

  return Components.pageContainer({
    maxWidth: '7xl',
    content: `
      ${Components.pageHeader({
        title: 'みんな の よやく・きろく',
        showBackButton: !isAdmin,
        backAction: 'smartGoBack',
        customActionHtml: actionButtons,
      })}
      ${celebrationOverlayHtml}
      ${fetchedAtHtml}
      <div class="flex flex-wrap items-start justify-between gap-1 sm:gap-2 mb-2">
        <div class="flex-grow">
          ${viewToggleHtml}
        </div>
        <div class="flex-grow">
          ${filterHtml}
        </div>
        <button
          id="accordion-toggle-all-btn"
          class="px-2 py-0.5 text-xs font-medium border-2 rounded bg-white text-brand-text border-ui-border hover:bg-gray-50 flex items-center"
          onclick="actionHandlers.toggleAllAccordions()"
          title="すべて開く/閉じる"
        >
          <svg id="accordion-toggle-icon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${
              showPastLessons
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"></path>'
            }
          </svg>
        </button>
      </div>
      ${tableHeaderHtml}
      <div class="space-y-0.5">
        ${lessonsHtml}
        ${emptyMessage}
      </div>
      ${loadMorePastButtonHtml}
      <div class="mt-4">
        ${Components.button({
          text: 'ホーム画面にもどる',
          action: 'smartGoBack',
          style: 'secondary',
          size: 'full',
        })}
      </div>
    `,
  });
}

// Button State Logic Helper
/**
 * ユーザーとレッスンの状態に基づいてボタンの表示内容を決定
 * @param {LessonCore} lesson
 * @param {string|undefined} currentStudentId
 * @param {import('../../types/core/reservation').ReservationCore[]} lessonReservations
 * @returns {{text: string, action: string, class: string}|null}
 */
function _getLocalButtonState(lesson, currentStudentId, lessonReservations) {
  // 1. よやく済みチェック (確定 or 待機)
  const myReservation = lessonReservations.find(
    r =>
      r.studentId === currentStudentId &&
      (r.status === CONSTANTS.STATUS.CONFIRMED ||
        r.status === CONSTANTS.STATUS.WAITLISTED),
  );

  if (myReservation) {
    // よやく済み -> 「よやく へんしゅう」
    return {
      text: 'よやく へんしゅう',
      action: 'goToReservationFormForLesson', // 編集モードで開くかはHandler側で制御、または同じフォームへ
      class:
        'bg-green-600 text-white text-xs py-1 px-3 rounded hover:bg-green-700 shadow-sm font-bold',
    };
  }

  // 2. 空席チェック (簡易判定: 厳密な判定はHandlers/Accounting_Utilitiesで行うが、ここではView用ロジックを使用)
  // _checkIfLessonAvailable相当のロジックが必要だが、ここではプロパティから簡易判定
  // dashboardから_checkIfLessonAvailableをインポートできないため、簡易実装
  const isTimeDual =
    lesson.classroomType === '時間制・2部制' ||
    lesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL;

  let hasVacancy = false;
  if (isTimeDual) {
    // 2部制: どちらかに空きがあれば空席ありとみなす（詳細はフォームで選択）
    const morningSlots =
      (lesson.firstSlots || 0) > 0 || (lesson.beginnerSlots || 0) > 0;
    const afternoonSlots =
      (lesson.secondSlots || 0) > 0 || (lesson.beginnerSlots || 0) > 0;
    hasVacancy = morningSlots || afternoonSlots;
  } else {
    // 通常: 経験者枠か初心者枠に空きがあればOK
    hasVacancy =
      (lesson.firstSlots || 0) > 0 || (lesson.beginnerSlots || 0) > 0;
  }

  // 3. 空き通知登録チェック (未実装: ユーザープロファイル等に保持する必要があるが、現状は特定のよやくステータスがないため判定困難)
  // FIXME: 空き通知登録済みかどうかを判定するデータがないため、今回は「空席あり」か「満席」かで分岐

  if (hasVacancy) {
    // 空席あり -> 「この日で よやく」
    // (空き通知登録済みで空席が出た場合もここに含まれるが、文言は同じで良い)
    return {
      text: 'この日で よやく',
      action: 'goToReservationFormForLesson',
      class:
        'bg-blue-600 text-white text-xs py-1 px-3 rounded hover:bg-blue-700 shadow-sm font-bold',
    };
  } else {
    // 満席 -> 「空き通知 とうろく」
    return {
      text: '空き通知 とうろく',
      action: 'goToReservationFormForLesson', // フォーム側で満席時は待機登録になる想定
      class:
        'bg-yellow-500 text-white text-xs py-1 px-3 rounded hover:bg-yellow-600 shadow-sm font-bold',
    };
  }
}

/**
 * 生徒詳細をモーダル用のコンテンツとして生成
 * @param {any} student - 生徒情報
 * @param {boolean} isAdmin - 管理者権限
 * @returns {string} モーダル用HTML文字列
 * @modified 2025-12-11 UI改善: レスポンシブグリッドレイアウト適用
 */
function renderStudentDetailModalContent(student, isAdmin) {
  if (!student) {
    return `
      <div class="text-center py-4">
        <p class="text-red-600 mb-4">生徒情報が見つかりません</p>
        ${Components.button({
          text: 'ホームへもどる',
          action: 'goToDashboard',
          style: 'primary',
          size: 'full',
        })}
      </div>
    `;
  }

  const displayName = student.nickname || student.displayName || '名前なし';

  // Helper to create a list item if value exists
  /**
   * @param {string} label
   * @param {string | number | null | undefined} value
   */
  const createListItem = (label, value) => {
    return value
      ? `<div class="flex flex-col sm:flex-row sm:gap-2 border-b border-gray-50 sm:border-0 pb-1 sm:pb-0 last:border-0 last:pb-0">
          <span class="font-semibold text-gray-600 text-xs sm:text-sm min-w-[6rem] whitespace-nowrap">${label}</span>
          <span class="text-brand-text text-sm break-all">${escapeHTML(String(value))}</span>
         </div>`
      : '';
  };

  // 基本情報（公開）
  const publicInfoHtml = `
    <div class="mb-4 bg-gray-50 p-3 ${DesignConfig.borderRadius.container}">
      <h3 class="text-sm font-bold text-brand-text mb-2 flex items-center gap-2">
        <span class="w-1 h-4 bg-brand-primary rounded-full"></span>
        基本情報
      </h3>
      <div class="space-y-2">
        ${createListItem('ニックネーム', displayName)}
        ${createListItem('参加回数', student.participationCount ? `${student.participationCount}回` : '')}
        ${createListItem('将来制作したいもの', student.futureCreations)}
      </div>
    </div>
  `;

  // 詳細情報（管理者のみ）
  // グリッドレイアウト（2カラム）を適用
  const detailedInfoHtml = isAdmin
    ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-left">
      <div class="bg-gray-50 p-3 ${DesignConfig.borderRadius.container}">
        <h3 class="text-sm font-bold text-brand-text mb-2 flex items-center gap-2">
          <span class="w-1 h-4 bg-blue-500 rounded-full"></span>
          詳細情報
        </h3>
        <div class="space-y-2">
          ${createListItem('生徒ID', student.studentId)}
          ${createListItem('本名', student.realName)}
          ${createListItem('電話番号', student.phone)}
          ${createListItem('メール', student.email)}
          ${createListItem('住所', student.address)}
          ${createListItem('年代', student.ageGroup)}
          ${createListItem('性別', student.gender)}
          ${createListItem('利き手', student.dominantHand)}
        </div>
      </div>

      <div class="space-y-4">
        <div class="bg-gray-50 p-3 ${DesignConfig.borderRadius.container}">
          <h3 class="text-sm font-bold text-brand-text mb-2 flex items-center gap-2">
            <span class="w-1 h-4 bg-green-500 rounded-full"></span>
            アンケート情報
          </h3>
          <div class="space-y-2">
            ${createListItem('木彫り経験', student.experience || student['木彫り経験'])}
            ${createListItem('過去の作品', student.pastWork || student['過去の制作物'])}
            ${createListItem('想定参加頻度', student.futureParticipation || student.attendanceIntention || student['想定参加頻度'])}
            ${createListItem('登録のきっかけ', student.trigger || student['きっかけ'])}
            ${createListItem('初回メッセージ', student.firstMessage || student['初回メッセージ'])}
          </div>
        </div>

        <div class="bg-gray-50 p-3 ${DesignConfig.borderRadius.container}">
          <h3 class="text-sm font-bold text-brand-text mb-2 flex items-center gap-2">
            <span class="w-1 h-4 bg-orange-500 rounded-full"></span>
            来場・交通情報
          </h3>
          <div class="space-y-2">
            ${createListItem('同行者', student.companion)}
            ${createListItem('来場手段', student.transportation)}
            ${createListItem('送迎', student.pickup)}
            ${createListItem('車', student.car)}
          </div>
        </div>
      </div>
    </div>

    <div class="mb-4 bg-gray-50 p-3 ${DesignConfig.borderRadius.container}">
      <h3 class="text-sm font-bold text-brand-text mb-2 flex items-center gap-2">
        <span class="w-1 h-4 bg-gray-500 rounded-full"></span>
        備考
      </h3>
      <div class="space-y-2">
        ${createListItem('備考', student.notes)}
      </div>
    </div>
  `
    : '';

  // よやく履歴
  const historyHtml =
    student.reservationHistory && student.reservationHistory.length > 0
      ? student.reservationHistory
          .map(
            /**
             * @param {any} res
             */
            res => {
              const dateObj = new Date(res.date);
              const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

              // ステータスバッジの生成
              let statusBadge = '';
              if (res.status) {
                /** @type {Record<string, {text: string, color: 'gray'|'blue'|'green'|'red'|'orange'|'purple'|'yellow'}>} */
                const statusMap = {
                  [CONSTANTS.STATUS.CONFIRMED]: { text: '確定', color: 'blue' },
                  [CONSTANTS.STATUS.COMPLETED]: {
                    text: '完了',
                    color: 'green',
                  },
                  [CONSTANTS.STATUS.CANCELED]: {
                    text: 'キャンセル',
                    color: 'gray',
                  },
                  [CONSTANTS.STATUS.WAITLISTED]: {
                    text: '待機',
                    color: 'yellow',
                  },
                };

                const statusInfo = statusMap[res.status] || {
                  text: res.status,
                  color:
                    /** @type {'gray'|'blue'|'green'|'red'|'orange'|'purple'|'yellow'} */ (
                      'gray'
                    ),
                };

                statusBadge = Components.badge({
                  text: statusInfo.text,
                  color: statusInfo.color,
                  size: 'xs',
                });
              }

              return `
            <div class="border-b border-gray-200 py-2">
              <div class="flex items-center gap-2">
                <div class="font-semibold text-sm">${formattedDate} - ${escapeHTML(res.classroom)}</div>
                ${statusBadge}
              </div>
              ${res.venue ? `<div class="text-xs text-gray-600">${escapeHTML(res.venue)}</div>` : ''}
              ${res.sessionNote ? `<div class="text-xs mt-1">${escapeHTML(res.sessionNote)}</div>` : ''}
            </div>
          `;
            },
          )
          .join('')
      : '<p class="text-sm text-gray-500">よやく履歴がありません</p>';

  // よやく履歴セクション（全ユーザーに公開）
  const reservationHistoryHtml = `
    <div class="mb-4 bg-gray-50 p-3 ${DesignConfig.borderRadius.container}">
      <h3 class="text-sm font-bold text-brand-text mb-2 flex items-center gap-2">
        <span class="w-1 h-4 bg-purple-500 rounded-full"></span>
        よやく履歴
      </h3>
      ${historyHtml}
    </div>
  `;

  return `
    <div class="max-h-[70vh] overflow-y-auto p-0">
      ${publicInfoHtml}
      ${detailedInfoHtml}
      ${reservationHistoryHtml}
    </div>
  `;
}

// /**
//  * 生徒詳細を描画（後方互換性のため残す、使用しない）
//  * @deprecated モーダル表示に移行したため使用しない
//  * @param {any} student - 生徒情報
//  * @param {boolean} isAdmin - 管理者権限
//  * @returns {string} HTML文字列
//  */
// function renderStudentDetail(student, isAdmin) {
//   // この関数は使用されなくなりましたが、後方互換性のため残します
//   return renderStudentDetailModalContent(student, isAdmin);
// }

/**
 * エラー画面を描画
 * @param {string} message - エラーメッセージ
 * @returns {string} HTML文字列
 */
function renderError(message) {
  return Components.pageContainer({
    maxWidth: '7xl',
    content: `
      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        customClass:
          'bg-ui-error-bg text-ui-error-text border-2 border-ui-error-border',
        content: `
          <p class="font-bold mb-2 text-center">エラー</p>
          <p class="text-center">${escapeHTML(message)}</p>
        `,
      })}
    `,
  });
}

// ハンドラからモーダルコンテンツを生成するためにグローバルに公開
appWindow.renderStudentDetailModalContent = renderStudentDetailModalContent;
