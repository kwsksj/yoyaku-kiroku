/**
 * =================================================================
 * 【ファイル名】  : 02-5_Notification_StudentSchedule.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 生徒向けの月次日程通知メールを生成・送信する。
 *
 * 【主な責務】
 *   - 通知希望設定（通知日・時間）に基づき送信対象者を抽出
 *   - `getLessons` やよやくキャッシュを参照して、個別のよやく状況を本文へ反映
 *   - 実行ログを `logActivity` に記録し、成功／失敗件数を把握できるようにする
 *
 * 【関連モジュール】
 *   - `05-3_Backend_AvailableSlots.js`: 直近のスケジュール取得
 *   - `02-7_Notification_StudentReservation.js`: 本文フォーマット用のユーティリティ（例：日付整形）
 *   - `07_CacheManager.js`: 生徒・よやくキャッシュから基本データを取得
 *
 * 【利用時の留意点】
 *   - `ADMIN_EMAIL`（From アドレス）が未設定の場合は送信しない設計。デプロイ時に確認する
 *   - トリガーは `01_Code.gs` 側で登録されるため、日程変更後はトリガーの整合性をチェック
 *   - 本文テンプレートを更新する際は、改行コードやマルチバイト文字のエンコードに注意
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { formatDateForEmail } from './02-7_Notification_StudentReservation.js';
import { getLessons } from './05-3_Backend_AvailableSlots.js';
import { CACHE_KEYS, getTypedCachedData } from './07_CacheManager.js';
import { getCachedReservationsAsObjects, logActivity } from './08_Utilities.js';

// ================================================================
// リトライキュー管理
// ================================================================

/**
 * PropertiesServiceに保存するリトライキューのキー
 */
const RETRY_QUEUE_KEY = 'NOTIFICATION_RETRY_QUEUE';

/**
 * メール送信残数の安全マージン（この数以下になったら送信を中断）
 */
const QUOTA_SAFETY_MARGIN = 15;

/**
 * リトライ回数の上限（この回数を超えたエントリは破棄）
 */
const MAX_RETRY_COUNT = 3;

/**
 * リトライキューの最大サイズ（PropertiesServiceの9KB制限対策）
 */
const MAX_QUEUE_SIZE = 150;

/**
 * エントリの有効期限（ミリ秒）- 7日
 */
const RETRY_ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * リトライキューに保存するエントリの型
 * @typedef {Object} RetryQueueEntry
 * @property {string} studentId - 生徒ID
 * @property {number} targetHour - 元々の通知希望時刻
 * @property {number} retryCount - リトライ回数
 * @property {number} addedAt - 追加日時（timestamp）
 */

/**
 * リトライキューを取得する（古いエントリとリトライ上限超過は自動削除）
 * @returns {RetryQueueEntry[]} リトライ待ちエントリの配列
 */
function _getRetryQueue() {
  try {
    const queueJson =
      PropertiesService.getScriptProperties().getProperty(RETRY_QUEUE_KEY);
    if (!queueJson) return [];

    const rawQueue = JSON.parse(queueJson);
    const now = Date.now();

    // フィルタリング: 有効期限内 かつ リトライ上限以下のエントリのみ保持
    const validQueue = rawQueue.filter(
      /** @param {RetryQueueEntry} entry */
      entry => {
        // 古い形式（addedAt/retryCountがない）は初回として扱う
        const addedAt = entry.addedAt || now;
        const retryCount = entry.retryCount || 0;

        const isNotExpired = now - addedAt < RETRY_ENTRY_TTL_MS;
        const isUnderRetryLimit = retryCount < MAX_RETRY_COUNT;

        if (!isNotExpired) {
          Logger.log(
            `期限切れエントリを削除: ${entry.studentId} (${Math.floor((now - addedAt) / (24 * 60 * 60 * 1000))}日経過)`,
          );
        }
        if (!isUnderRetryLimit) {
          Logger.log(
            `リトライ上限超過エントリを削除: ${entry.studentId} (${retryCount}回)`,
          );
        }

        return isNotExpired && isUnderRetryLimit;
      },
    );

    // フィルタリングで件数が変わった場合は保存し直す
    if (validQueue.length !== rawQueue.length) {
      Logger.log(
        `リトライキュークリーンアップ: ${rawQueue.length}件 → ${validQueue.length}件`,
      );
      if (validQueue.length > 0) {
        _setRetryQueueRaw(validQueue);
      } else {
        _clearRetryQueue();
      }
    }

    return validQueue;
  } catch (e) {
    Logger.log(`リトライキュー読み込みエラー: ${e.message}`);
    return [];
  }
}

