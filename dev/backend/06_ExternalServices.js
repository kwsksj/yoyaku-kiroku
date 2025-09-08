/**
 * =================================================================
 * 【ファイル名】: 06_ExternalServices.js
 * 【バージョン】: 4.0
 * 【役割】: GoogleフォームやGoogleカレンダーといった、スプレッドシートの
 * 「外」にあるGoogleサービスとの連携に特化した機能。
 * 【v4.0での変更点】:
 * - 廃止済み関数を削除し、ファイルをクリーンアップ
 * - 将来的な外部サービス連携のためのプレースホルダーとして保持
 * =================================================================
 *
 * @global getStudentWithEmail - Cache manager function from 07_CacheManager.js
 * @global getScheduleInfoForDate - Business logic function from 02-4_BusinessLogic_ScheduleMaster.js
 */

/* global getStudentWithEmail, getScheduleInfoForDate */

/**
 * =================================================================
 * メール送信機能
 * =================================================================
 */

/**
 * 予約確定メール送信機能
 * @param {Object} reservation - 予約情報
 * @param {Object} student - 生徒情報（メールアドレス含む）
 * @param {boolean} isFirstTime - 初回予約フラグ
 * @returns {boolean} 送信成功・失敗
 */
function sendBookingConfirmationEmail(reservation, student, isFirstTime) {
  try {
    if (!student.email) {
      Logger.log('メール送信スキップ: メールアドレスが空です');
      return false;
    }

    // PropertiesServiceから送信元メールアドレスを取得
    const fromEmail =
      PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!fromEmail) {
      throw new Error('ADMIN_EMAIL が設定されていません');
    }

    // メール内容を生成
    const { subject, htmlBody, textBody } = createBookingConfirmationTemplate(
      reservation,
      student,
      isFirstTime,
    );

    // GmailAppでメール送信
    GmailApp.sendEmail(student.email, subject, textBody, {
      htmlBody: htmlBody,
      from: fromEmail,
      name: '川崎誠二 木彫り教室',
      replyTo: fromEmail,
    });

    // 送信成功ログ
    Logger.log(
      `メール送信成功: ${student.email} (${isFirstTime ? '初回者' : '経験者'})`,
      'INFO',
      'sendConfirmationEmail',
      new Date(),
    );
    logActivity(
      student.studentId,
      'メール送信',
      '成功',
      `予約確定メール送信完了 (${isFirstTime ? '初回者' : '経験者'})`,
    );

    return true;
  } catch (error) {
    Logger.log(
      `メール送信エラー: ${error.message}`,
      'ERROR',
      'sendConfirmationEmail',
      new Date(),
    );
    logActivity(
      student.studentId,
      'メール送信エラー',
      '失敗',
      `失敗理由: ${error.message}`,
    );
    return false;
  }
}

/**
 * メールテンプレート生成（初回者・経験者対応）
 * @param {Object} reservation - 予約情報
 * @param {Object} student - 生徒情報
 * @param {boolean} isFirstTime - 初回予約フラグ
 * @returns {Object} subject, htmlBody, textBody を含むオブジェクト
 */
