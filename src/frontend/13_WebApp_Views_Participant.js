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
 * 参加者リストメインビュー
 * stateManagerの状態に応じて適切なサブビューを返す
 * @returns {string} HTML文字列
 */
export function getParticipantView() {
  const state = participantStateManager.getState();
  const subView = state.participantSubView || 'list';

  console.log('🎨 参加者リストビュー表示:', subView);

  switch (subView) {
    case 'list':
      return renderLessonList(
        /** @type {LessonCore[]} */ (state.participantLessons || []),
      );
    case 'studentDetail':
      return renderStudentDetailModalContent(
        state.participantSelectedStudent,
        state.participantIsAdmin || false,
      );
    default:
      return renderError('不明なビューです');
  }
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

  // 教室一覧を取得（重複を除く）
  const classrooms = [
    'all',
    ...new Set(lessons.map(l => l.classroom).filter(Boolean)),
  ];

  // 今日の日付（時刻を00:00:00にリセット）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    size: 'xs',
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
    size: 'xs',
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
            </div>
          </div>
        </button>
      `;

      // よやくボタンまたは管理ボタン
      let reserveButtonHtml;
      if (isAdmin) {
        // 管理者用「管理」ボタン（モーダルでリスト表示・編集）
        reserveButtonHtml = `
        <div class="pt-1 text-right px-2 pb-1">
          <button class="bg-action-primary-bg text-white text-xs py-1 px-3 rounded hover:bg-action-primary-hover shadow-sm"
                  data-action="showLessonParticipants"
                  data-lesson-id="${lesson.lessonId}">
            管理
          </button>
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
  const dataFetchedAt = state['dataFetchedAt'];
  let fetchedAtHtml = '';
  if (dataFetchedAt) {
    const fetchedDate = new Date(dataFetchedAt);
    const dateStr = `${fetchedDate.getMonth() + 1}/${fetchedDate.getDate()}`;
    const timeStr = `${String(fetchedDate.getHours()).padStart(2, '0')}:${String(fetchedDate.getMinutes()).padStart(2, '0')}`;
    fetchedAtHtml = `<p class="text-[10px] text-gray-400 text-right mb-1">最終更新: ${dateStr} ${timeStr}</p>`;
  }

  return `
    ${Components.pageHeader({
      title: 'みんな の よやく・きろく',
      showBackButton: !isAdmin,
      backAction: 'smartGoBack',
      customActionHtml: actionButtons,
    })}
    <div class="${DesignConfig.layout.containerNoPadding}">
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
      <div class="mt-4">
        ${Components.button({
          text: 'ホーム画面にもどる',
          action: 'smartGoBack',
          style: 'secondary',
          size: 'full',
        })}
      </div>
    </div>
  `;
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
  return `
    <div class="${DesignConfig.layout.container}">
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
    </div>
  `;
}

// ハンドラからモーダルコンテンツを生成するためにグローバルに公開
appWindow.renderStudentDetailModalContent = renderStudentDetailModalContent;
