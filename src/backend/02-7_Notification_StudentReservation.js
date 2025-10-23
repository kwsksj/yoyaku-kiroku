/**
 * =================================================================
 * 【ファイル名】  : 02-7_Notification_StudentReservation.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 生徒向けの予約関連メール（確定・キャンセルなど）を生成・送信する。
 *
 * 【主な責務】
 *   - 予約確定・キャンセル・待機通知など、ステータスに応じた件名／本文の生成
 *   - `ADMIN_EMAIL` を送信元として利用し、教室名義でメールを送る
 *   - 送信結果を `logActivity` へ記録し、失敗時には例外を発生させずログで把握できるようにする
 *
 * 【関連モジュール】
 *   - `07_CacheManager.js`: 予約データや生徒データのキャッシュ参照
 *   - `05-2_Backend_Write.js`: 予約操作後の通知で呼び出される
 *   - `02-5_Notification_StudentSchedule.js`: 定期通知用のフォーマッタとして一部関数を共有
 *
 * 【利用時の留意点】
 *   - GmailApp を直接呼び出すため、実行アカウントの送信制限に注意
 *   - メール本文はテキスト形式を前提としている。HTML 対応する場合は追加パラメータが必要
 *   - 予約データに `user` が含まれていない場合はキャッシュ補完が必要になるので呼び出し前に準備する
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { CACHE_KEYS, getTypedCachedData } from './07_CacheManager.js';
import { logActivity } from './08_Utilities.js';

/**
 * 予約確定メール送信機能（ReservationCore対応）
 * @param {ReservationCore} reservation - ユーザー情報を含む予約データ
 * @returns {boolean} 送信成功・失敗
 */
export function sendBookingConfirmationEmail(reservation) {
  try {
    const student = reservation.user;
    const studentId =
      student && typeof student.studentId === 'string' ? student.studentId : '';
    if (!student || !student.email) {
      Logger.log(
        'メール送信スキップ: ユーザー情報またはメールアドレスが空です',
      );
      return false;
    }

    const emailAddress =
      typeof student.email === 'string' ? student.email.trim() : '';
    if (!emailAddress) {
      Logger.log('メール送信スキップ: メールアドレスが無効です');
      return false;
    }

    // PropertiesServiceから送信元メールアドレスを取得
    const fromEmailRaw =
      PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!fromEmailRaw || String(fromEmailRaw).trim() === '') {
      throw new Error('ADMIN_EMAIL が設定されていません');
    }
    const fromEmail = String(fromEmailRaw);

    // メール内容を生成
    const { subject, textBody } =
      createBookingConfirmationTemplate(reservation);

    // GmailAppでメール送信
    GmailApp.sendEmail(emailAddress, subject, textBody, {
      from: fromEmail,
      name: '川崎誠二 木彫り教室',
      replyTo: fromEmail,
    });

    // 送信成功ログ
    const isWaitlisted = reservation.status === CONSTANTS.STATUS.WAITLISTED;
    const isFirstTime = reservation.firstLecture || false;
    const emailTypeText = isWaitlisted
      ? '空き連絡希望登録メール'
      : '予約確定メール';
    const userTypeText = isFirstTime ? '初回者' : '経験者';
    Logger.log(`メール送信成功: ${emailAddress} (${userTypeText})`);
    logActivity(
      studentId || 'unknown-student',
      'メール送信',
      '成功',
      `${emailTypeText}送信完了 (${userTypeText})`,
    );

    return true;
  } catch (error) {
    Logger.log(`メール送信エラー: ${error.message}`);
    if (reservation.user) {
      const errorStudentId =
        typeof reservation.user.studentId === 'string'
          ? reservation.user.studentId
          : 'unknown-student';
      logActivity(
        errorStudentId,
        'メール送信エラー',
        '失敗',
        `失敗理由: ${error.message}`,
      );
    }
    return false;
  }
}

/**
 * メールテンプレート生成（初回者・経験者対応）
 * @param {ReservationCore} reservation - 予約情報
 * @returns {{subject: string, textBody: string}}
 */
