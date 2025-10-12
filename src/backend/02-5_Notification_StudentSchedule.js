/// <reference path="../../types/backend-index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 02-5_Notification_StudentSchedule.js
 * 【バージョン】: 1.0
 * 【役割】: 生徒への月次日程通知メール
 * - 生徒への定期通知メール送信
 * - 通知対象者の抽出（連絡希望 & 通知設定あり）
 * - メール本文生成（個人予約 + 教室日程）
 * =================================================================
 */

/**
 * 月次通知メールを送信するメインエントリーポイント（トリガーから実行）
 * 指定された日時に該当する生徒に通知メールを送信
 * @param {number} targetDay - 通知対象日（5, 15, 25）
 * @param {number} targetHour - 通知対象時刻（9, 12, 18, 21）
 */
export function sendMonthlyNotificationEmails(targetDay, targetHour) {
  try {
    Logger.log(
      `月次通知メール送信開始: ${targetDay}日 ${targetHour}時のトリガー`,
    );

    // 送信対象者を抽出
    const recipients = _getNotificationRecipients(targetDay, targetHour);
    Logger.log(`送信対象者数: ${recipients.length}名`);

    if (recipients.length === 0) {
      Logger.log('送信対象者なし。処理を終了します。');
      return;
    }

    // ★改善: 新しいヘルパー関数で予約データをオブジェクトとして直接取得
    const allReservations = getCachedReservationsAsObjects();

    // 共通データの取得（全生徒で共通）- 既存のgetLessons()を活用
    const lessonsResponse = getLessons();
    if (!lessonsResponse.success || !lessonsResponse.data) {
      Logger.log('日程データの取得に失敗しました');
      return;
    }
    /** @type {any[]} */
    const scheduleData = lessonsResponse.data;
    Logger.log(`取得した日程データ: ${scheduleData.length}件`);

    // 送信元メールアドレスを取得
    const fromEmail =
      PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!fromEmail) {
      Logger.log('ADMIN_EMAIL が設定されていません');
      return;
    }

    // 件名（テスト環境では[テスト]プレフィックス追加）
    const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
      ? ''
      : '[テスト]';
    const emailSubject = `${subjectPrefix}【川崎誠二 木彫り教室】開催日程・予約状況のお知らせ`;

    let successCount = 0;
    let failCount = 0;

    // 各生徒にメール送信
    for (const student of recipients) {
      try {
        // ★修正: allReservationsはReservationCore[]なので、filterで正しい型の配列を取得
        const studentReservations = allReservations.filter(
          r => r.studentId === student.studentId,
        );

        // 未来の予約のみに絞り込み
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureReservations = studentReservations
          .filter(res => {
            const resDate = new Date(res.date);
            return resDate >= today && res.status !== CONSTANTS.STATUS.CANCELED; // キャンセル済みは除外
          })
          .map(res => ({
            date:
              typeof res.date === 'string'
                ? res.date
                : Utilities.formatDate(
                    new Date(res.date),
                    CONSTANTS.TIMEZONE,
                    'yyyy-MM-dd',
                  ),
            startTime:
              typeof res.startTime === 'string'
                ? res.startTime
                : Utilities.formatDate(
                    res.startTime,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  ),
            endTime:
              typeof res.endTime === 'string'
                ? res.endTime
                : Utilities.formatDate(
                    res.endTime,
                    CONSTANTS.TIMEZONE,
                    'HH:mm',
                  ),
            status: res.status,
            classroom: res.classroom,
            venue: res.venue || '',
          }));

        const emailBody = _generateEmailBody(
          student,
          futureReservations,
          scheduleData,
        );

        GmailApp.sendEmail(student.email, emailSubject, emailBody, {
          from: fromEmail,
          name: '川崎誠二 木彫り教室',
          replyTo: fromEmail,
        });

        successCount++;
        Logger.log(`送信成功: ${student.studentId} (${student.email})`);
      } catch (error) {
        failCount++;
        Logger.log(
          `送信失敗: ${student.studentId} - ${error.message || error}`,
        );
        logActivity(
          student.studentId,
          '通知メール送信失敗',
          'エラー',
          error.message || String(error),
        );
      }
    }

    Logger.log(
      `月次通知メール送信完了: 成功 ${successCount}件、失敗 ${failCount}件`,
    );

    // 管理者への通知
    if (failCount > 0) {
      _notifyAdminAboutFailures(successCount, failCount);
    }
  } catch (error) {
    Logger.log(`月次通知メール送信でエラー: ${error.message || error}`);
    logActivity(
      'システム',
      '月次通知メール送信エラー',
      'エラー',
      error.message || String(error),
    );
    throw error;
  }
}

/**
 * 通知メール送信対象者を抽出
 * @param {number} targetDay - 通知対象日
 * @param {number} targetHour - 通知対象時刻
 * @returns {UserCore[]} 送信対象生徒の配列
 * @private
 */