/**
 * リトライキューを保存する（内部用、サイズチェックなし）
 * @param {RetryQueueEntry[]} queue - 保存するキュー
 * @private
 */
function _setRetryQueueRaw(queue) {
  PropertiesService.getScriptProperties().setProperty(
    RETRY_QUEUE_KEY,
    JSON.stringify(queue),
  );
}

/**
 * リトライキューを保存する（サイズ上限チェック付き）
 * @param {RetryQueueEntry[]} queue - 保存するキュー
 */
function _setRetryQueue(queue) {
  try {
    // キューサイズ上限チェック
    let finalQueue = queue;
    if (queue.length > MAX_QUEUE_SIZE) {
      Logger.log(
        `リトライキューがサイズ上限(${MAX_QUEUE_SIZE})を超過: ${queue.length}件`,
      );
      // 古いエントリから削除（addedAtでソートして新しいものを優先）
      finalQueue = [...queue]
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .slice(0, MAX_QUEUE_SIZE);
      Logger.log(`古いエントリを削除して${finalQueue.length}件に縮小`);
    }

    _setRetryQueueRaw(finalQueue);
    Logger.log(`リトライキューを保存: ${finalQueue.length}件`);
  } catch (e) {
    Logger.log(`リトライキュー保存エラー: ${e.message}`);
  }
}

/**
 * リトライキューをクリアする
 */
function _clearRetryQueue() {
  try {
    PropertiesService.getScriptProperties().deleteProperty(RETRY_QUEUE_KEY);
    Logger.log('リトライキューをクリア');
  } catch (e) {
    Logger.log(`リトライキュークリアエラー: ${e.message}`);
  }
}

/**
 * 現在のメール送信残Quotaを取得する
 * @returns {number} 残り送信可能数
 */
function _getRemainingQuota() {
  try {
    return MailApp.getRemainingDailyQuota();
  } catch (e) {
    Logger.log(`Quota取得エラー: ${e.message}`);
    return 0;
  }
}

/**
 * 月次通知メールを送信するメインエントリーポイント（トリガーから実行）
 * 指定された日時に該当する生徒に通知メールを送信
 * リトライキューがある場合は優先的に処理し、Quota上限に近づいたら中断してキューに保存
 * @param {number} targetDay - 通知対象日（5, 15, 25）
 * @param {number} targetHour - 通知対象時刻（9, 12, 18, 21）
 */