export function createBookingConfirmationTemplate(reservation) {
  // 基本情報の抽出
  const { date, classroom, status } = reservation;
  const student = reservation.user;

  // studentが未定義の場合はエラーを投げるか、デフォルトのテキストを返す
  if (!student) {
    Logger.log(
      'createBookingConfirmationTemplate: reservation.user is missing',
    );
    return {
      subject: 'エラー: ユーザー情報不明',
      textBody:
        '予約情報にユーザー情報が含まれていないため、メールを生成できませんでした。',
    };
  }

  const isFirstTime = reservation.firstLecture || false;

  // 日付フォーマット
  const formattedDate = formatDateForEmail(date);
  const isWaitlisted = status === CONSTANTS.STATUS.WAITLISTED;
  const statusText = isWaitlisted ? '空き連絡希望' : 'ご予約';

  // 件名（テスト環境では[テスト]プレフィックス追加）
  const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE ? '' : '[テスト]';
  const subjectType = isWaitlisted ? '空き連絡希望登録完了' : '予約受付完了';
  const subject = `${subjectPrefix}【川崎誠二 木彫り教室】${subjectType}のお知らせ - ${formattedDate} ${classroom}`;

  if (isFirstTime) {
    // 初回者向け詳細メール
    return {
      subject,
      textBody: createFirstTimeEmailText(
        reservation,
        student,
        formattedDate,
        statusText,
      ),
    };
  } else {
    // 経験者向け簡潔メール
    return {
      subject,
      textBody: createRegularEmailText(
        reservation,
        student,
        formattedDate,
        statusText,
      ),
    };
  }
}

/**
 * 初回者向けテキストメール生成
 * @param {ReservationCore} reservation - 予約情報
 * @param {UserCore} student - ユーザー情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} statusText - ステータステキスト
 * @returns {string} メール本文テキスト
 */
export function createFirstTimeEmailText(
  reservation,
  student,
  formattedDate,
  statusText,
) {
  const { realName } = student;
  const isWaitlisted = reservation.status === CONSTANTS.STATUS.WAITLISTED;

  const greeting = isWaitlisted
    ? `木彫り教室へのご参加希望をいただき、ありがとうございます！\n木彫り作家の川崎誠二です。\n私の教室を見つけていただき、また選んでくださり、とてもうれしく思います！！\n\n現在、満席のため空き連絡希望として登録させていただきました。\n空きが出ましたら、ご登録いただいたメールアドレスにご連絡いたします。`
    : `木彫り教室ご参加の申込みをいただき、ありがとうございます！\n木彫り作家の川崎誠二です。\n私の教室を見つけていただき、また選んでくださり、とてもうれしく思います！！`;

  return `${realName}さま\n\n${greeting}\n\n${createBookingDetailsText(reservation, formattedDate, statusText)}\n\n初回の方にはまずは「だるま」の木彫りを制作しながら、木彫りの基本をお話します。単純な形なので、ていねいに木目と刃の入れ方についてくわしく説明しますよ！きれいな断面を出しながら、カクカクしていてそれでいてころりんとしたかたちをつくっていきます。\n\n残りの時間からは自由にお好きなものを製作していただけます。こちらは、どのような形・大きさにするかにもよりますが、初回だけでは完成まで至らない可能性が大きいので、その点はご了承ください。\n\n\n予約の確認やキャンセルは、こちらのページで行えます！（私のお手製Webアプリです！）\n【きぼりのよやく・きろく】(https://www.kibori-class.net/booking)\n\n次回以降の予約や会計記録や参加の記録もこちらからできますよ。\nスマホのブラウザで「ホームに追加」や「ブックマーク」しておくと便利です！\n\n下に教室に関して連絡事項をまとめました。1度目を通しておいてください。\n他にも質問あれば、このメールに直接ご返信ください。\n\nそれではどうぞよろしくお願いいたします！\n\n川崎誠二\n09013755977\n参加当日に場所がわからないなどあれば、こちらにお電話やSMSでご連絡ください。\n\n${getContactAndVenueInfoText()}`;
}

/**
 * 経験者向けテキストメール生成
 * @param {ReservationCore} reservation - 予約情報
 * @param {UserCore} student - ユーザー情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} statusText - ステータステキスト
 * @returns {string} メール本文テキスト
 */
