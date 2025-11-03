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
        <div class="bg-ui-surface border-2 border-ui-border rounded-lg p-6 text-center">
          <p class="${DesignConfig.text.body}">レッスンが見つかりません</p>
        </div>
      </div>
    `;
  }

  // stateManagerから予約データを取得
  const state = participantsStateManager.getState();
  const reservationsMap = state.participantsReservationsMap || {};

  const lessonsHtml = lessons
    .map(lesson => {
      const dateObj = new Date(lesson.date);
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})`;

      // 予約数を計算
      const reservations = reservationsMap[lesson.lessonId] || [];
      const reservationCount = reservations.length;

      return `
        <button
          class="${DesignConfig.cards.base} ${DesignConfig.cards.background} hover:bg-gray-50"
          onclick="actionHandlers.selectParticipantsLesson('${escapeHTML(lesson.lessonId)}')"
        >
          <div class="${DesignConfig.utils.flexBetween} mb-2">
            <span class="${DesignConfig.text.subheading}">${formattedDate}</span>
            <div class="flex gap-2 items-center">
              ${createBadge(`${reservationCount}名`, reservationCount > 0 ? 'blue' : 'gray')}
              <span class="px-2 py-1 rounded text-sm ${lesson.status === '開催予定' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                ${escapeHTML(lesson.status)}
              </span>
            </div>
          </div>
          <div class="${DesignConfig.text.body} mb-1">
            <span class="font-bold">${escapeHTML(lesson.classroom)}</span>
            ${lesson.venue ? `<span class="text-gray-600"> - ${escapeHTML(lesson.venue)}</span>` : ''}
          </div>
        </button>
      `;
    })
    .join('');

  return `
    ${Components.pageHeader({
      title: 'レッスン一覧',
      showBackButton: false,
    })}
    <div class="${DesignConfig.layout.container}">
      <div class="${DesignConfig.cards.container}">
        ${lessonsHtml}
      </div>
    </div>
  `;
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
  return `<span class="inline-block px-2 py-1 text-xs font-medium rounded ${colorClass}">${escapeHTML(text)}</span>`;
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
      align: 'left',
      render: (_value, row) => {
        const displayName = row.nickname || row.displayName || '名前なし';
        const hasRealName = row.realName && row.realName.trim() !== '';

        // バッジを生成
        const badges = [];
        if (row.firstLecture) {
          badges.push(createBadge('初回', 'green'));
        }
        if (row.chiselRental) {
          badges.push(createBadge('レンタル', 'orange'));
        }
        // 参加回数を表示（初回でない場合）
        if (!row.firstLecture && row.participationCount) {
          badges.push(createBadge(`${row.participationCount}回`, 'blue'));
        }

        const badgesHtml = badges.length > 0 ? badges.join(' ') : '';

        return `
          <div>
            <div class="font-bold text-lg mb-1">
              <button
                class="text-blue-600 hover:text-blue-800 hover:underline text-left"
                onclick="actionHandlers.selectParticipantsStudent('${escapeHTML(row.studentId)}')"
              >
                ${escapeHTML(displayName)}
              </button>
            </div>
            ${hasRealName ? `<div class="text-sm text-gray-600 mb-2">${escapeHTML(row.realName)}</div>` : ''}
            <div class="flex flex-wrap gap-1 mt-2">
              ${badgesHtml}
            </div>
          </div>
        `;
      },
    },
    {
      label: '制作メモ',
      key: 'workInProgress',
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
      align: 'left',
      render: value => {
        return `<div class="text-sm ${value ? '' : 'text-gray-400 italic'}">
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
    bordered: true,
    hoverable: true,
    compact: false,
    responsive: true,
    emptyMessage: '参加者がいません',
  });

  return `
    ${Components.pageHeader({
      title: `${escapeHTML(lesson.classroom)} - ${formattedDate}`,
      backAction: 'backToParticipantsList',
    })}
    <div class="${DesignConfig.layout.container}" style="max-width: 1200px;">

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

      <div class="bg-ui-surface border-2 border-ui-border rounded-lg p-6 mb-6">
        ${publicInfoHtml}
        ${detailedInfoHtml}
      </div>

      <div class="bg-ui-surface border-2 border-ui-border rounded-lg p-6">
        <h2 class="${DesignConfig.text.subheading} mb-4">予約履歴</h2>
        ${historyHtml}
      </div>
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
      <div class="bg-ui-error-bg text-ui-error-text border-2 border-ui-error-border rounded-lg p-6 text-center">
        <p class="font-bold mb-2">エラー</p>
        <p>${escapeHTML(message)}</p>
      </div>
    </div>
  `;
}