export function sendMonthlyNotificationEmails(targetDay, targetHour) {
  // ========================================
  // 0. 排他制御: 同時実行によるキュー競合を防止
  // ========================================
  const lock = LockService.getScriptLock();
  const lockAcquired = lock.tryLock(30000); // 30秒待機

  if (!lockAcquired) {
    Logger.log(
      'ロック取得失敗: 他のプロセスが実行中です。処理をスキップします。',
    );
    return;
  }

  try {
    Logger.log(
      `月次通知メール送信開始: ${targetDay}日 ${targetHour}時のトリガー`,
    );

    // 初期Quota確認
    const initialQuota = _getRemainingQuota();
    Logger.log(`初期メール送信Quota: ${initialQuota}通`);

    if (initialQuota <= QUOTA_SAFETY_MARGIN) {
      Logger.log(
        `Quotaが安全マージン(${QUOTA_SAFETY_MARGIN})以下のため、送信をスキップします`,
      );
      return;
    }

    // ========================================
    // 1. リトライキューから該当時間帯のエントリを取得
    // ========================================
    const retryQueue = _getRetryQueue();
    const retryEntriesForThisHour = retryQueue.filter(
      entry => entry.targetHour === targetHour,
    );
    const remainingRetryEntries = retryQueue.filter(
      entry => entry.targetHour !== targetHour,
    );

    Logger.log(
      `リトライキュー: 全${retryQueue.length}件、今回対象${retryEntriesForThisHour.length}件`,
    );

    // リトライエントリ情報をMapで保持（studentId → RetryQueueEntry）
    /** @type {Map<string, RetryQueueEntry>} */
    const retryEntryMap = new Map();
    for (const entry of retryEntriesForThisHour) {
      retryEntryMap.set(entry.studentId, entry);
    }

    // ========================================
    // 2. 新規送信対象者を抽出
    // ========================================
    // targetDay=0の場合は新規対象者を抽出しない（リトライ処理のみ）
    const newRecipients =
      targetDay > 0 ? _getNotificationRecipients(targetDay, targetHour) : [];
    Logger.log(
      `新規送信対象者数: ${newRecipients.length}名${targetDay === 0 ? ' (リトライ専用モード)' : ''}`,
    );

    // ========================================
    // 3. リトライ対象の生徒情報を取得
    // ========================================
    const studentsCache = getTypedCachedData(CACHE_KEYS.ALL_STUDENTS);
    const allStudentsMap = studentsCache?.students || {};

    /** @type {UserCore[]} */
    const retryRecipients = [];
    /** @type {RetryQueueEntry[]} */
    const cacheNotFoundEntries = []; // キャッシュ未ヒットのエントリを保持

    for (const entry of retryEntriesForThisHour) {
      const student = allStudentsMap[entry.studentId];
      if (student) {
        retryRecipients.push(student);
      } else {
        // キャッシュに見つからない場合はキューに残す（一時的な不整合対策）
        Logger.log(
          `キャッシュ未ヒット: ${entry.studentId} (リトライ${entry.retryCount || 0}回目) - 次回に再試行`,
        );
        cacheNotFoundEntries.push(entry);
      }
    }

    Logger.log(
      `リトライ対象: 有効${retryRecipients.length}名、キャッシュ未ヒット${cacheNotFoundEntries.length}名`,
    );

    // ========================================
    // 4. 送信対象を統合（リトライ優先、重複除去）
    // ========================================
    const processedStudentIds = new Set(retryRecipients.map(s => s.studentId));
    const combinedRecipients = [...retryRecipients];

    for (const student of newRecipients) {
      if (!processedStudentIds.has(student.studentId)) {
        combinedRecipients.push(student);
        processedStudentIds.add(student.studentId);
      }
    }

    Logger.log(`統合後の送信対象者数: ${combinedRecipients.length}名`);

    if (combinedRecipients.length === 0) {
      Logger.log('送信対象者なし。処理を終了します。');
      // リトライキューを更新（キャッシュ未ヒットエントリは保持）
      const updatedQueue = [...remainingRetryEntries, ...cacheNotFoundEntries];
      if (updatedQueue.length > 0) {
        _setRetryQueue(updatedQueue);
      } else {
        _clearRetryQueue();
      }
      return;
    }

    // ========================================
    // 5. 共通データの取得
    // ========================================
    const allReservations = getCachedReservationsAsObjects();

    const lessonsResponse = getLessons();
    if (!lessonsResponse.success || !lessonsResponse.data) {
      Logger.log('日程データの取得に失敗しました');
      return;
    }
    /** @type {LessonCore[]} */
    const scheduleData = lessonsResponse.data;
    Logger.log(`取得した日程データ: ${scheduleData.length}件`);

    const fromEmailRaw =
      PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!fromEmailRaw || String(fromEmailRaw).trim() === '') {
      Logger.log('ADMIN_EMAIL が設定されていません');
      return;
    }
    const fromEmail = String(fromEmailRaw);

    const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
      ? ''
      : '[テスト]';
    const emailSubject = `${subjectPrefix}【川崎誠二 木彫り教室】開催日程・よやく状況のお知らせ`;

    // ========================================
    // 6. メール送信ループ（Quota確認付き）
    // ========================================
    let successCount = 0;
    let failCount = 0;
    /** @type {RetryQueueEntry[]} */
    const newRetryEntries = [];
    let quotaExhausted = false;

    for (let i = 0; i < combinedRecipients.length; i++) {
      const student = combinedRecipients[i];

      // Quota確認（毎回チェック）
      const remainingQuota = _getRemainingQuota();
      if (remainingQuota <= QUOTA_SAFETY_MARGIN) {
        Logger.log(
          `Quota残り${remainingQuota}通。安全マージンに達したため送信を中断`,
        );
        quotaExhausted = true;

        // 残りの生徒をリトライキューに追加（retryCount継続）
        for (let j = i; j < combinedRecipients.length; j++) {
          const sid = combinedRecipients[j].studentId;
          if (sid) {
            const existingEntry = retryEntryMap.get(sid);
            newRetryEntries.push({
              studentId: sid,
              targetHour: targetHour,
              retryCount: existingEntry ? existingEntry.retryCount + 1 : 0,
              addedAt: existingEntry?.addedAt || Date.now(),
            });
          }
        }
        break;
      }

      try {
        const studentReservations = allReservations.filter(
          /** @param {ReservationCore} r */
          r => r.studentId === student.studentId,
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureReservations = studentReservations
          .filter(
            /** @param {ReservationCore} res */
            res => {
              const resDate = new Date(res.date);
              return (
                resDate >= today && res.status !== CONSTANTS.STATUS.CANCELED
              );
            },
          )
          .map(
            /** @param {ReservationCore} res */
            res => ({
              date:
                typeof res.date === 'string'
                  ? res.date
                  : Utilities.formatDate(
                      new Date(res.date),
                      CONSTANTS.TIMEZONE,
                      'yyyy-MM-dd',
                    ),
              startTime: res.startTime || '',
              endTime: res.endTime || '',
              status: res.status,
              classroom: res.classroom,
              venue: res.venue || '',
            }),
          );

        const emailBody = _generateEmailBody(
          student,
          futureReservations,
          scheduleData,
        );

        const emailAddress =
          typeof student.email === 'string' ? student.email.trim() : '';
        if (!emailAddress) {
          throw new Error('メールアドレスが設定されていません');
        }

        GmailApp.sendEmail(emailAddress, emailSubject, emailBody, {
          from: fromEmail,
          name: '川崎誠二 木彫り教室',
          replyTo: fromEmail,
        });

        successCount++;
        Logger.log(`送信成功: ${student.studentId} (${emailAddress})`);
      } catch (error) {
        failCount++;
        Logger.log(
          `送信失敗: ${student.studentId} - ${error.message || error}`,
        );

        // Quota超過判定: エラーメッセージ または getRemainingDailyQuota が0
        const errorMessage = error?.message || String(error);
        const isQuotaError =
          errorMessage.includes('too many times') ||
          errorMessage.includes('quota') ||
          _getRemainingQuota() === 0;

        if (isQuotaError) {
          Logger.log('Quota超過エラーを検出。残りをリトライキューに追加');
          quotaExhausted = true;

          // 現在の生徒と残りの生徒をリトライキューに追加（retryCount継続）
          for (let j = i; j < combinedRecipients.length; j++) {
            const sid = combinedRecipients[j].studentId;
            if (sid) {
              const existingEntry = retryEntryMap.get(sid);
              newRetryEntries.push({
                studentId: sid,
                targetHour: targetHour,
                retryCount: existingEntry ? existingEntry.retryCount + 1 : 0,
                addedAt: existingEntry?.addedAt || Date.now(),
              });
            }
          }
          break;
        }

        const errorStudentId =
          typeof student.studentId === 'string'
            ? student.studentId
            : 'unknown-student';
        logActivity(
          errorStudentId,
          '通知メール送信失敗',
          'エラー',
          typeof error?.message === 'string' ? error.message : String(error),
        );
      }
    }

    // ========================================
    // 7. リトライキューの更新（キャッシュ未ヒットエントリも保持）
    // ========================================
    const finalRetryQueue = [
      ...remainingRetryEntries,
      ...cacheNotFoundEntries,
      ...newRetryEntries,
    ];
    if (finalRetryQueue.length > 0) {
      _setRetryQueue(finalRetryQueue);
      Logger.log(
        `リトライキュー更新: 新規${newRetryEntries.length}件、キャッシュ未ヒット${cacheNotFoundEntries.length}件保持`,
      );
    } else {
      _clearRetryQueue();
    }

    Logger.log(
      `月次通知メール送信完了: 成功 ${successCount}件、失敗 ${failCount}件` +
        (quotaExhausted ? `、リトライ待ち ${newRetryEntries.length}件` : ''),
    );

    // 管理者への通知（失敗またはQuota中断があった場合）
    if (failCount > 0 || quotaExhausted) {
      _notifyAdminAboutFailures(
        successCount,
        failCount,
        newRetryEntries.length,
      );
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
  } finally {
    // ロックを必ず解放
    lock.releaseLock();
    Logger.log('ロック解放完了');
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
  const studentsCache = getTypedCachedData(CACHE_KEYS.ALL_STUDENTS);
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
 * 時刻文字列（HH:mm）を分に変換
 * @param {string|undefined} timeStr - 時刻文字列
 * @returns {number|null} 分換算した値（変換不可時はnull）
 * @private
 */
function _parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [hourStr, minuteStr] = String(timeStr).split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

/**
 * 夜教室か判定（開始時刻が17:00以降）
 * @param {LessonCore} lesson - 日程データ
 * @returns {boolean} 夜教室ならtrue
 * @private
 */
function _isNightLesson(lesson) {
  const candidateTimes = [
    lesson.firstStart,
    lesson.startTime,
    lesson.secondStart,
  ];
  return candidateTimes.some(timeStr => {
    const startMinutes = _parseTimeToMinutes(timeStr);
    return startMinutes !== null && startMinutes >= 17 * 60;
  });
}

/**
 * メール本文を生成
 * @param {UserCore} student - 生徒情報
 * @param {Array<{date: string, startTime: string, endTime: string, status: string, classroom: string, venue: string}>} reservations - 生徒のよやく一覧
 * @param {LessonCore[]} lessons - 今後の日程一覧（getLessons()の結果）
 * @returns {string} メール本文
 * @private
 */
export function _generateEmailBody(student, reservations, lessons) {
  const nickname = student.nickname || student.realName;

  let body = `${nickname}さま\n\n`;
  body += `こんにちは！\n川崎誠二 木彫り教室です。\n`;
  body += `現在のごよやく内容と、今後の教室日程のお知らせです！\n（メール下部に記載）\n\n`;

  body += `ごよやくやキャンセルは、こちらのページで行えます。\n`;
  body += `【きぼりのよやく・きろく】 https://www.kibori-class.net/booking\n\n`;
  body += `メール配信の設定（配信の有無・日時）も、\n`;
  body += `上記のページでログイン後、プロフィール編集画面で変更できます。\n\n`;

  body += `どうぞ今後ともよろしくお願いいたします！\n\n`;

  // ========================================
  // セクション1: 生徒のよやく一覧
  // ========================================
  body += `━━━━━━━━━━━━━━━━━━━━\n`;
  body += `■ 現在のごよやく内容 ■\n\n`;

  if (reservations.length === 0) {
    body += `現在、ごよやくはありません。\n\n`;
  } else {
    for (const res of reservations) {
      if (!res.date) continue;
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
        const lessonDate = new Date(lesson.date);
        const monthDay = `${lessonDate.getMonth() + 1}/${String(lessonDate.getDate()).padStart(2, ' ')}`;
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const weekday = weekdays[lessonDate.getDay()];
        const nightLabel = _isNightLesson(lesson) ? ' 夜' : '';

        // 日付と会場
        let line = `・${monthDay}${weekday}${nightLabel}`;
        if (lesson.venue) {
          line += ` ${lesson.venue}`;
        }
        line += ` | `;

        // 空席情報（教室タイプによって構造が異なる）
        if (lesson.classroomType === CONSTANTS.CLASSROOM_TYPES.TIME_DUAL) {
          // つくば教室: 午前・午後で分かれている
          line += `空き 午前 ${lesson.firstSlots || 0}, 午後 ${lesson.secondSlots || 0}`;
          if ((lesson.beginnerSlots || 0) > 0) {
            line += `, 初回 ${lesson.beginnerSlots}`;
          } else {
            line += `, 経験者のみ`;
          }
        } else {
          // 東京教室・沼津教室など: firstSlots を使用
          const totalSlots = lesson.firstSlots || 0;
          line += `空き ${totalSlots}`;
          if ((lesson.beginnerSlots || 0) > 0) {
            line += `, 初回 ${lesson.beginnerSlots}`;
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
      return 'よやく確定';
    case CONSTANTS.STATUS.WAITLISTED:
      return '空き通知希望';
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
 * @param {number} [retryCount=0] - リトライ待ち件数
 * @private
 */
export function _notifyAdminAboutFailures(
  successCount,
  failCount,
  retryCount = 0,
) {
  try {
    const adminEmail = Session.getEffectiveUser().getEmail();
    if (!adminEmail) return;

    // 件名（テスト環境では[テスト]プレフィックス追加）
    const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
      ? ''
      : '[テスト]';
    const subject = `${subjectPrefix}【システム通知】月次通知メール送信結果`;

    let bodyText =
      `月次通知メールの送信が完了しました。\n\n` +
      `成功: ${successCount}件\n` +
      `失敗: ${failCount}件\n`;

    if (retryCount > 0) {
      bodyText += `リトライ待ち: ${retryCount}件（翌日以降の同時刻に自動送信）\n`;
    }

    bodyText += `\n失敗の詳細はログシートをご確認ください。`;

    MailApp.sendEmail({
      to: adminEmail,
      subject: subject,
      body: bodyText,
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
