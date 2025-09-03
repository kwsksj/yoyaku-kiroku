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
    );
    logActivity(
      student.studentId,
      'メール送信',
      `予約確定メール送信完了 (${isFirstTime ? '初回者' : '経験者'})`,
    );

    return true;
  } catch (error) {
    Logger.log(`メール送信エラー: ${error.message}`);
    logActivity(
      student.studentId,
      'メール送信エラー',
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
      htmlBody: createFirstTimeEmailHtml(
        reservation,
        student,
        formattedDate,
        statusText,
      ),
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
      htmlBody: createRegularEmailHtml(
        reservation,
        student,
        formattedDate,
        statusText,
      ),
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
 * 初回者向けHTMLメール生成
 */
function createFirstTimeEmailHtml(
  reservation,
  student,
  formattedDate,
  statusText,
) {
  const { realName } = student;

  // 申込み内容セクション（共通関数使用）
  const bookingDetails = createBookingDetailsHtml(
    reservation,
    formattedDate,
    statusText,
  );

  return `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');

          /* メールテンプレート用統一スタイル */
          .email-body { font-family: 'Zen Kaku Gothic New', 'Hiragino Sans', 'ヒラギノ角ゴ ProN W3', 'Hiragino Kaku Gothic ProN', 'メイリオ', Meiryo, sans-serif; line-height: 1.6; color: #4E342E; background-color: #FFFDF5; margin: 0; padding: 0; }
          .email-container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFFFFF; }
          .email-header { text-align: center; margin-bottom: 24px; padding: 16px; background-color: #F5F1ED; border-radius: 8px; }
          .email-header h1 { color: #4E342E; margin: 0; font-size: 16px; }
          .email-header p { color: #785A4E; margin: 8px 0 0 0; font-size: 16px; }
          .email-greeting { color: #4E342E; font-size: 16px; margin-bottom: 16px; }
          .email-message { color: #4E342E; font-size: 16px; line-height: 1.6; margin-bottom: 16px; }
          .email-section { background-color: #F0FDF4; border: 2px solid #A7F3D0; padding: 16px; margin: 20px 0; border-radius: 8px; }
          .email-section-amber { background-color: #FFFBEB; border: 2px solid #FDE68A; padding: 16px; margin: 20px 0; border-radius: 8px; }
          .email-section h3 { color: #166534; margin: 0 0 12px 0; font-size: 16px; font-weight: 700; }
          .email-section-amber h3 { color: #B45309; margin: 0 0 12px 0; font-size: 16px; font-weight: 700; }
          .email-section p { color: #166534; font-size: 16px; line-height: 1.6; }
          .email-section-amber p { color: #B45309; font-size: 16px; line-height: 1.6; }
          .email-section p.no-margin { margin: 0; }
          .email-section p.small-margin { margin-bottom: 12px; }
          .email-button { color: #C86F34; text-decoration: none; font-weight: 500; padding: 8px 16px; background-color: #F5F1ED; border-radius: 6px; display: inline-block; }
          .email-note { color: #4E342E; font-size: 16px; line-height: 1.6; margin: 20px 0; }
          .email-closing { color: #4E342E; font-size: 16px; font-weight: 500; margin: 20px 0; }
          .email-footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #E4CDBA; }
        </style>
      </head>
      <body class="email-body">
        <div class="email-container">
          <div class="email-header">
            <h1>川崎誠二 木彫り教室</h1>
          </div>

          <p class="email-greeting">${realName}さま</p>

          <p class="email-message">
            木彫り教室ご参加の申込みをいただき、ありがとうございます！<br>
            木彫り作家の川崎誠二です。<br>
            私の教室を見つけていただき、また選んでくださり、とてもうれしく思います！！
          </p>

          ${bookingDetails}

          <div class="email-section">
            <h3>初回参加について</h3>
            <p class="small-margin">初回の方にはまずは「だるま」の木彫りを制作しながら、木彫りの基本をお話します。単純な形なので、ていねいに木目と刃の入れ方についてくわしく説明しますよ！きれいな断面を出しながら、カクカクしていてそれでいてころりんとしたかたちをつくっていきます。</p>
            <p class="no-margin">残りの時間からは自由にお好きなものを製作していただけます。こちらは、どのような形・大きさにするかにもよりますが、初回だけでは完成まで至らない可能性が大きいので、その点はご了承ください。</p>
          </div>

          <div class="email-section-amber">
            <h3>予約管理について</h3>
            <p style="margin-bottom: 8px;">予約の確認やキャンセルは、こちらのページで行えます！（私のお手製Webアプリです！）</p>
            <p style="margin: 8px 0;"><a href="https://www.kibori-class.net/booking" class="email-button">きぼりのよやく・きろく</a></p>
            <p class="no-margin">
              次回以降の予約や会計記録や参加の記録もこちらからできますよ。<br>
              スマホのブラウザで「ホームに追加」や「ブックマーク」しておくと便利です！
            </p>
          </div>

          <p class="email-note">
            下に教室に関して連絡事項をまとめました。1度目を通しておいてください。<br>
            他にも質問あれば、このメールに直接ご返信ください。
          </p>

          <p class="email-closing">それではどうぞよろしくお願いいたします！</p>

          <div class="email-footer">
            ${getContactAndVenueInfoHtml()}
          </div>
        </div>
      </body>
    </html>
  `;
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
 * 経験者向けHTMLメール生成
 */
function createRegularEmailHtml(
  reservation,
  student,
  formattedDate,
  statusText,
) {
  const { realName } = student;

  // 申込み内容セクション（共通関数使用）
  const bookingDetails = createBookingDetailsHtml(
    reservation,
    formattedDate,
    statusText,
  );

  return `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');

          /* メールテンプレート用統一スタイル */
          .email-body { font-family: 'Zen Kaku Gothic New', 'Hiragino Sans', 'ヒラギノ角ゴ ProN W3', 'Hiragino Kaku Gothic ProN', 'メイリオ', Meiryo, sans-serif; line-height: 1.6; color: #4E342E; background-color: #FFFDF5; margin: 0; padding: 0; }
          .email-container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFFFFF; }
          .email-header { text-align: center; margin-bottom: 24px; padding: 16px; background-color: #F5F1ED; border-radius: 8px; }
          .email-header h1 { color: #C86F34; margin: 0; font-size: 16px; }
          .email-header p { color: #785A4E; margin: 8px 0 0 0; font-size: 16px; }
          .email-greeting { color: #4E342E; font-size: 16px; margin-bottom: 16px; }
          .email-message { color: #4E342E; font-size: 16px; line-height: 1.6; margin-bottom: 16px; }
          .email-section-amber { background-color: #FFFBEB; border: 2px solid #FDE68A; padding: 16px; margin: 20px 0; border-radius: 8px; }
          .email-section-amber h3 { color: #B45309; margin: 0 0 12px 0; font-size: 16px; font-weight: 700; }
          .email-section-amber p { color: #B45309; font-size: 16px; line-height: 1.6; }
          .email-section-amber p.no-margin { margin: 0; }
          .email-link { color: #C86F34; text-decoration: none; font-weight: 500; }
          .email-note { color: #4E342E; font-size: 16px; line-height: 1.6; margin: 20px 0; }
          .email-closing { color: #4E342E; font-size: 16px; font-weight: 500; margin: 20px 0; }
          .email-footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #E4CDBA; }
          .email-contact-card { text-align: center; padding: 16px; background-color: #F5F1ED; border-radius: 6px; margin-bottom: 20px; }
          .email-contact-card p { color: #785A4E; font-size: 16px; margin: 0; }
          .email-contact-card strong { color: #4E342E; }
        </style>
      </head>
      <body class="email-body">
        <div class="email-container">
          <div class="email-header">
            <h1>川崎誠二 木彫り教室</h1>
          </div>

          <p class="email-greeting">${realName}さま</p>

          <p class="email-message">
            川崎です！<br>
            いつもありがとうございます！<br>
            ご予約を承りました。
          </p>

          ${bookingDetails}

          <div class="email-section-amber">
            <h3>予約管理について</h3>
            <p style="margin-bottom: 8px;">予約の確認やキャンセルは、<a href="https://www.kibori-class.net/booking" class="email-link">こちらのページ</a>で行えます。</p>
            <p class="no-margin">
              メール連絡が不要な場合は、プロフィール編集から設定を変更できます。<br>
              次回以降の予約や会計記録や参加の記録もこちらからできます。<br>
              スマホのブラウザで「ホームに追加」や「ブックマーク」しておくと便利です！
            </p>
          </div>

          <p class="email-note">何かご不明点があれば、このメールに直接ご返信ください。</p>

          <p class="email-closing">それではまたお会いできることを楽しみにしています！</p>

          <div class="email-footer">
            <div class="email-contact-card">
              <p>
                <strong>川崎誠二</strong><br>
                Email: <a href="mailto:shiawasenahito3000@gmail.com" class="email-link">shiawasenahito3000@gmail.com</a><br>
                Tel: <strong>09013755977</strong>
              </p>
            </div>
            ${getVenueDetailsHtml()}
          </div>
        </div>
      </body>
    </html>
  `;
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

いつもありがとうございます！
川崎です！
ご予約を承りました。

${createBookingDetailsText(reservation, formattedDate, statusText)}

予約の確認やキャンセルは、こちらのページで行えます：
【きぼりのよやく・きろく】(https://www.kibori-class.net/booking)

メール連絡が不要な場合は、プロフィール編集から設定を変更できます。
次回以降の予約や会計記録や参加の記録もこちらからできます。
スマホのブラウザで「ホームに追加」や「ブックマーク」しておくと便利です！

何かご不明点があれば、このメールに直接ご返信ください。
それでは当日お会いできることを楽しみにしています！

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
 * 共通の申込み内容セクション生成（HTML版）
 */
function createBookingDetailsHtml(reservation, formattedDate, statusText) {
  const { classroom, venue, startTime, endTime, options = {} } = reservation;

  // 時間表示（フロントエンドで調整済みの値を使用）
  const timeDisplay =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : '予約webアプリ上か、各教室のページなどをご確認ください';

  return `
    <style>
      .booking-details { background-color: #F5F1ED; border: 2px solid #E4CDBA; padding: 16px; margin: 20px 0; border-radius: 8px; }
      .booking-details h3 { color: #4E342E; margin: 0 0 16px 0; font-size: 16px; font-weight: 700; }
      .booking-details-row { margin-bottom: 8px; }
      .booking-details-label { color: #785A4E; font-size: 16px; font-weight: 500; }
      .booking-details-value { color: #4E342E; font-size: 16px; }
      .booking-details-value-highlight { color: #4E342E; font-size: 16px; font-weight: 700; }
      .booking-details-status { text-align: center; padding: 8px; background-color: #C86F34; color: #FFFFFF; border-radius: 6px; font-weight: 700; font-size: 16px; margin-top: 12px; }
    </style>
    <div class="booking-details">
      <h3>申込み内容</h3>
      <div class="booking-details-row"><span class="booking-details-label">教室:</span> <span class="booking-details-value-highlight">${classroom} ${venue}</span></div>
      <div class="booking-details-row"><span class="booking-details-label">日付:</span> <span class="booking-details-value-highlight">${formattedDate}</span></div>
      <div class="booking-details-row"><span class="booking-details-label">時間:</span> <span class="booking-details-value-highlight">${timeDisplay}</span></div>
      <div class="booking-details-row"><span class="booking-details-label">基本授業料:</span> <span class="booking-details-value">${options.firstLecture ? '初回授業料' : '通常授業料'}</span></div>
      <div class="booking-details-row"><span class="booking-details-label">受付日時:</span> <span class="booking-details-value">${new Date().toLocaleString('ja-JP')}</span></div>
      <div class="booking-details-status">以上の内容を ${statusText} で承りました</div>
    </div>
  `;
}

/**
 * 共通の申込み内容セクション生成（テキスト版）
 */
function createBookingDetailsText(reservation, formattedDate, statusText) {
  const { classroom, venue, startTime, endTime, options = {} } = reservation;

  // 時間表示（フロントエンドで調整済みの値を使用）
  const timeDisplay =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : '予約webアプリ上か、各教室のページなどをご確認ください';

  return `・申込み内容
教室: ${classroom} ${venue}
日付: ${formattedDate}
時間: ${timeDisplay}
基本授業料: ${options.firstLecture ? '初回授業料' : '通常授業料'}
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
 * 教室名から会場名を取得
 */
function getVenueForClassroom(classroom) {
  const venueMap = {
    '東京教室 浅草橋': 'Parts Studio Tokyo パーツスタジオ2F',
    '東京教室 東池袋': '総合不動産 店舗内',
    つくば教室: 'つくば会場',
    沼津教室: '沼津会場',
  };
  return venueMap[classroom] || classroom;
}

/**
 * 連絡事項・会場情報（HTML版）
 */
function getContactAndVenueInfoHtml() {
  return `
    <style>
      .contact-info { background-color: #FFFBEB; border: 2px solid #FDE68A; padding: 16px; margin: 20px 0; border-radius: 8px; }
      .contact-info h3 { color: #B45309; margin: 0 0 16px 0; font-size: 16px; font-weight: 700; }
      .contact-info h4 { color: #4E342E; font-size: 16px; font-weight: 700; margin: 12px 0 8px 0; }
      .contact-info ul { color: #785A4E; font-size: 16px; line-height: 1.5; margin: 0 0 12px 0; padding-left: 16px; }
      .contact-info li { margin-bottom: 4px; }
      .contact-info p { color: #4E342E; font-size: 16px; line-height: 1.5; margin: 12px 0; }
      .contact-info .note { font-size: 14px; color: #785A4E; }
      .profile-card { text-align: center; margin: 30px 0; padding: 16px; background-color: #F5F1ED; border-radius: 8px; }
      .profile-card h4 { color: #C86F34; margin: 0 0 12px 0; font-size: 16px; font-weight: 700; }
      .profile-card p { color: #785A4E; font-size: 16px; margin: 8px 0; }
      .profile-card a { color: #C86F34; text-decoration: none; font-weight: 500; }
      .profile-card .social { color: #A1887F; font-size: 14px; margin-top: 12px; line-height: 1.4; }
    </style>
    <div class="contact-info">
      <h3>教室に関して連絡事項</h3>

      <h4>注意事項</h4>
      <ul>
        <li>体調不良の場合、連絡は後日でも構わないので無理をせずお休みください（キャンセル料なし）</li>
        <li>その他、キャンセルの場合はなるべくお早めにご連絡ください</li>
        <li>刃物を使うため怪我の可能性はあります。なにかあった場合は自己責任でお願いいたします</li>
      </ul>

      <h4>その他の料金</h4>
      <ul>
        <li>彫刻刀レンタル１回 ¥500 （持ち込みや購入の場合は不要）</li>
        <li>材料代 ¥100 ~¥2,000 程度（材料の大きさ、樹種に応じて計算）</li>
        <li>道具類などを購入する場合は、その代金</li>
      </ul>

      <h4>お支払い</h4>
      <p></strong>現金、オンラインバンキング送金、ことら送金 （すべて当日）<br>
      <span class="note">※ことら送金･･･電話番号やメールアドレス宛に、銀行のスマホアプリから、手数料なしで送金できるサービス。ゆうちょ銀行、三井住友銀行など。</span></p>

      <h4>もちもの</h4>
      <ul>
        <li>わくわくした気持ち</li>
        <li>作りたい物の見本や資料</li>
        <li>飲み物</li>
        <li>※セーターなど木屑が付きやすい服は避ける</li>
      </ul>

      <h4>お持ちであれば</h4>
      <ul>
        <li>よく切れる彫刻刀</li>
        <li>その他の木彫り道具類</li>
      </ul>

      <h4>必要であれば</h4>
      <ul>
        <li>おやつ・昼食（外食も可）</li>
        <li>エプロン</li>
        <li>ブランケット（寒い時期）</li>
        <li>椅子に敷くクッション（背が低い方はあるとよい）</li>
      </ul>

      ${getVenueDetailsHtml()}
    </div>

    <div class="profile-card">
      <h4>川崎 誠二 KAWASAKI Seiji</h4>
      <p>
        Email: <a href="mailto:shiawasenahito3000@gmail.com">shiawasenahito3000@gmail.com</a><br>
        教室サイト: <a href="https://www.kibori-class.net/">https://www.kibori-class.net/</a><br>
        ONLINE SHOP: <a href="https://seiji-kawasaki.stores.jp/">https://seiji-kawasaki.stores.jp/</a>
      </p>
      <p class="social">
        作品など Instagram @seiji_kawasaki | X (Twitter) @sawsnht<br>
        教室（生徒作品紹介） Instagram @kibori_class | X (Twitter) @kibori_class
      </p>
    </div>
  `;
}

/**
 * 会場詳細情報（HTML版）
 */
function getVenueDetailsHtml() {
  return `
    <style>
      .venue-info h4 { color: #4E342E; font-size: 16px; font-weight: 700; margin: 16px 0 12px 0; }
      .venue-info { color: #785A4E; font-size: 16px; line-height: 1.6; }
      .venue-card { padding: 12px; margin: 8px 0; border-radius: 4px; }
      .venue-card-tokyo { background-color: #FEF2F2; border-left: 4px solid #B91C1C; }
      .venue-card-tsukuba { background-color: #F0FDF4; border-left: 4px solid #166534; }
      .venue-card-numazu { background-color: #EFF6FF; border-left: 4px solid #0369A1; }
      .venue-card strong.tokyo { color: #B91C1C; }
      .venue-card strong.tsukuba { color: #166534; }
      .venue-card strong.numazu { color: #0369A1; }
      .venue-card span { color: #4E342E; }
      .venue-card a { color: #C86F34; text-decoration: none; font-weight: 500; }
    </style>
    <h3>会場情報</h3>
    <div class="venue-info">
      <div class="venue-card venue-card-tokyo">
        <strong class="tokyo">【東京教室 浅草橋】</strong><br>
        <span>Parts Studio Tokyo パーツスタジオ2F<br>
        〒111-0053 東京都台東区浅草橋１丁目７−７（陶芸スタジオ2Fのギャラリースペース）<br>
        ・浅草橋駅より徒歩1,2分（浅草橋駅はJR中央・総武線、都営浅草線の駅。秋葉原から1駅）</span>
      </div>
      <br>
      <div class="venue-card venue-card-tokyo">
        <strong class="tokyo">【東京教室 東池袋】</strong><br>
        <span>総合不動産 店舗内（池袋サンシャインシティの近く）<br>
        〒170-0013 東京都豊島区東池袋３丁目２０－２０ 東池袋ハイツ壱番館 １Ｆ<br>
        （建物入り口正面から見て、右側の一段下がっているところにある不動産屋さんの店舗内）<br>
        ・池袋駅東口より 15分 ・山手線 大塚駅より 15分<br>
        ・有楽町線 東池袋駅より 10分 ・都電荒川線 向原駅より 7分（いずれも徒歩）</span>
      </div>
      <br>
      <div class="venue-card venue-card-tsukuba">
        <strong class="tsukuba">【つくば教室】</strong><br>
        <span>〒305-0861 茨城県つくば市谷田部 1051-7<br>
        駐車場など詳しい情報は<a href="https://sites.google.com/view/kwskikbr/tukuba">こちらのリンク先</a></span>
      </div>
      <br>
      <div class="venue-card venue-card-numazu">
        <strong class="numazu">【沼津教室】</strong><br>
        <span>〒410-0844 静岡県沼津市春日町67-5<br>
        駐車場など詳しい情報は<a href="https://sites.google.com/view/kwskikbr/numazu">こちらのリンク先</a></span>
      </div>
    </div>
  `;
}

/**
 * 連絡事項・会場情報（テキスト版）
 */
function getContactAndVenueInfoText() {
  return `
----------------------------------------------------
*教室に関して連絡事項★*

注意事項：
・体調不良の場合、連絡は後日でも構わないので無理をせずお休みください（キャンセル料なし）
・その他、キャンセルの場合はなるべくお早めにご連絡ください
・刃物を使うため怪我の可能性はあります。なにかあった場合は自己責任でお願いいたします

その他の料金：
・彫刻刀レンタル１回 ¥500 （持ち込みや購入の場合は不要）
・材料代 ¥100 ~¥2,000 程度（材料の大きさ、樹種に応じて計算）
・道具類などを購入する場合は、その代金

お支払い：現金、オンラインバンキング送金、ことら送金 （すべて当日）
※ことら送金･･･電話番号やメールアドレス宛に、銀行のスマホアプリから、手数料なしで送金できるサービス。ゆうちょ銀行、三井住友銀行など。詳しくはこちら

もちもの：
・わくわくした気持ち
・作りたい物の見本や資料
・飲み物
※セーターなど木屑が付きやすい服は避ける
お持ちであれば
・よく切れる彫刻刀
・その他の木彫り道具類
必要であれば
・おやつ・昼食（外食も可）
・エプロン
・ブランケット（寒い時期）
・椅子に敷くクッション

会場：
【東京教室 浅草橋】
Parts Studio Tokyo パーツスタジオ2F
〒111-0053 東京都台東区浅草橋１丁目７−７（陶芸スタジオ2Fのギャラリースペース）
Googleマップで表示
・浅草橋駅より徒歩1,2分
（浅草橋駅はJR中央・総武線、都営浅草線の駅。秋葉原から1駅）

【東京教室 東池袋】
総合不動産  店舗内（池袋サンシャインシティの近く）
〒170-0013 東京都豊島区東池袋３丁目２０－２０ 東池袋ハイツ壱番館 １Ｆ
（建物入り口正面から見て、右側の一段下がっているところにある不動産屋さんの店舗内）
Googleマップで表示
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
      Logger.log(`初回者メール送信失敗: メールアドレス未設定 (${studentId})`);
      logActivity(
        studentId,
        'メール送信エラー',
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
// TODO: 必要に応じて外部サービス連携機能を実装