export function _getNotificationRecipients(targetDay, targetHour) {
  // 生徒キャッシュから全生徒データを取得
  const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
  const allStudents = studentsCache?.students
    ? Object.values(studentsCache.students)
    : [];

  const recipients = [];

  for (const student of allStudents) {
    // 日程連絡希望フラグチェック
    if (!student.wantsScheduleNotification) {
      continue;
    }

    // メールアドレス存在チェック
    const email = student.email;
    if (!email || String(email).trim() === '') {
      continue;
    }

    // 通知日時チェック
    const notificationDay = student.notificationDay;
    const notificationHour = student.notificationHour;

    // 通知日時が未設定の場合はデフォルト値を使用
    const day =
      notificationDay || notificationDay === 0
        ? Number(notificationDay)
        : CONSTANTS.NOTIFICATION.DEFAULT_DAY;
    const hour =
      notificationHour || notificationHour === 0
        ? Number(notificationHour)
        : CONSTANTS.NOTIFICATION.DEFAULT_HOUR;

    if (day === targetDay && hour === targetHour) {
      recipients.push(student);
    }
  }

  return recipients;
}

/**
 * メール本文を生成
 * @param {UserCore} student - 生徒情報
 * @param {Array<{date: string, startTime: string, endTime: string, status: string, classroom: string, venue: string}>} reservations - 生徒の予約一覧
 * @param {Array<any>} lessons - 今後の日程一覧（getLessons()の結果）
 * @returns {string} メール本文
 * @private
 */