export function createRegularEmailText(
  reservation,
  student,
  formattedDate,
  statusText,
) {
  const { realName } = student;
  const isWaitlisted = reservation.status === CONSTANTS.STATUS.WAITLISTED;

  const greeting = isWaitlisted
    ? `お申し込みありがとうございます！\n現在、満席のため空き連絡希望として登録させていただきました。\n空きが出ましたら、ご登録いただいたメールアドレスにご連絡いたします。`
    : `お申し込みありがとうございます！\nご予約を承りました。`;

  return `${realName}さま\n\n${greeting}\n\n${createBookingDetailsText(reservation, formattedDate, statusText)}\n\n予約の確認やキャンセルは、こちらのページで行えます：\n【きぼりのよやく・きろく】(https://www.kibori-class.net/booking)\n\nメール連絡が不要な場合は、上記のページでログイン後にプロフィール編集で設定を変更できます。\nまた次回以降の予約や会計記録や参加の記録もこちらからできます。\nスマホのブラウザで【きぼりのよやく・きろく】ページを「ホームに追加」や「ブックマーク」しておくと便利です！\n\n何かご不明点があれば、このメールに直接ご返信ください。\nそれではどうぞよろしくお願いいたします！\n\n川崎誠二\nEmail: shiawasenahito3000@gmail.com\nTel: 09013755977\n\n${getContactAndVenueInfoText()}\n`;
}

/**
 * ヘルパー関数群
 */

/**
 * 授業料金額を取得
 * @param {string} classroom - 教室名
 * @returns {string} 授業料テキスト（複数行、例:"授業料（時間制）: ¥600 （30分あたり）\n初回参加費: ¥800"）
 */
export function getTuitionDisplayText(classroom) {
  try {
    // 会計マスタから価格データを取得
    /** @type {AccountingCacheData | null} */
    const accountingData = /** @type {AccountingCacheData | null} */ (
      getTypedCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA)
    );
    if (!accountingData || !accountingData['items']) {
      return '授業料情報が取得できませんでした';
    }

    const masterData = accountingData['items'];
    const lines = [];

    // 基本授業料項目リスト
    const BASE_TUITION_ITEMS = [
      CONSTANTS.ITEMS.MAIN_LECTURE_COUNT,
      CONSTANTS.ITEMS.MAIN_LECTURE_TIME,
      CONSTANTS.ITEMS.MAIN_LECTURE, // 後方互換性
    ];

    // 基本授業料を検索
    const baseTuitionRule = masterData.find(
      /** @param {AccountingMasterItemCore} item */
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
          CONSTANTS.ITEM_TYPES.TUITION &&
        BASE_TUITION_ITEMS.includes(
          String(item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME]),
        ) &&
        typeof item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] ===
          'string' &&
        /** @type {string} */ (
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM]
        ).includes(classroom),
    );

    if (baseTuitionRule) {
      const itemName = String(
        baseTuitionRule[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME],
      );
      const price = Number(
        baseTuitionRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
      );
      const unit = String(
        baseTuitionRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT] || '',
      );
      lines.push(
        `${itemName}: ¥${String(price.toLocaleString())} （${unit}あたり）`,
      );
    }

    // 初回参加費を検索（該当教室に設定がある場合のみ）
    const firstLectureRule = masterData.find(
      /** @param {AccountingMasterItemCore} item */
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
          CONSTANTS.ITEM_TYPES.TUITION &&
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] ===
          CONSTANTS.ITEMS.FIRST_LECTURE &&
        typeof item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] ===
          'string' &&
        /** @type {string} */ (
          item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM]
        ).includes(classroom),
    );

    if (firstLectureRule) {
      const price = Number(
        firstLectureRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
      );
      lines.push(
        `${CONSTANTS.ITEMS.FIRST_LECTURE}: ¥${String(price.toLocaleString())}`,
      );
    }

    return lines.length > 0
      ? lines.join('\n')
      : '授業料情報が見つかりませんでした';
  } catch (error) {
    Logger.log(`授業料取得エラー: ${error.message}`);
    return '授業料情報が取得できませんでした';
  }
}

