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
    const studentInfo =
      reservation.user ||
      getCachedStudentById(reservation.studentId) ||
      undefined;

    const { subject, body } = _buildAdminNotificationContent(
      reservation,
      studentInfo,
      operationType,
      additionalInfo,
    );

    sendAdminNotification(subject, body);

    const userDisplay = _formatUserDisplay(studentInfo);
    Logger.log(
      `管理者通知送信完了: ${operationType} - ${userDisplay} (予約ID: ${reservation.reservationId})`,
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
 * @param {UserCore | undefined} student - 生徒情報
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
  const userDisplay = _formatUserDisplay(student);

  const templates = {
    created: {
      subject: () => {
        const statusText =
          reservation.status === CONSTANTS.STATUS.WAITLISTED
            ? '空き通知希望'
            : '新規予約';
        const firstTimeText = reservation.firstLecture ? '【初回参加】' : '';
        return `${statusText} (${reservation.classroom}) ${firstTimeText}${userDisplay}様`;
      },
      body: () => {
        const actionText =
          reservation.status === CONSTANTS.STATUS.WAITLISTED
            ? '空き通知希望'
            : '新しい予約';

        return (
          `${actionText}が入りました。\n\n` +
          _buildReservationBasicSection(reservation) +
          `\n【ユーザー情報】\n` +
          `名前: ${userDisplay}\n` +
          _buildLessonInfoSection(reservation) +
          _buildReservationContentSection(reservation, additionalInfo) +
          `\n詳細はスプレッドシートを確認してください。`
        );
      },
    },
    cancelled: {
      subject: () =>
        `予約キャンセル (${reservation.classroom}) ${userDisplay}様`,
      body: () => {
        return (
          `予約がキャンセルされました。\n\n` +
          _buildReservationBasicSection(reservation) +
          `キャンセル日時: ${_formatDateTime()}\n` +
          `\n【ユーザー情報】\n` +
          `名前: ${userDisplay}\n` +
          _buildLessonInfoSection(reservation) +
          `\n【キャンセル理由・制作内容】` +
          _buildReservationContentSection(reservation, additionalInfo) +
          `\n詳細はスプレッドシートを確認してください。`
        );
      },
    },
    updated: {
      subject: () => `予約更新 (${reservation.classroom}) ${userDisplay}様`,
      body: () => {
        return (
          `予約が更新されました。\n\n` +
          _buildReservationBasicSection(reservation) +
          `更新日時: ${_formatDateTime()}\n` +
          `\n【ユーザー情報】\n` +
          `名前: ${userDisplay}\n` +
          _buildLessonInfoSection(reservation) +
          `\n【更新内容・メッセージ・制作情報】` +
          _buildReservationContentSection(reservation, additionalInfo) +
          `\n詳細はスプレッドシートを確認してください。`
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

/**
 * ユーザー操作の管理者通知（統一インターフェース）
 * @param {UserCore & {registrationDate?: string, originalPhone?: string, newPhone?: string, withdrawalDate?: string}} userData - ユーザーデータ（UserCore + 操作固有の追加情報）
 * @param {'registered'|'withdrawn'} operationType - 操作種別
 */
export function sendAdminNotificationForUser(userData, operationType) {
  try {
    const { subject, body } = _buildUserNotificationContent(
      userData,
      operationType,
    );

    sendAdminNotification(subject, body);

    const userDisplay = _formatUserDisplay(userData);
    Logger.log(
      `管理者通知送信完了: ${operationType} - ${userDisplay} (生徒ID: ${userData.studentId || 'N/A'})`,
    );
  } catch (error) {
    const userDisplay = _formatUserDisplay(userData);
    Logger.log(
      `管理者通知送信エラー: ${error.message} - ${userDisplay} (生徒ID: ${userData.studentId || 'N/A'})`,
    );
  }
}

/**
 * ユーザー通知のメッセージ内容を生成（操作種別に応じて）
 * @param {UserCore & {registrationDate?: string, originalPhone?: string, newPhone?: string, withdrawalDate?: string}} userData - ユーザーデータ
 * @param {'registered'|'withdrawn'} operationType - 操作種別
 * @returns {{subject: string, body: string}} 件名と本文
 * @private
 */
function _buildUserNotificationContent(userData, operationType) {
  const userDisplay = _formatUserDisplay(userData);

  const templates = {
    registered: {
      subject: () => `新規ユーザー登録 - ${userDisplay}`,
      body: () => {
        return (
          `新しいユーザーが登録されました。\n\n` +
          _buildUserBasicInfoSection(userData) +
          `登録日時: ${userData.registrationDate || _formatDateTime()}\n` +
          _buildUserAttributesSection(userData) +
          _buildUserCreationInfoSection(userData) +
          _buildUserOtherInfoSection(userData) +
          `\n詳細はスプレッドシートの生徒名簿を確認してください。`
        );
      },
    },
    withdrawn: {
      subject: () => `ユーザー退会処理完了 - ${userDisplay}`,
      body: () => {
        return (
          `ユーザーが退会処理を完了しました。\n\n` +
          _buildUserBasicInfoSection(userData) +
          `元電話番号: ${userData.originalPhone || ''}\n` +
          `登録日: ${userData.registrationDate || '不明'}\n` +
          `退会日時: ${userData.withdrawalDate || _formatDateTime()}\n` +
          `\n【処理内容】\n` +
          `電話番号は無効化されました\n` +
          `新しい電話番号: ${userData.newPhone || ''}\n` +
          `\n詳細はスプレッドシートの生徒名簿を確認してください。`
        );
      },
    },
  };

  const template = templates[operationType];
  if (!template) {
    Logger.log(`未知の操作種別: ${operationType}`);
    return {
      subject: 'ユーザー操作通知',
      body: `ユーザー操作が実行されました。\n${userDisplay} (生徒ID: ${userData.studentId || 'N/A'})\n詳細はスプレッドシートを確認してください。`,
    };
  }

  return {
    subject: template.subject(),
    body: template.body(),
  };
}

// ================================================================
// 共通ヘルパー関数
// ================================================================

/**
 * 日時を統一フォーマットで文字列化
 * @param {Date} [date] - 日時オブジェクト（省略時は現在時刻）
 * @returns {string} フォーマット済み日時文字列
 * @private
 */
function _formatDateTime(date) {
  const targetDate = date || new Date();
  return Utilities.formatDate(
    targetDate,
    CONSTANTS.TIMEZONE,
    'yyyy-MM-dd HH:mm:ss',
  );
}

/**
 * ユーザー情報を「本名（ニックネーム）」形式で表示
 * @param {UserCore | undefined} user - ユーザーデータ
 * @returns {string} 表示用文字列
 * @private
 */
function _formatUserDisplay(user) {
  if (!user) return 'N/A';
  const realName = user.realName || 'N/A';
  const nickname = user.nickname || user.nickname;
  return nickname && nickname !== realName
    ? `${realName}（${nickname}）`
    : realName;
}

/**
 * ユーザー基本情報セクションを構築
 * @param {UserCore} userData - ユーザーデータ
 * @returns {string} フォーマット済みセクション
 * @private
 */
function _buildUserBasicInfoSection(userData) {
  const userDisplay = _formatUserDisplay(userData);
  let section = '【基本情報】\n';
  section += `生徒ID: ${userData.studentId || 'N/A'}\n`;
  section += `名前: ${userDisplay}\n`;
  section += `電話番号: ${userData.phone || ''}\n`;
  section += `メールアドレス: ${userData.email || '未登録'}\n`;
  section += `住所: ${userData.address || '未登録'}\n`;
  return section;
}

/**
 * ユーザー属性情報セクションを構築
 * @param {any} userData - ユーザーデータ
 * @returns {string} フォーマット済みセクション
 * @private
 */
function _buildUserAttributesSection(userData) {
  return (
    '\n【属性情報】\n' +
    `年齢層: ${userData.ageGroup || '未登録'}\n` +
    `性別: ${userData.gender || '未登録'}\n` +
    `利き手: ${userData.dominantHand || '未登録'}\n`
  );
}

/**
 * ユーザー制作・参加情報セクションを構築
 * @param {any} userData - ユーザーデータ
 * @returns {string} フォーマット済みセクション
 * @private
 */
function _buildUserCreationInfoSection(userData) {
  return (
    '\n【制作・参加情報】\n' +
    `今後作りたい物: ${userData.futureCreations || '未登録'}\n` +
    `経験: ${userData.experience || '未登録'}\n` +
    `過去の作品: ${userData.pastWork || '未登録'}\n` +
    `今後の参加意向: ${userData.futureParticipation || '未登録'}\n`
  );
}

/**
 * ユーザー設定・その他情報セクションを構築
 * @param {any} userData - ユーザーデータ
 * @returns {string} フォーマット済みセクション
 * @private
 */
function _buildUserOtherInfoSection(userData) {
  const notificationInfo = userData.wantsScheduleNotification
    ? `はい (${userData.notificationDay || '未設定'}曜日 ${userData.notificationHour || '未設定'}時)`
    : 'いいえ';

  return (
    '\n【その他】\n' +
    `きっかけ: ${userData.trigger || '未登録'}\n` +
    `初回メッセージ: ${userData.firstMessage || 'なし'}\n` +
    `予約確認メール希望: ${userData.wantsEmail ? 'はい' : 'いいえ'}\n` +
    `スケジュール通知希望: ${notificationInfo}\n`
  );
}

/**
 * 予約基本情報セクションを構築
 * @param {ReservationCore} reservation - 予約データ
 * @returns {string} フォーマット済みセクション
 * @private
 */
function _buildReservationBasicSection(reservation) {
  let section = '【予約情報】\n';
  section += `予約ID: ${reservation.reservationId}\n`;
  section += `生徒ID: ${reservation.studentId}\n`;
  section += `状態: ${reservation.status}\n`;
  section += `彫刻刀レンタル: ${reservation.chiselRental ? 'あり' : 'なし'}\n`;
  if (reservation.firstLecture) {
    section += `参加区分: 初回参加\n`;
  }
  return section;
}

/**
 * 講座情報セクションを構築
 * @param {ReservationCore} reservation - 予約データ
 * @returns {string} フォーマット済みセクション
 * @private
 */
function _buildLessonInfoSection(reservation) {
  return (
    '\n【講座情報】\n' +
    `教室: ${reservation.classroom}\n` +
    `日付: ${reservation.date}\n` +
    `会場: ${reservation.venue || ''}\n` +
    `時間: ${reservation.startTime || ''} - ${reservation.endTime || ''}\n`
  );
}

/**
 * 予約の制作内容・メッセージセクションを構築
 * @param {ReservationCore} reservation - 予約データ
 * @param {any} [additionalInfo] - 追加情報
 * @returns {string} フォーマット済みセクション
 * @private
 */
function _buildReservationContentSection(reservation, additionalInfo = {}) {
  let section = '\n【メッセージ・制作内容】\n';
  let hasContent = false;

  if (additionalInfo.updateDetails) {
    section += `更新内容: ${additionalInfo.updateDetails}\n`;
    hasContent = true;
  }

  if (additionalInfo.cancelMessage) {
    section += `キャンセル理由: ${additionalInfo.cancelMessage}\n`;
    hasContent = true;
  }

  if (reservation.cancelMessage) {
    section += `記録されたキャンセル理由: ${reservation.cancelMessage}\n`;
    hasContent = true;
  }

  if (reservation.messageToTeacher) {
    section += `先生へのメッセージ: ${reservation.messageToTeacher}\n`;
    hasContent = true;
  }

  if (reservation.workInProgress) {
    section += `制作メモ: ${reservation.workInProgress}\n`;
    hasContent = true;
  }

  if (reservation.materialInfo) {
    section += `材料情報: ${reservation.materialInfo}\n`;
    hasContent = true;
  }

  if (reservation.order) {
    section += `注文内容: ${reservation.order}\n`;
    hasContent = true;
  }

  return hasContent ? section : '';
}
