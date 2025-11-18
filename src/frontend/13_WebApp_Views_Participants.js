/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Participants.js
 * 目的: 参加者リスト画面のビュー生成
 * 主な責務:
 *   - レッスン選択画面のレンダリング
 *   - 参加者リスト画面のレンダリング
 *   - 生徒詳細画面のレンダリング
 * =================================================================
 */

/** @type {SimpleStateManager} */
const participantsStateManager = appWindow.stateManager;

/**
 * @typedef {Object} ClassroomColorConfig
 * @property {string} bg - 背景色クラス
 * @property {string} border - ボーダー色クラス
 * @property {string} text - テキスト色クラス
 * @property {string} badge - バッジ色クラス
 */

/**
 * 教室ごとの色定義
 * @type {{[key: string]: ClassroomColorConfig}}
 */
const CLASSROOM_COLORS = {
  東京教室: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
  },
  つくば教室: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-700',
  },
  沼津教室: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-700',
  },
  default: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-800',
    badge: 'bg-gray-100 text-gray-700',
  },
};

/**
 * 教室の色を取得
 * @param {string} classroom - 教室名
 * @returns {ClassroomColorConfig} 色定義オブジェクト
 */
function getClassroomColor(classroom) {
  return /** @type {ClassroomColorConfig} */ (
    CLASSROOM_COLORS[classroom] || CLASSROOM_COLORS['default']
  );
}

/**
 * 参加者リストメインビュー
 * stateManagerの状態に応じて適切なサブビューを返す
 * @returns {string} HTML文字列
 */
export function getParticipantsView() {
  const state = participantsStateManager.getState();
  const subView = state.participantsSubView || 'list';

  console.log('🎨 参加者リストビュー表示:', subView);

  switch (subView) {
    case 'list':
      return renderLessonList(state.participantsLessons || []);
    case 'reservations':
      return renderReservationsList(
        state.participantsSelectedLesson,
        state.participantsReservations || [],
      );
    case 'studentDetail':
      return renderStudentDetail(
        state.participantsSelectedStudent,
        state.participantsIsAdmin || false,
      );
    default:
      return renderError('不明なビューです');
  }
}

/**
 * バッジHTMLを生成
 * @param {string} text - バッジテキスト
 * @param {'gray'|'blue'|'green'|'orange'} [color='gray'] - バッジカラー
 * @returns {string} HTML文字列
 */
function createBadge(text, color = 'gray') {
  /** @type {Record<string, string>} */
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
  };

  const colorClass = colorClasses[color] || colorClasses['gray'];
  return `<span class=" font-medium rounded-xs px-0.5 py-0 text-xs ${colorClass}">${escapeHTML(text)}</span>`;
}

/**
 * アコーディオン展開時の予約詳細コンテンツを生成（ヘッダーなし、データ行のみ）
 * @param {any} _lesson - レッスン情報（未使用）
 * @param {any[]} reservations - 予約一覧
 * @returns {string} HTML文字列
 */
function renderAccordionContent(_lesson, reservations) {
  if (!reservations || reservations.length === 0) {
    return '<div class="text-center text-gray-500 text-xs py-2">参加者がいません</div>';
  }

  // データ行のみを生成（ヘッダーなし）
  return reservations
    .map(row => {
      const displayName = row.nickname || row.displayName || '名前なし';
      const hasRealName = row.realName && row.realName.trim() !== '';

      // バッジを生成
      const badges = [];
      if (row.firstLecture) {
        badges.push(createBadge('初', 'green'));
      }
      if (row.chiselRental) {
        badges.push(createBadge('刀', 'orange'));
      }
      // 参加回数を表示（初回でない場合）
      if (!row.firstLecture && row.participationCount) {
        badges.push(createBadge(`${row.participationCount}回`, 'blue'));
      }

      const badgesHtml = badges.length > 0 ? badges.join(' ') : '';

      // 参加者情報カラム
      const participantHtml = `
        <div>
          <div class="font-bold text-xs mb-0.5">
            <button
              class="text-blue-600 hover:text-blue-800 hover:underline text-left"
              onclick="actionHandlers.selectParticipantsStudent('${escapeHTML(row.studentId)}')"
            >
              ${escapeHTML(displayName)}
            </button>
          </div>
          ${hasRealName ? `<div class="text-xs text-gray-600 mb-0.5">${escapeHTML(row.realName)}</div>` : ''}
          <div class="gap-0.5 text-xs">
            ${badgesHtml}
          </div>
        </div>
      `;

      // 制作メモカラム
      const memoHtml = `<div class="text-xs ${row.workInProgress ? '' : 'text-gray-400 italic'}">
        ${escapeHTML(row.workInProgress || '—')}
      </div>`;

      // 注文カラム
      const orderHtml = `<div class="text-xs ${row.order ? '' : 'text-gray-400 italic'}">
        ${escapeHTML(row.order || '—')}
      </div>`;

      // グリッドレイアウトでデータ行を生成
      return `
        <div class="grid grid-cols-[100px_1fr_150px] gap-1 border-t border-dashed border-gray-200 py-0.5 px-1 hover:bg-gray-50">
          <div class="text-center">${participantHtml}</div>
          <div>${memoHtml}</div>
          <div>${orderHtml}</div>
        </div>
      `;
    })
    .join('');
}