/**
 * 共通の申込み内容セクション生成（テキスト版）
 * @param {ReservationCore} reservation - 予約情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} statusText - ステータステキスト
 * @returns {string} 申込み内容テキスト
 */
export function createBookingDetailsText(
  reservation,
  formattedDate,
  statusText,
) {
  const { classroom, venue, startTime, endTime } = reservation;

  // 時間表示
  let timeDisplay = '予約webアプリ上か、各教室のページなどをご確認ください';
  if (startTime && endTime) {
    timeDisplay = `${startTime} - ${endTime}`;
  }

  // 実際の授業料金額を取得して表示
  const tuitionText = getTuitionDisplayText(classroom);

  return `【申込み内容】\n教室: ${classroom} ${venue || ''}\n日付: ${formattedDate}\n時間: ${timeDisplay}\n\n【授業料】\n${tuitionText}\n\n受付日時: ${new Date().toLocaleString('ja-JP')}\n\n以上の内容を ${statusText} で承りました。`;
}

/**
 * 日付をメール用にフォーマット
 * @param {string|Date} dateInput - 日付（文字列またはDateオブジェクト）
 */
export function formatDateForEmail(dateInput) {
  try {
    // 文字列またはDateオブジェクトを適切に処理
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

    if (isNaN(date.getTime())) {
      throw new Error(`無効な日付: ${dateInput}`);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];

    return `${year}年${month}月${day}日(${weekday})`;
  } catch (error) {
    Logger.log(`日付フォーマットエラー: ${error.message}`);
    return String(dateInput);
  }
}

/**
 * 連絡事項・会場情報（テキスト版）
 */
export function getContactAndVenueInfoText() {
  return `
----------------------------------------------------
★★教室に関して連絡事項★★

注意事項：
・体調不良の場合、連絡は後日でも構わないので無理をせずお休みください（キャンセル料なし）
・その他、キャンセルの場合はなるべくお早めにご連絡ください
・刃物を使うため怪我の可能性はあります。なにかあった場合は自己責任でお願いいたします

その他の料金：
・彫刻刀レンタル１回 ¥500 （持ち込みや購入の場合は不要）
・材料代 ¥100 ~¥2,000 程度（材料の大きさ、樹種に応じて計算）
・道具類などを購入する場合は、その代金

お支払い：
・現金
・オンラインバンキング送金
・ことら送金 （電話番号やメールアドレス宛に、銀行のスマホアプリから、手数料なしで送金できるサービス。ゆうちょ銀行、三井住友銀行など。詳しくはこちらhttps://www.cotra.ne.jp/p2pservice/）

＊すべて当日

もちもの：
・わくわくした気持ち
・作りたい物の見本や資料
・飲み物
※セーターなど木屑が付きやすい服は避ける

// お持ちであれば
・よく切れる彫刻刀
・その他の木彫り道具類

必要であれば
・おやつ・昼食（外食も可）
・エプロン
・ブランケット（寒い時期）
・椅子に敷くクッション（背が低い方、おしりが痛くなりやすい方はあるとよい）

----------------------------------------------------

会場：
【東京教室 浅草橋】
Parts Studio Tokyo パーツスタジオ2F
〒111-0053 東京都台東区浅草橋１丁目７−７（陶芸スタジオ2Fのギャラリースペース）
Googleマップ
https://maps.app.goo.gl/XNfPoAecrvHTHFPt7
・浅草橋駅より徒歩1,2分
（浅草橋駅はJR中央・総武線、都営浅草線の駅。秋葉原から1駅）

【東京教室 東池袋】
総合不動産  店舗内（池袋サンシャインシティの近く）
〒170-0013 東京都豊島区東池袋３丁目２０－２０ 東池袋ハイツ壱番館 １Ｆ
（建物入り口正面から見て、右側の一段下がっているところにある不動産屋さんの店舗内）
Googleマップ
https://maps.app.goo.gl/4bNG1wMgtH28wnxq9
・池袋駅東口より 15分
・山手線 大塚駅より 15分
・有楽町線 東池袋駅より 10分
・都電荒川線 向原駅より 7分
（いずれも徒歩の場合）

【つくば教室】
〒305-0861 茨城県つくば市谷田部 1051-7
駐車場など詳しい情報はこちらのリンク先
https://sites.google.com/view/kwskikbr/tukuba

【沼津教室】
〒410-0844 静岡県沼津市春日町67-5
駐車場など詳しい情報はこちらのリンク先
https://sites.google.com/view/kwskikbr/numazu

----------------------------------------------------
川崎 誠二 KAWASAKI Seiji
Email shiawasenahito3000@gmail.com
個人 https://shiawasenahito.wordpress.com/（更新停止中）
教室サイト https://www.kibori-class.net/
ONLINE SHOP https://seiji-kawasaki.stores.jp/
----------------------------------------------------
作品など
Instagram @seiji_kawasaki
X (Twitter) @sawsnht
Facebook @woodcarving.kawasaki
----------------------------------------------------
教室（生徒作品紹介）
Instagram @kibori_class
X (Twitter) @kibori_class
----------------------------------------------------`;
}