function createBookingConfirmationTemplate(reservation, student, isFirstTime) {
  // 基本情報の抽出
  const { date, classroom } = reservation;

  // 日付フォーマット
  const formattedDate = formatDateForEmail(date);
  const statusText = reservation.isWaiting ? 'キャンセル待ち' : 'ご予約';

  // 件名
  const subject = `【川崎誠二 木彫り教室】受付完了のお知らせ - ${formattedDate} ${classroom}`;

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
 */
function createFirstTimeEmailText(
  reservation,
  student,
  formattedDate,
  statusText,
) {
  const { realName } = student;

  return `${realName}さま

木彫り教室ご参加の申込みをいただき、ありがとうございます！
木彫り作家の川崎誠二です。
私の教室を見つけていただき、また選んでくださり、とてもうれしく思います！！

${createBookingDetailsText(reservation, formattedDate, statusText)}

初回の方にはまずは「だるま」の木彫りを制作しながら、木彫りの基本をお話します。単純な形なので、ていねいに木目と刃の入れ方についてくわしく説明しますよ！きれいな断面を出しながら、カクカクしていてそれでいてころりんとしたかたちをつくっていきます。

残りの時間からは自由にお好きなものを製作していただけます。こちらは、どのような形・大きさにするかにもよりますが、初回だけでは完成まで至らない可能性が大きいので、その点はご了承ください。


予約の確認やキャンセルは、こちらのページで行えます！（私のお手製Webアプリです！）
【きぼりのよやく・きろく】(https://www.kibori-class.net/booking)

次回以降の予約や会計記録や参加の記録もこちらからできますよ。
スマホのブラウザで「ホームに追加」や「ブックマーク」しておくと便利です！

下に教室に関して連絡事項をまとめました。1度目を通しておいてください。
他にも質問あれば、このメールに直接ご返信ください。

それではどうぞよろしくお願いいたします！

川崎誠二
09013755977
参加当日に場所がわからないなどあれば、こちらにお電話やSMSでご連絡ください。

${getContactAndVenueInfoText()}`;
}

/**
 * 経験者向けテキストメール生成
 */
function createRegularEmailText(
  reservation,
  student,
  formattedDate,
  statusText,
) {
  const { realName } = student;

  return `${realName}さま

お申し込みありがとうございます！
ご予約を承りました。

${createBookingDetailsText(reservation, formattedDate, statusText)}

予約の確認やキャンセルは、こちらのページで行えます：
【きぼりのよやく・きろく】(https://www.kibori-class.net/booking)

メール連絡が不要な場合は、上記のページでログイン後にプロフィール編集で設定を変更できます。
また次回以降の予約や会計記録や参加の記録もこちらからできます。
スマホのブラウザで【きぼりのよやく・きろく】ページを「ホームに追加」や「ブックマーク」しておくと便利です！

何かご不明点があれば、このメールに直接ご返信ください。
それではどうぞよろしくお願いいたします！

川崎誠二
Email: shiawasenahito3000@gmail.com
Tel: 09013755977

${getContactAndVenueInfoText()}
`;
}

/**
 * ヘルパー関数群
 */

/**
 * 授業料金額を取得
 * @param {string} classroom - 教室名
 * @param {boolean} isFirstTime - 初回受講フラグ
 * @returns {string} 授業料テキスト（例："初回授業料 ¥6,000"）
 */
function getTuitionDisplayText(classroom, isFirstTime) {
  try {
    // 会計マスタから価格データを取得
    const accountingData = getCachedData(CACHE_KEYS.MASTER_ACCOUNTING_DATA);
    if (!accountingData || !accountingData.items) {
      // キャッシュが無い場合は文字列のみ返す
      return isFirstTime ? '初回授業料' : '通常授業料';
    }

    const masterData = accountingData.items;
    const itemName = isFirstTime
      ? CONSTANTS.ITEMS.FIRST_LECTURE
      : CONSTANTS.ITEMS.MAIN_LECTURE;

    // 教室固有の料金ルールを検索
    const tuitionRule = masterData.find(
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
          CONSTANTS.ITEM_TYPES.TUITION &&
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === itemName &&
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM] &&
        item[CONSTANTS.HEADERS.ACCOUNTING.TARGET_CLASSROOM].includes(classroom),
    );

    if (tuitionRule) {
      const price = Number(
        tuitionRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE],
      );
      const unit = tuitionRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT] || '';
      const priceText = price > 0 ? ` ¥${price.toLocaleString()}` : '';
      const unitText = unit ? ` / ${unit}` : '';
      return `${itemName}${priceText}${unitText}`;
    }

    // 教室固有ルールが無い場合は基本料金を検索
    const basicRule = masterData.find(
      item =>
        item[CONSTANTS.HEADERS.ACCOUNTING.TYPE] ===
          CONSTANTS.ITEM_TYPES.TUITION &&
        item[CONSTANTS.HEADERS.ACCOUNTING.ITEM_NAME] === itemName,
    );

    if (basicRule) {
      const price = Number(basicRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT_PRICE]);
      const unit = basicRule[CONSTANTS.HEADERS.ACCOUNTING.UNIT] || '';
      const priceText = price > 0 ? ` ¥${price.toLocaleString()}` : '';
      const unitText = unit ? ` / ${unit}` : '';
      return `${itemName}${priceText}${unitText}`;
    }

    // 料金ルールが見つからない場合
    return itemName;
  } catch (error) {
    Logger.log(`授業料取得エラー: ${error.message}`);
    return isFirstTime ? '初回授業料' : '通常授業料';
  }
}

