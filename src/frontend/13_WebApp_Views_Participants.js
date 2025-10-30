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
      <div class="${DesignConfig.layout.container}">
        <h1 class="${DesignConfig.text.heading} mb-6">レッスン一覧</h1>
        <div class="bg-ui-surface border-2 border-ui-border rounded-lg p-6 text-center">
          <p class="${DesignConfig.text.body}">レッスンが見つかりません</p>
        </div>
      </div>
    `;
  }

  const lessonsHtml = lessons
    .map(lesson => {
      const dateObj = new Date(lesson.date);
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})`;

      return `
        <button
          class="${DesignConfig.cards.base} ${DesignConfig.cards.background} hover:bg-gray-50"
          onclick="actionHandlers.selectParticipantsLesson('${escapeHTML(lesson.lessonId)}')"
        >
          <div class="${DesignConfig.utils.flexBetween} mb-2">
            <span class="${DesignConfig.text.subheading}">${formattedDate}</span>
            <span class="px-2 py-1 rounded text-sm ${lesson.status === '開催予定' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${escapeHTML(lesson.status)}
            </span>
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
    <div class="${DesignConfig.layout.container}">
      <h1 class="${DesignConfig.text.heading} mb-6 text-center">レッスン一覧</h1>
      <div class="${DesignConfig.cards.container}">
        ${lessonsHtml}
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

  const reservationsHtml =
    reservations.length > 0
      ? reservations
          .map(res => {
            const displayName = res.nickname || res.displayName || '名前なし';
            const hasRealName = res.realName && res.realName.trim() !== '';

            return `
            <tr class="border-b border-ui-border hover:bg-gray-50">
              ${hasRealName ? `<td class="py-3 px-4">${escapeHTML(res.realName)}</td>` : ''}
              <td class="py-3 px-4">
                <button
                  class="text-blue-600 hover:text-blue-800 underline"
                  onclick="actionHandlers.selectParticipantsStudent('${escapeHTML(res.studentId)}')"
                >
                  ${escapeHTML(displayName)}
                </button>
              </td>
              <td class="py-3 px-4 text-center">${res.firstLecture ? '●' : ''}</td>
              <td class="py-3 px-4 text-center">${res.chiselRental ? '●' : ''}</td>
              <td class="py-3 px-4">${escapeHTML(res.workInProgress || '')}</td>
              <td class="py-3 px-4">${escapeHTML(res.order || '')}</td>
            </tr>
          `;
          })
          .join('')
      : `<tr><td colspan="6" class="py-6 text-center text-gray-500">参加者がいません</td></tr>`;

  const hasRealNameColumn = reservations.some(
    r => r.realName && r.realName.trim() !== '',
  );

  return `
    <div class="${DesignConfig.layout.container}" style="max-width: 1200px;">
      <button
        class="${DesignConfig.buttons.secondary} mb-4"
        onclick="actionHandlers.backToParticipantsList()"
      >
        ← レッスン一覧に戻る
      </button>

      <h1 class="${DesignConfig.text.heading} mb-2">${escapeHTML(lesson.classroom)}</h1>
      <p class="${DesignConfig.text.body} mb-4 text-gray-600">${formattedDate} ${lesson.venue ? `- ${escapeHTML(lesson.venue)}` : ''}</p>

      <div class="overflow-x-auto bg-ui-surface border-2 border-ui-border rounded-lg">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              ${hasRealNameColumn ? '<th class="py-3 px-4 text-left font-bold">本名</th>' : ''}
              <th class="py-3 px-4 text-left font-bold">ニックネーム</th>
              <th class="py-3 px-4 text-center font-bold">初回</th>
              <th class="py-3 px-4 text-center font-bold">彫刻刀</th>
              <th class="py-3 px-4 text-left font-bold">制作メモ</th>
              <th class="py-3 px-4 text-left font-bold">注文</th>
            </tr>
          </thead>
          <tbody>
            ${reservationsHtml}
          </tbody>
        </table>
      </div>
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
    <div class="${DesignConfig.layout.container}">
      <button
        class="${DesignConfig.buttons.secondary} mb-4"
        onclick="actionHandlers.backToParticipantsReservations()"
      >
        ← 参加者リストに戻る
      </button>

      <h1 class="${DesignConfig.text.heading} mb-6">${escapeHTML(displayName)}</h1>

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