/**
 * 予約関連メール送信（統一インターフェース）
 * @param {ReservationCore} reservation - 予約データ
 * @param {'confirmation'|'cancellation'} emailType - メール種別
 * @param {string} [cancelMessage] - キャンセル理由（cancellationの場合のみ）
 */
export function sendReservationEmailAsync(
  reservation,
  emailType,
  cancelMessage,
) {
  try {
    const isFirstTime = reservation.firstLecture || false;

    // ★改善ポイント: reservation.user を直接利用する
    const studentWithEmail = reservation.user;
    const studentId =
      studentWithEmail && typeof studentWithEmail.studentId === 'string'
        ? studentWithEmail.studentId
        : 'unknown-student';

    if (!studentWithEmail || !studentWithEmail.email) {
      if (isFirstTime && emailType === 'confirmation' && studentWithEmail) {
        // 初回者でメールアドレス未設定の場合はエラーログ
        Logger.log(`初回者メール送信失敗: メールアドレス未設定 (${studentId})`);
        logActivity(
          studentId,
          'メール送信エラー',
          '失敗',
          '初回者: メールアドレス未設定',
        );
      } else if (studentWithEmail) {
        Logger.log(`メール送信スキップ: メールアドレス未設定 (${studentId})`);
      } else {
        Logger.log('メール送信スキップ: ユーザー情報がありません');
      }
      return;
    }

    // 初回者は必須送信、経験者はメール連絡希望確認
    if (!isFirstTime && !studentWithEmail.wantsEmail) {
      Logger.log(`メール送信スキップ: メール連絡希望なし (${studentId})`);
      return;
    }

    // メール種別に応じて送信
    if (emailType === 'confirmation') {
      sendBookingConfirmationEmail(reservation);
      const isWaitlisted = reservation.status === CONSTANTS.STATUS.WAITLISTED;
      const emailTypeText = isWaitlisted
        ? '空き連絡希望登録メール'
        : '予約確定メール';
      const userTypeText = isFirstTime ? '初回者' : '経験者';
      Logger.log(
        `${emailTypeText}送信完了: ${studentId} (${userTypeText}, 予約ID: ${reservation.reservationId})`,
      );
    } else if (emailType === 'cancellation') {
      sendCancellationEmail(reservation, cancelMessage);
      Logger.log(
        `キャンセルメール送信完了: ${studentWithEmail.studentId} (予約ID: ${reservation.reservationId})`,
      );
    }
  } catch (error) {
    Logger.log(
      `メール送信エラー: ${error.message} (予約ID: ${reservation.reservationId})`,
    );
  }
}

/**
 *キャンセル確認メール送信（実装）
 * @param {ReservationCore} reservation - 予約情報
 * @param {string} [cancelMessage] - キャンセル理由
 * @returns {boolean} 送信成功・失敗
 */