/**
 * 共通の申込み内容セクション生成（テキスト版）
 */
function createBookingDetailsText(reservation, formattedDate, statusText) {
  const { classroom, venue, startTime, endTime, options = {} } = reservation;
  const isFirstTime = options.firstLecture || false;

  // 時間表示（DateオブジェクトまたはHH:mm形式文字列に対応）
  let timeDisplay = '予約webアプリ上か、各教室のページなどをご確認ください';
  if (startTime && endTime) {
    let formattedStartTime, formattedEndTime;

    // Dateオブジェクトの場合は時分のみを抽出
    if (startTime instanceof Date) {
      formattedStartTime = Utilities.formatDate(
        startTime,
        CONSTANTS.TIMEZONE,
        'HH:mm',
      );
    } else {
      formattedStartTime = startTime.toString();
    }

    if (endTime instanceof Date) {
      formattedEndTime = Utilities.formatDate(
        endTime,
        CONSTANTS.TIMEZONE,
        'HH:mm',
      );
    } else {
      formattedEndTime = endTime.toString();
    }

    timeDisplay = `${formattedStartTime} - ${formattedEndTime}`;
  }

  // 実際の授業料金額を取得して表示
  const tuitionText = getTuitionDisplayText(classroom, isFirstTime);

  return `【申込み内容】
教室: ${classroom} ${venue}
日付: ${formattedDate}
時間: ${timeDisplay}
基本授業料: ${tuitionText}
受付日時: ${new Date().toLocaleString('ja-JP')}

以上の内容を ${statusText} で承りました。`;
}

/**
 * 日付をメール用にフォーマット
 * @param {string|Date} dateInput - 日付（文字列またはDateオブジェクト）
 */
function formatDateForEmail(dateInput) {
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
function getContactAndVenueInfoText() {
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
 * 非同期メール送信関数（予約処理統合用）
 * @param {Object} reservationInfo - 予約情報
 * @global getStudentWithEmail
 */
function sendBookingConfirmationEmailAsync(reservationInfo) {
  const { studentId, options = {} } = reservationInfo;

  // 初回フラグの取得（reservationInfoから）
  const isFirstTime = options.firstLecture || false;

  // 生徒情報（メールアドレス含む）を取得
  const studentWithEmail = getStudentWithEmail(studentId);

  if (!studentWithEmail || !studentWithEmail.email) {
    if (isFirstTime) {
      // 初回者でメールアドレス未設定の場合はエラーログ（本来は事前入力で防止）
      Logger.log(
        `初回者メール送信失敗: メールアドレス未設定 (${studentId})`,
        'WARN',
        'sendConfirmationEmail',
        new Date(),
      );
      logActivity(
        studentId,
        'メール送信エラー',
        '失敗',
        '初回者: メールアドレス未設定',
      );
    } else {
      Logger.log(`メール送信スキップ: メールアドレス未設定 (${studentId})`);
    }
    return;
  }

  // 初回者は必須送信、経験者はメール連絡希望確認
  if (!isFirstTime && !studentWithEmail.wantsEmail) {
    Logger.log(`メール送信スキップ: メール連絡希望なし (${studentId})`);
    return;
  }

  // 予約情報を適切な形式に変換
  const reservation = {
    date: reservationInfo.date,
    classroom: reservationInfo.classroom,
    venue: reservationInfo.venue,
    startTime: reservationInfo.startTime,
    endTime: reservationInfo.endTime,
    options: options,
    isWaiting: reservationInfo.isWaiting || false,
  };

  sendBookingConfirmationEmail(reservation, studentWithEmail, isFirstTime);
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