export function _generateEmailBody(student, reservations, lessons) {
  const displayName = student.nickname || student.realName;

  let body = `${displayName}さま\n\n`;
  body += `こんにちは！\n川崎誠二 木彫り教室です。\n`;
  body += `現在のご予約内容と、今後の教室日程のお知らせです！\n（メール下部に記載）\n\n`;

  body += `ご予約やキャンセルは、こちらのページで行えます。\n`;
  body += `【きぼりのよやく・きろく】 https://www.kibori-class.net/booking\n\n`;
  body += `メール配信の設定（配信の有無・日時）も、\n`;
  body += `上記のページでログイン後、プロフィール編集画面で変更できます。\n\n`;

  body += `どうぞ今後ともよろしくお願いいたします！\n\n`;

  // ========================================
  // セクション1: 生徒の予約一覧
  // ========================================
  body += `━━━━━━━━━━━━━━━━━━━━\n`;
  body += `■ 現在のご予約内容 ■\n\n`;

  if (reservations.length === 0) {
    body += `現在、ご予約はありません。\n\n`;
  } else {
    for (const res of reservations) {
      const dateStr = formatDateForEmail(res.date);
      const timeStr = _formatTimeRange(res.startTime, res.endTime);
      const statusStr = _formatStatus(res.status);

      body += `教室: ${res.classroom} ${res.venue}\n`;
      body += `日付: ${dateStr}\n`;
      body += `時間: ${timeStr}\n`;
      body += `状態: ${statusStr}\n\n`;
    }
  }

  // ========================================
  // セクション2: 今後の教室日程（メイン情報）
  // ========================================
  body += `━━━━━━━━━━━━━━━━━━━━\n`;
  const now = new Date();
  const currentTimeStr = `${now.getMonth() + 1}/${String(now.getDate()).padStart(2, ' ')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  body += `■ 今後の日程 と 空席情報 ■\n`;
  body += `（${currentTimeStr} 時点）\n\n`;

  if (lessons.length === 0) {
    body += `現在、予定されている日程はありません。\n\n`;
  } else {
    // 教室ごとにグループ化
    /** @type {{ [key: string]: LessonCore[] }} */
    const lessonsByClassroom = {};
    lessons.forEach(lesson => {
      const classroom = lesson.classroom;
      if (!lessonsByClassroom[classroom]) {
        lessonsByClassroom[classroom] = [];
      }
      lessonsByClassroom[classroom].push(lesson);
    });

    // 教室の順序を定義
    const classroomOrder = [
      { name: CONSTANTS.CLASSROOMS.TOKYO, label: '◆ 東京教室' },
      { name: CONSTANTS.CLASSROOMS.NUMAZU, label: '◆ 沼津教室' },
      { name: CONSTANTS.CLASSROOMS.TSUKUBA, label: '◆ つくば教室' },
    ];

    for (const classroomInfo of classroomOrder) {
      const classroom = classroomInfo.name;
      if (!lessonsByClassroom[classroom]) continue;

      body += `${classroomInfo.label}\n`;

      for (const lesson of lessonsByClassroom[classroom]) {
        /** @type {LessonCore} */
        const lessonCore = /** @type {any} */ (lesson);
        const lessonDate = new Date(lessonCore.date);
        const monthDay = `${lessonDate.getMonth() + 1}/${String(lessonDate.getDate()).padStart(2, ' ')}`;
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const weekday = weekdays[lessonDate.getDay()];

        // 日付と会場
        let line = `・${monthDay}${weekday}`;
        if (lessonCore.venue) {
          line += ` ${lessonCore.venue}`;
        }
        line += ` | `;

        // 空席情報（教室タイプによって構造が異なる）
        if (lessonCore.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
          // つくば教室: 午前・午後で分かれている
          line += `空き 午前 ${lessonCore.firstSlots || 0}, 午後 ${lessonCore.secondSlots || 0}`;
          if ((lessonCore.beginnerSlots || 0) > 0) {
            line += `, 初回 ${lessonCore.beginnerSlots}`;
          } else {
            line += `, 経験者のみ`;
          }
        } else {
          // 東京教室・沼津教室など: firstSlots を使用
          const totalSlots = lessonCore.firstSlots || 0;
          line += `空き ${totalSlots}`;
          if ((lessonCore.beginnerSlots || 0) > 0) {
            line += `, 初回 ${lessonCore.beginnerSlots}`;
          } else {
            line += `, 経験者のみ`;
          }
        }

        body += line + `\n`;
      }
      body += `\n`;
    }
  }

  // ========================================
  // フッター
  // ========================================
  body += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  body += `質問などありましたら、このメールに返信でも構わないのでご連絡ください。\n\n`;
  body += `──────────────────────────\n`;
  body += `川崎誠二 木彫り教室\n`;
  body += `shiawasenahito3000@gmail.com\n`;
  body += `090 1375 5977\n`;
  body += `──────────────────────────\n`;

  return body;
}

/**
 * 時刻範囲をフォーマット（例: 13:00-15:30）
 * @param {string|Date} startTime - 開始時刻
 * @param {string|Date} endTime - 終了時刻
 * @returns {string} フォーマット済み時刻文字列
 * @private
 */
export function _formatTimeRange(startTime, endTime) {
  const start =
    typeof startTime === 'string'
      ? startTime
      : Utilities.formatDate(startTime, CONSTANTS.TIMEZONE, 'HH:mm');
  const end =
    typeof endTime === 'string'
      ? endTime
      : Utilities.formatDate(endTime, CONSTANTS.TIMEZONE, 'HH:mm');

  return `${start} - ${end}`;
}

/**
 * ステータスをフォーマット
 * @param {string} status - ステータス
 * @returns {string} フォーマット済みステータス文字列
 * @private
 */
export function _formatStatus(status) {
  switch (status) {
    case CONSTANTS.STATUS.CONFIRMED:
      return '予約確定';
    case CONSTANTS.STATUS.WAITLISTED:
      return '空席連絡希望';
    case CONSTANTS.STATUS.COMPLETED:
      return '受講済み';
    default:
      return status;
  }
}

/**
 * 管理者へ送信失敗を通知
 * @param {number} successCount - 成功件数
 * @param {number} failCount - 失敗件数
 * @private
 */
export function _notifyAdminAboutFailures(successCount, failCount) {
  try {
    const adminEmail = Session.getEffectiveUser().getEmail();
    if (!adminEmail) return;

    // 件名（テスト環境では[テスト]プレフィックス追加）
    const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
      ? ''
      : '[テスト]';
    const subject = `${subjectPrefix}【システム通知】月次通知メール送信結果`;

    MailApp.sendEmail({
      to: adminEmail,
      subject: subject,
      body:
        `月次通知メールの送信が完了しました。\n\n` +
        `成功: ${successCount}件\n` +
        `失敗: ${failCount}件\n\n` +
        `失敗の詳細はログシートをご確認ください。`,
    });
  } catch (error) {
    Logger.log(`管理者通知送信エラー: ${error.message || error}`);
  }
}

/**
 * 【開発・テスト用】手動で通知メールを送信
 * メニューから実行可能
 */
export function manualSendMonthlyNotificationEmails() {
  const ui = SpreadsheetApp.getUi();

  // 通知日の選択
  const dayResponse = ui.prompt(
    '通知日の選択',
    '通知日を選択してください（5, 15, 25）:',
    ui.ButtonSet.OK_CANCEL,
  );

  if (dayResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('処理を中断しました。');
    return;
  }

  const targetDay = parseInt(dayResponse.getResponseText());
  if (![5, 15, 25].includes(targetDay)) {
    ui.alert('無効な通知日です。5, 15, 25 のいずれかを入力してください。');
    return;
  }

  // 通知時刻の選択
  const hourResponse = ui.prompt(
    '通知時刻の選択',
    '通知時刻を選択してください（9, 12, 18, 21）:',
    ui.ButtonSet.OK_CANCEL,
  );

  if (hourResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('処理を中断しました。');
    return;
  }

  const targetHour = parseInt(hourResponse.getResponseText());
  if (![9, 12, 18, 21].includes(targetHour)) {
    ui.alert(
      '無効な通知時刻です。9, 12, 18, 21 のいずれかを入力してください。',
    );
    return;
  }

  // 確認
  const confirmResponse = ui.alert(
    '送信確認',
    `${targetDay}日 ${targetHour}時の設定で通知メールを送信します。よろしいですか？`,
    ui.ButtonSet.YES_NO,
  );

  if (confirmResponse !== ui.Button.YES) {
    ui.alert('処理を中断しました。');
    return;
  }

  try {
    sendMonthlyNotificationEmails(targetDay, targetHour);
    ui.alert('通知メールの送信が完了しました。ログを確認してください。');
  } catch (error) {
    ui.alert(`エラーが発生しました: ${error.message || error}`);
  }
}