export function sendCancellationEmail(reservation, cancelMessage) {
  try {
    const student = reservation.user;
    const studentId =
      student && typeof student.studentId === 'string' ? student.studentId : '';
    if (!student || !student.email) {
      Logger.log(
        'メール送信スキップ: ユーザー情報またはメールアドレスが空です',
      );
      return false;
    }

    // PropertiesServiceから送信元メールアドレスを取得
    const fromEmailRaw =
      PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!fromEmailRaw || String(fromEmailRaw).trim() === '') {
      throw new Error('ADMIN_EMAIL が設定されていません');
    }
    const fromEmail = String(fromEmailRaw);

    // 日付フォーマット
    const formattedDate = formatDateForEmail(reservation.date);

    // 件名（テスト環境では[テスト]プレフィックス追加）
    const subjectPrefix = CONSTANTS.ENVIRONMENT.PRODUCTION_MODE
      ? ''
      : '[テスト]';
    const subject = `${subjectPrefix}【川崎誠二 木彫り教室】キャンセル受付のお知らせ - ${formattedDate} ${reservation.classroom}`;

    // 本文生成
    const textBody = _createCancellationEmailText(
      reservation,
      formattedDate,
      cancelMessage,
    );

    const emailAddress =
      typeof student.email === 'string' ? student.email.trim() : '';
    if (!emailAddress) {
      throw new Error('メールアドレスが設定されていません');
    }

    // GmailAppでメール送信
    GmailApp.sendEmail(emailAddress, subject, textBody, {
      from: fromEmail,
      name: '川崎誠二 木彫り教室',
      replyTo: fromEmail,
    });

    // 送信成功ログ
    Logger.log(`キャンセルメール送信成功: ${emailAddress}`);
    logActivity(
      studentId || 'unknown-student',
      'メール送信',
      '成功',
      'キャンセル確認メール送信完了',
    );

    return true;
  } catch (error) {
    Logger.log(`キャンセルメール送信エラー: ${error.message}`);
    if (reservation.user) {
      const errorStudentId =
        typeof reservation.user.studentId === 'string'
          ? reservation.user.studentId
          : 'unknown-student';
      logActivity(
        errorStudentId,
        'メール送信エラー',
        '失敗',
        `失敗理由: ${error.message}`,
      );
    }
    return false;
  }
}

/**
 *キャンセル確認メール本文生成
 * @param {ReservationCore} reservation - 予約情報
 * @param {string} formattedDate - フォーマット済み日付
 * @param {string} [cancelMessage] - キャンセル理由
 * @returns {string} メール本文テキスト
 * @private
 */
export function _createCancellationEmailText(
  reservation,
  formattedDate,
  cancelMessage,
) {
  const student = reservation.user;
  if (!student) {
    return 'ユーザー情報が見つかりません';
  }
  const { realName } = student;
  const { classroom, venue, startTime, endTime } = reservation;

  // 時間表示
  let timeDisplay = '予約webアプリ上をご確認ください';
  if (startTime && endTime) {
    timeDisplay = `${startTime} - ${endTime}`;
  }

  // キャンセル理由セクション
  const reasonSection = cancelMessage
    ? `\nキャンセル理由: ${cancelMessage}\n`
    : '';

  return `${realName}さま\n\n予約のキャンセルを承りました。\n\n【キャンセルされた予約】\n教室: ${classroom} ${venue}\n日付: ${formattedDate}\n時間: ${timeDisplay}${reasonSection}\n\nキャンセル受付日時: ${new Date().toLocaleString('ja-JP')}\n\n予約の確認や新しい予約は、こちらのページで行えます：\n【きぼりのよやく・きろく】(https://www.kibori-class.net/booking)\n\nまたのご参加をお待ちしております。\n何かご不明点があれば、このメールに直接ご返信ください。\n\n川崎誠二\nEmail: shiawasenahito3000@gmail.com\nTel: 09013755977\n`;
}

/**
 * 外部サービス連携機能のプレースホルダー
 *
 * 現在は日程マスタベースの設計となっており、
 * 外部カレンダー連携などは無効化されています。
 *
 * 将来的な拡張時には、日程マスタを正として
 * 外部サービスと同期する設計で実装予定です。
 */

// 将来的な機能拡張のためのプレースホルダー
// 外部サービス連携機能は docs/CALENDAR_SYNC_SPECIFICATION.md に仕様を記載済み
// 現時点では実装不要
