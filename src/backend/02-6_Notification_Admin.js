/**
 * =================================================================
 * 【ファイル名】  : 02-6_Notification_Admin.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 予約操作に伴う管理者向け通知メールを一元的に生成・送信する。
 *
 * 【主な責務】
 *   - 操作種別（作成／更新／キャンセル）に応じた件名・本文テンプレートを組み立て
 *   - `ADMIN_EMAIL` 宛の送信を共通化し、テスト環境フラグによる prefix 付与を管理
 *   - 予約データに紐づく生徒情報を補完して通知内容を充実させる
 *
 * 【関連モジュール】
 *   - `01_Code.gs`: 管理者メールアドレスの設定取得
 *   - `08_Utilities.js`: `getCachedStudentById` で生徒情報を参照
 *   - `05-2_Backend_Write.js`: 予約操作後に管理者通知を呼び出す
 *
 * 【利用時の留意点】
 *   - テスト環境では `[テスト]` プレフィックスが付与されるため、本番送信との区別が容易
 *   - 予約データに `user` 情報が無い場合はキャッシュから取得するため、キャッシュ整合に注意
 *   - HTML メール等へ拡張する場合は MailApp の制約を確認する
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { ADMIN_EMAIL } from './01_Code.js';
import { getCachedStudentById } from './08_Utilities.js';

/**
 * 管理者にメールで通知を送信します。
 * @param {string} subject - メールの件名
 * @param {string} body - メールの本文
 */
export function sendAdminNotification(subject, body) {
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
 * @param {{cancelMessage?: string, updateDetails?: string}} [additionalInfo] - 追加情報
 */
export function sendAdminNotificationForReservation(
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
 * @param {{cancelMessage?: string | undefined, updateDetails?: string | undefined}} additionalInfo - 追加情報
 * @returns {{subject: string, body: string}} 件名と本文
 * @private
 */
export function _buildAdminNotificationContent(
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