/**
 * レッスン一覧を描画
 * @param {any[]} lessons - レッスン一覧
 * @returns {string} HTML文字列
 */
function renderLessonList(lessons) {
  if (!lessons || lessons.length === 0) {
    return `
      ${Components.pageHeader({
        title: 'レッスン一覧',
        showBackButton: false,
      })}
      <div class="${DesignConfig.layout.container}">
        ${Components.cardContainer({
          variant: 'default',
          padding: 'spacious',
          customClass: 'bg-white',
          content: `<p class="${DesignConfig.text.body} text-center">レッスンが見つかりません</p>`,
        })}
      </div>
    `;
  }

  // stateManagerから予約データを取得
  const state = participantsStateManager.getState();
  const reservationsMap = state.participantsReservationsMap || {};
  const selectedClassroom = state.selectedParticipantsClassroom || 'all';
  const showPastLessons = state.showPastLessons || false;

  // 教室一覧を取得（重複を除く）
  const classrooms = [
    'all',
    ...new Set(lessons.map(l => l.classroom).filter(Boolean)),
  ];

  // 今日の日付（時刻を00:00:00にリセット）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 未来と過去のレッスンに分ける
  const futureLessons = lessons
    .filter(l => {
      const lessonDate = new Date(l.date);
      lessonDate.setHours(0, 0, 0, 0);
      return lessonDate >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // 昇順

  const pastLessons = lessons
    .filter(l => {
      const lessonDate = new Date(l.date);
      lessonDate.setHours(0, 0, 0, 0);
      return lessonDate < today;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 降順

  // 表示対象のレッスンを選択
  const targetLessons = showPastLessons ? pastLessons : futureLessons;

  // フィルタリングされたレッスン
  const filteredLessons =
    selectedClassroom === 'all'
      ? targetLessons
      : targetLessons.filter(l => l.classroom === selectedClassroom);

  // タブUIの生成
  const tabsHtml = `
    <div class="mb-2 border-b border-gray-200">
      <div class="flex space-x-3">
        <button
          class="pb-1.5 px-1 text-sm border-b-2 transition-colors ${!showPastLessons ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}"
          onclick="actionHandlers.togglePastLessons(false)"
        >
          未来 (${futureLessons.length})
        </button>
        <button
          class="pb-1.5 px-1 text-sm border-b-2 transition-colors ${showPastLessons ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}"
          onclick="actionHandlers.togglePastLessons(true)"
        >
          過去 (${pastLessons.length})
        </button>
      </div>
    </div>
  `;

  // フィルタUIの生成
  const filterHtml = `
    <div class="mb-2">
      <label class="block text-xs font-medium text-gray-700 mb-1">教室</label>
      <select
        class="${DesignConfig.inputs.base} text-sm py-1"
        onchange="actionHandlers.filterParticipantsByClassroom(this.value)"
      >
        ${classrooms
          .map(classroom => {
            const displayName = classroom === 'all' ? 'すべて' : classroom;
            const selected = classroom === selectedClassroom ? 'selected' : '';
            return `<option value="${escapeHTML(classroom)}" ${selected}>${escapeHTML(displayName)}</option>`;
          })
          .join('')}
      </select>
    </div>
  `;

  // 共通テーブルヘッダー（一覧上部に1回のみ表示）
  const tableHeaderHtml = `
    <div class="sticky top-0 bg-white z-10 border-b-2 border-gray-300 px-1 py-0.5 mb-1">
      <div class="grid grid-cols-[100px_1fr_150px] gap-1 text-xs font-medium text-gray-600">
        <div class="text-center">参加者</div>
        <div>制作メモ</div>
        <div>注文</div>
      </div>
    </div>
  `;

  const lessonsHtml = filteredLessons
    .map(lesson => {
      const dateObj = new Date(lesson.date);
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})`;

      // 予約数を計算
      const reservations = reservationsMap[lesson.lessonId] || [];
      const reservationCount = reservations.length;

      // アコーディオンが展開されているか（ローカル変数ではなくDOMから判定）
      const isExpanded = false; // 初期レンダリング時は全て閉じている

      // 教室の色を取得
      const classroomColor = getClassroomColor(lesson.classroom);

      // 完了済みかどうかを判定
      const isCompleted =
        lesson.status === '完了' || lesson.status === 'キャンセル';

      // ステータスによる色分け
      const statusColor =
        lesson.status === '開催予定'
          ? 'bg-green-100 text-green-800'
          : lesson.status === '完了'
            ? 'bg-blue-100 text-blue-800'
            : lesson.status === 'キャンセル'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800';

      // アコーディオンのボタン（パディング削減: p-2 → p-1）
      const accordionButton = `
        <button
          class="p-1 w-full ${isCompleted ? 'opacity-75' : ''} hover:opacity-100"
          onclick="actionHandlers.toggleParticipantsLessonAccordion('${escapeHTML(lesson.lessonId)}')"
          data-lesson-id="${escapeHTML(lesson.lessonId)}"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 flex-1">
              <span class="text-xs font-semibold ${classroomColor.text}">${formattedDate}</span>
              <span class="font-bold text-xs ${classroomColor.text}">${escapeHTML(lesson.classroom)}</span>
              ${lesson.venue ? `<span class="text-gray-600 text-xs">@${escapeHTML(lesson.venue)}</span>` : ''}
              ${isCompleted ? '<span class="text-xs text-gray-500">✓</span>' : ''}
            </div>
            <div class="flex gap-1 items-center">
              <span class="px-1 py-0.5 rounded text-xs font-medium ${classroomColor.badge}">
                ${reservationCount}名
              </span>
              <span class="px-1 py-0.5 rounded text-xs font-medium ${statusColor}">
                ${escapeHTML(lesson.status)}
              </span>
              <svg class="w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''} ${classroomColor.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </button>
      `;

      // アコーディオンコンテンツ（透明背景）
      const accordionContent = `
        <div class="accordion-content bg-transparent hidden">
          ${renderAccordionContent(lesson, reservations)}
        </div>
      `;

      // レッスンカード（余白削減: mb-2 → mb-0.5、padding削除）
      return `
        <div class="mb-0.5" data-lesson-container="${escapeHTML(lesson.lessonId)}">
          <div class="${classroomColor.bg} border-2 ${classroomColor.border} rounded-lg overflow-hidden">
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
      ? `<div class="bg-white border-2 border-ui-border rounded-lg p-2">
           <p class="text-xs text-gray-500 text-center">${escapeHTML(showPastLessons ? '過去の記録がありません' : '未来の予約がありません')}</p>
         </div>`
      : '';

  return `
    ${Components.pageHeader({
      title: 'レッスン一覧',
      showBackButton: false,
    })}
    <div class="${DesignConfig.layout.containerNoPadding}">
      ${tabsHtml}
      ${filterHtml}
      ${tableHeaderHtml}
      <div class="space-y-0.5">
        ${lessonsHtml}
        ${emptyMessage}
      </div>
    </div>
  `;
}

/**
 * 参加者リストを描画
 * @param {any} lesson - レッスン情報
 * @param {any[]} reservations - 予約一覧
 * @returns {string} HTML文字列
 */
function renderReservationsList(lesson, reservations) {
  if (!lesson) {
    return renderError('レッスン情報が見つかりません');
  }

  const dateObj = new Date(lesson.date);
  const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日(${['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})`;

  // テーブルのカラム定義
  /** @type {TableColumn[]} */
  const columns = [
    {
      label: '参加者',
      key: 'participant',
      align: 'center',
      width: '100px',
      render: (_value, row) => {
        const displayName = row.nickname || row.displayName || '名前なし';
        const hasRealName = row.realName && row.realName.trim() !== '';

        // バッジを生成
        const badges = [];
        if (row.firstLecture) {
          badges.push(createBadge('初', 'green'));
        }
        if (row.chiselRental) {
          badges.push(createBadge('刀', 'orange'));
        }
        // 参加回数を表示（初回でない場合）
        if (!row.firstLecture && row.participationCount) {
          badges.push(createBadge(`${row.participationCount}回`, 'blue'));
        }

        const badgesHtml = badges.length > 0 ? badges.join(' ') : '';

        return `
          <div>
            <div class="font-bold text-xs mb-0.5">
              <button
                class="text-blue-600 hover:text-blue-800 hover:underline text-left"
                onclick="actionHandlers.selectParticipantsStudent('${escapeHTML(row.studentId)}')"
              >
                ${escapeHTML(displayName)}
              </button>
            </div>
            ${hasRealName ? `<div class="text-xs text-gray-600 mb-0.5">${escapeHTML(row.realName)}</div>` : ''}
            <div class="gap-0.5 text-xs">
              ${badgesHtml}
            </div>
          </div>
        `;
      },
    },
    {
      label: '制作メモ',
      key: 'workInProgress',
      width: '250px',
      align: 'left',
      render: value => {
        return `<div class="text-sm ${value ? '' : 'text-gray-400 italic'}">
          ${escapeHTML(value || '—')}
        </div>`;
      },
    },
    {
      label: '注文',
      key: 'order',
      width: '150px',
      align: 'left',
      render: value => {
        return `<div class="text-xs ${value ? '' : 'text-gray-400 italic'}">
          ${escapeHTML(value || '—')}
        </div>`;
      },
    },
  ];

  // テーブルHTML生成
  const tableHtml = Components.table({
    columns,
    rows: reservations,
    striped: false,
    bordered: false,
    hoverable: true,
    compact: true,
    responsive: true,
    emptyMessage: '参加者がいません',
  });

  return `
    ${Components.pageHeader({
      title: `${escapeHTML(lesson.classroom)} - ${formattedDate}`,
      backAction: 'backToParticipantsList',
    })}
    <div style="max-width: 1200px;">

      ${lesson.venue ? `<p class="${DesignConfig.text.body} mb-4 text-gray-600">${escapeHTML(lesson.venue)}</p>` : ''}

      ${tableHtml}
    </div>
  `;
}

/**
 * 生徒詳細を描画
 * @param {any} student - 生徒情報
 * @param {boolean} isAdmin - 管理者権限
 * @returns {string} HTML文字列
 */
function renderStudentDetail(student, isAdmin) {
  if (!student) {
    return renderError('生徒情報が見つかりません');
  }

  const displayName = student.nickname || student.displayName || '名前なし';

  // 基本情報（公開）
  const publicInfoHtml = `
    <div class="mb-6">
      <h2 class="${DesignConfig.text.subheading} mb-4">基本情報</h2>
      <div class="space-y-2">
        <div><span class="font-bold">ニックネーム:</span> ${escapeHTML(displayName)}</div>
        <div><span class="font-bold">参加回数:</span> ${student.participationCount}回</div>
        ${student.futureCreations ? `<div><span class="font-bold">将来制作したいもの:</span> ${escapeHTML(student.futureCreations)}</div>` : ''}
      </div>
    </div>
  `;

  // 詳細情報（管理者または本人のみ）
  const detailedInfoHtml =
    isAdmin || student.isSelf
      ? `
    <div class="mb-6">
      <h2 class="${DesignConfig.text.subheading} mb-4">詳細情報</h2>
      <div class="space-y-2 text-sm">
        ${student.realName ? `<div><span class="font-bold">本名:</span> ${escapeHTML(student.realName)}</div>` : ''}
        ${student.phone ? `<div><span class="font-bold">電話番号:</span> ${escapeHTML(student.phone)}</div>` : ''}
        ${student.email ? `<div><span class="font-bold">メール:</span> ${escapeHTML(student.email)}</div>` : ''}
        ${student.address ? `<div><span class="font-bold">住所:</span> ${escapeHTML(student.address)}</div>` : ''}
      </div>
    </div>
  `
      : '';

  // 予約履歴
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

              return `
            <div class="border-b border-gray-200 py-3">
              <div class="font-bold">${formattedDate} - ${escapeHTML(res.classroom)}</div>
              ${res.venue ? `<div class="text-sm text-gray-600">${escapeHTML(res.venue)}</div>` : ''}
              ${res.workInProgress ? `<div class="text-sm mt-1">${escapeHTML(res.workInProgress)}</div>` : ''}
            </div>
          `;
            },
          )
          .join('')
      : '<p class="text-gray-500">予約履歴がありません</p>';

  return `
    ${Components.pageHeader({
      title: escapeHTML(displayName),
      backAction: 'backToParticipantsReservations',
    })}
    <div class="${DesignConfig.layout.container}">

      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        customClass: 'bg-white mb-6',
        content: publicInfoHtml + detailedInfoHtml,
      })}

      ${Components.cardContainer({
        variant: 'default',
        padding: 'spacious',
        customClass: 'bg-white',
        content: `
          <h2 class="${DesignConfig.text.subheading} mb-4">予約履歴</h2>
          ${historyHtml}
        `,
      })}
    </div>
  `;
}

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
