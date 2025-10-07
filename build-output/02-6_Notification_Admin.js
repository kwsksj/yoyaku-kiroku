/// <reference path="../../types/index.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 02-6_Notification_Admin.js
 * 【バージョン】: 1.0
 * 【役割】: 管理者への予約操作通知メール
 * - 予約操作の管理者通知を統一的に処理
 * - 操作種別に応じたメッセージ生成を一元管理
 * - メール送信基盤機能を提供
 * =================================================================
 */

/**
 * 管理者にメールで通知を送信します。
 * @param {string} subject - メールの件名
 * @param {string} body - メールの本文
 */
function sendAdminNotification(subject, body) {
  try {
    if (!ADMIN_EMAIL || ADMIN_EMAIL === 'your-admin-email@example.com') {
      Logger.log(
        '管理者メールアドレスが設定されていないため、通知をスキップしました。',
      );
      return;
    }

    // テスト環境の場合は件名に[テスト]プレフィックス追加
    const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
      ? ''
      : '[テスト]';
    const finalSubject = `${subjectPrefix}[予約システム通知] ${subject}`;

    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: finalSubject,
      body: body,
    });
  } catch (e) {
    Logger.log(`管理者への通知メール送信に失敗しました: ${e.message}`);
  }
}

/**
 * 予約操作の管理者通知（統一インターフェース）
 * @param {ReservationCore} reservation - 予約データ
 * @param {'created'|'cancelled'|'updated'} operationType - 操作種別
 * @param {Object} [additionalInfo] - 追加情報
 * @param {string} [additionalInfo.cancelMessage] - キャンセル理由
 * @param {string} [additionalInfo.updateDetails] - 更新詳細
 */
function sendAdminNotificationForReservation(
  reservation,
  operationType,
  additionalInfo = {},
) {
  try {
    const studentInfo = reservation.user
      ? reservation.user
      : getCachedStudentById(reservation.studentId);

    const student = {
      realName: studentInfo?.realName || studentInfo?.displayName || '',
      displayName: studentInfo?.displayName || '',
    };

    const { subject, body } = _buildAdminNotificationContent(
      reservation,
      student,
      operationType,
      additionalInfo,
    );

    sendAdminNotification(subject, body);

    Logger.log(
      `管理者通知送信完了: ${operationType} - 予約ID ${reservation.reservationId}`,
    );
  } catch (error) {
    Logger.log(
      `管理者通知送信エラー: ${error.message} (予約ID: ${reservation.reservationId})`,
    );
  }
}

/**
 * 管理者通知のメッセージ内容を生成（操作種別に応じて）
 * @param {ReservationCore} reservation - 予約データ
 * @param {{realName: string, displayName: string}} student - 生徒情報
 * @param {'created'|'cancelled'|'updated'} operationType - 操作種別
 * @param {{cancelMessage?: string, updateDetails?: string}} additionalInfo - 追加情報
 * @returns {{subject: string, body: string}} 件名と本文
 * @private
 */
function _buildAdminNotificationContent(
  reservation,
  student,
  operationType,
  additionalInfo,
) {
  const templates = {
    created: {
      subject: () => {
        const statusText =
          reservation.status === CONSTANTS.STATUS.WAITLISTED
            ? '空き連絡希望'
            : '新規予約';
        const firstTimeText = reservation.firstLecture ? '【初回参加】' : '';
        return `${statusText} (${reservation.classroom}) ${firstTimeText}${student.realName}:${student.displayName}様`;
      },
      body: () => {
        const actionText =
          reservation.status === CONSTANTS.STATUS.WAITLISTED
            ? '空き連絡希望'
            : '新しい予約';
        const messageSection = reservation.messageToTeacher
          ? `\n先生へのメッセージ: ${reservation.messageToTeacher}\n`
          : '';
        const firstTime = reservation.firstLecture;

        return (
          `${actionText}が入りました。\n\n` +
          `本名: ${student.realName}\n` +
          `ニックネーム: ${student.displayName}\n` +
          (firstTime ? `参加区分: 初回参加\n` : '') +
          `\n教室: ${reservation.classroom}\n` +
          `日付: ${reservation.date}\n` +
          `会場: ${reservation.venue || ''}\n` +
          `時間: ${reservation.startTime || ''} - ${reservation.endTime || ''}\n` +
          `状態: ${reservation.status}${messageSection}\n` +
          `詳細はスプレッドシートを確認してください。`
        );
      },
    },
    cancelled: {
      subject: () =>
        `予約キャンセル (${reservation.classroom}) ${student.realName}:${student.displayName}様`,
      body: () => {
        const reasonSection = additionalInfo.cancelMessage
          ? `\nキャンセル理由: ${additionalInfo.cancelMessage}\n`
          : '';

        return (
          `予約がキャンセルされました。\n\n` +
          `本名: ${student.realName}\n` +
          `ニックネーム: ${student.displayName}\n` +
          `\n教室: ${reservation.classroom}\n` +
          `日付: ${reservation.date}\n` +
          `会場: ${reservation.venue || ''}\n` +
          `時間: ${reservation.startTime || ''} - ${reservation.endTime || ''}\n` +
          `元のステータス: ${reservation.status}${reasonSection}\n` +
          `詳細はスプレッドシートを確認してください。`
        );
      },
    },
    updated: {
      subject: () =>
        `予約更新 (${reservation.classroom}) ${student.realName}:${student.displayName}様`,
      body: () => {
        const updateSection = additionalInfo.updateDetails
          ? `\n更新内容: ${additionalInfo.updateDetails}\n`
          : '';

        return (
          `予約が更新されました。${updateSection}\n\n` +
          `本名: ${student.realName}\n` +
          `ニックネーム: ${student.displayName}\n` +
          `\n教室: ${reservation.classroom}\n` +
          `日付: ${reservation.date}\n` +
          `会場: ${reservation.venue || ''}\n` +
          `詳細はスプレッドシートを確認してください。`
        );
      },
    },
  };

  const template = templates[operationType];
  if (!template) {
    Logger.log(`未知の操作種別: ${operationType}`);
    return {
      subject: `予約操作通知 (${reservation.classroom})`,
      body: `予約操作が実行されました。\n予約ID: ${reservation.reservationId}\n詳細はスプレッドシートを確認してください。`,
    };
  }

  return {
    subject: template.subject(),
    body: template.body(),
  };
}
