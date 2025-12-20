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
    if (!ADMIN_EMAIL) {
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

        return _composeAdminBody(
          [`${actionText}が入りました。`],
          [
            _buildSection(
              '【予約情報】',
              _buildReservationBasicSectionLines(reservation),
            ),
            _buildSection('【ユーザー情報】', _buildUserSectionLines(student)),
            _buildSection(
              '【講座情報】',
              _buildLessonInfoSectionLines(reservation),
            ),
            _buildSection(
              '【メッセージ・制作内容】',
              _buildReservationContentSectionLines(reservation, additionalInfo),
            ),
          ],
        );
      },
    },
    cancelled: {
      subject: () =>
        `予約キャンセル (${reservation.classroom}) ${userDisplay}様`,
      body: () => {
        return _composeAdminBody(
          ['予約がキャンセルされました。'],
          [
            _buildSection(
              '【予約情報】',
              _buildReservationBasicSectionLines(reservation, [
                `キャンセル日時: ${_formatDateTime()}`,
              ]),
            ),
            _buildSection('【ユーザー情報】', _buildUserSectionLines(student)),
            _buildSection(
              '【講座情報】',
              _buildLessonInfoSectionLines(reservation),
            ),
            _buildSection(
              '【キャンセル理由・制作内容】',
              _buildReservationContentSectionLines(reservation, additionalInfo),
            ),
          ],
        );
      },
    },
    updated: {
      subject: () => `予約更新 (${reservation.classroom}) ${userDisplay}様`,
      body: () => {
        return _composeAdminBody(
          ['予約が更新されました。'],
          [
            _buildSection(
              '【予約情報】',
              _buildReservationBasicSectionLines(reservation, [
                `更新日時: ${_formatDateTime()}`,
              ]),
            ),
            _buildSection('【ユーザー情報】', _buildUserSectionLines(student)),
            _buildSection(
              '【講座情報】',
              _buildLessonInfoSectionLines(reservation),
            ),
            _buildSection(
              '【更新内容・メッセージ・制作情報】',
              _buildReservationContentSectionLines(reservation, additionalInfo),
            ),
          ],
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
        return _composeAdminBody(
          ['新しいユーザーが登録されました。'],
          [
            _buildSection(
              '【基本情報】',
              _buildUserBasicInfoLines(userData, [
                `登録日時: ${userData.registrationDate || _formatDateTime()}`,
              ]),
            ),
            _buildSection('【属性情報】', _buildUserAttributesLines(userData)),
            _buildSection(
              '【制作・参加情報】',
              _buildUserCreationInfoLines(userData),
            ),
            _buildSection('【その他】', _buildUserOtherInfoLines(userData)),
          ],
        );
      },
    },
    withdrawn: {
      subject: () => `ユーザー退会処理完了 - ${userDisplay}`,
      body: () => {
        return _composeAdminBody(
          ['ユーザーが退会処理を完了しました。'],
          [
            _buildSection(
              '【基本情報】',
              _buildUserBasicInfoLines(userData, [
                `元電話番号: ${userData.originalPhone || ''}`,
                `登録日: ${userData.registrationDate || '不明'}`,
                `退会日時: ${userData.withdrawalDate || _formatDateTime()}`,
              ]),
            ),
            _buildSection('【処理内容】', [
              '電話番号は無効化されました',
              `新しい電話番号: ${userData.newPhone || ''}`,
            ]),
          ],
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

/**
 * 管理者通知向けに表示名を生成（本名とニックネーム併記）
 * @param {UserCore | undefined} user
 * @returns {string}
 */
export function formatAdminUserDisplay(user) {
  return _formatUserDisplay(user);
}

// ================================================================
// 共通ヘルパー関数
// ================================================================

/**
 * セクション付き本文を組み立てる
 * @param {string[]} introLines - 先頭に配置する1行メッセージ
 * @param {string[]} sections - `【見出し】\n本文` 形式のセクション文字列
 * @returns {string} 完成した本文
 */
function _composeAdminBody(introLines, sections) {
  const intro = introLines.filter(Boolean).join('\n');
  const sectionBody = sections.filter(Boolean).join('\n\n');
  const parts = [];
  if (intro) parts.push(intro);
  if (sectionBody) parts.push(sectionBody);
  parts.push('詳細はスプレッドシートを確認してください。');
  return parts.join('\n\n');
}

/**
 * セクション文字列を生成
 * @param {string} title - セクション見出し
 * @param {string[]} lines - 本文行
 * @returns {string} セクション文字列。本文が空の場合は空文字を返す。
 */
function _buildSection(title, lines) {
  const normalized = (Array.isArray(lines) ? lines : [])
    .map(line => (line === undefined || line === null ? '' : String(line)))
    .filter(line => line.trim() !== '');
  if (normalized.length === 0) return '';
  return `${title}\n${normalized.join('\n')}`;
}

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
  const nickname = user.nickname || 'N/A';
  return nickname && nickname !== realName
    ? `${realName}（${nickname}）`
    : realName;
}

/**
 * 管理者通知用のユーザー情報行を構築
 * @param {UserCore | undefined} user - ユーザーデータ
 * @returns {string[]} ユーザー情報行
 */
function _buildUserSectionLines(user) {
  const realName = user && user.realName ? user.realName : 'N/A';
  const nickname = user && user.nickname ? user.nickname : 'N/A';
  return [
    `本名: ${realName}`,
    `ニックネーム: ${nickname}`,
    user && user.studentId ? `生徒ID: ${user.studentId}` : '生徒ID: N/A',
  ];
}

/**
 * ユーザー基本情報行を構築
 * @param {UserCore} userData - ユーザーデータ
 * @param {string[]} [extraLines] - 追加行
 * @returns {string[]} 本文行
 */
function _buildUserBasicInfoLines(userData, extraLines = []) {
  const realName = userData.realName || 'N/A';
  const nickname = userData.nickname || 'N/A';
  const lines = [
    `生徒ID: ${userData.studentId || 'N/A'}`,
    `本名: ${realName}`,
    `ニックネーム: ${nickname}`,
    `電話番号: ${userData.phone || ''}`,
    `メールアドレス: ${userData.email || '未登録'}`,
    `住所: ${userData.address || '未登録'}`,
  ];
  return lines.concat(extraLines.filter(Boolean));
}

/**
 * ユーザー属性情報行を構築
 * @param {any} userData - ユーザーデータ
 * @returns {string[]} 本文行
 */
function _buildUserAttributesLines(userData) {
  return [
    `年齢層: ${userData.ageGroup || '未登録'}`,
    `性別: ${userData.gender || '未登録'}`,
    `利き手: ${userData.dominantHand || '未登録'}`,
  ];
}

/**
 * ユーザー制作・参加情報行を構築
 * @param {any} userData - ユーザーデータ
 * @returns {string[]} 本文行
 */
function _buildUserCreationInfoLines(userData) {
  return [
    `今後作りたい物: ${userData.futureCreations || '未登録'}`,
    `経験: ${userData.experience || '未登録'}`,
    `過去の作品: ${userData.pastWork || '未登録'}`,
    `今後の参加意向: ${userData.futureParticipation || '未登録'}`,
  ];
}

/**
 * ユーザー設定・その他情報行を構築
 * @param {any} userData - ユーザーデータ
 * @returns {string[]} 本文行
 */
function _buildUserOtherInfoLines(userData) {
  const notificationInfo = userData.wantsScheduleNotification
    ? `はい (${userData.notificationDay || '未設定'}日 ${userData.notificationHour || '未設定'}時)`
    : 'いいえ';

  return [
    `きっかけ: ${userData.trigger || '未登録'}`,
    `初回メッセージ: ${userData.firstMessage || 'なし'}`,
    `予約確認メール希望: ${userData.wantsEmail ? 'はい' : 'いいえ'}`,
    `スケジュール通知希望: ${notificationInfo}`,
  ];
}

/**
 * 予約基本情報行を構築
 * @param {ReservationCore} reservation - 予約データ
 * @param {string[]} [extraLines] - 追加行
 * @returns {string[]} 本文行
 */
function _buildReservationBasicSectionLines(reservation, extraLines = []) {
  const lines = [
    `予約ID: ${reservation.reservationId}`,
    `生徒ID: ${reservation.studentId}`,
    `状態: ${reservation.status}`,
    `彫刻刀レンタル: ${reservation.chiselRental ? 'あり' : 'なし'}`,
  ];
  if (reservation.firstLecture) {
    lines.push('参加区分: 初回参加');
  }
  return lines.concat(extraLines.filter(Boolean));
}

/**
 * 講座情報行を構築
 * @param {ReservationCore} reservation - 予約データ
 * @returns {string[]} 本文行
 */
function _buildLessonInfoSectionLines(reservation) {
  return [
    `教室: ${reservation.classroom}`,
    `日付: ${reservation.date}`,
    `会場: ${reservation.venue || ''}`,
    `時間: ${reservation.startTime || ''} - ${reservation.endTime || ''}`,
  ];
}

/**
 * 予約の制作内容・メッセージ行を構築
 * @param {ReservationCore} reservation - 予約データ
 * @param {any} [additionalInfo] - 追加情報
 * @param {{includeRecordedCancelMessage?: boolean, suppressDuplicateCancelReason?: boolean}} [options] - 表示オプション
 * @returns {string[]} 本文行
 */
function _buildReservationContentSectionLines(
  reservation,
  additionalInfo = {},
  options = {},
) {
  const {
    includeRecordedCancelMessage = true,
    suppressDuplicateCancelReason = true,
  } = options;

  const lines = [];

  if (additionalInfo.updateDetails) {
    lines.push(`更新内容: ${additionalInfo.updateDetails}`);
  }

  if (additionalInfo.cancelMessage) {
    lines.push(`キャンセル理由: ${additionalInfo.cancelMessage}`);
  }

  const shouldIncludeRecordedCancelReason =
    includeRecordedCancelMessage &&
    reservation.cancelMessage &&
    (!suppressDuplicateCancelReason ||
      reservation.cancelMessage !== additionalInfo.cancelMessage);

  if (shouldIncludeRecordedCancelReason) {
    lines.push(`記録されたキャンセル理由: ${reservation.cancelMessage}`);
  }

  if (reservation.messageToTeacher) {
    lines.push(`先生へのメッセージ: ${reservation.messageToTeacher}`);
  }

  if (reservation.sessionNote) {
    lines.push(`制作メモ: ${reservation.sessionNote}`);
  }

  if (reservation.materialInfo) {
    lines.push(`材料情報: ${reservation.materialInfo}`);
  }

  if (reservation.order) {
    lines.push(`注文内容: ${reservation.order}`);
  }

  return lines;
}
