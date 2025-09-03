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
  const bookingDetails = createBookingDetailsHtml(reservation, formattedDate, statusText);

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          ${realName}さま<br><br>

          ご予約の申込みをいただき、ありがとうございます！<br>
          木彫り作家の川崎誠二です。<br><br>

          私の教室を見つけていただき、また選んでくださり、とてもうれしく思います！！<br><br>

          ${bookingDetails}

          <div style="background-color: #e8f4f8; padding: 15px; margin: 15px 0; border-radius: 5px;">
            <h3 style="color: #2c3e50; margin-top: 0;">初回参加について</h3>
            <p>初回の方にはまずは「だるま」の木彫りを制作しながら、木彫りの基本をお話します。</p>
            <p>単純な形なので、ていねいに木目と刃の入れ方についてくわしく説明しますよ！</p>
            <p>きれいな断面を出しながら、カクカクしていてそれでいてころりんとしたかたちをつくっていきます。</p>
            <p>残りの時間からは自由にお好きなものを製作していただけます。こちらは、どのような形・大きさにするかにもよりますが、初回だけでは完成まで至らない可能性が大きいので、その点はご了承ください。</p>
          </div>

          <div style="background-color: #f0f8e8; padding: 15px; margin: 15px 0; border-radius: 5px;">
            <h3 style="color: #2c3e50; margin-top: 0;">予約管理について</h3>
            <p>予約の確認やキャンセルは、こちらのページで行えます！（私のお手製アプリです！）</p>
            <p><a href="https://www.kibori-class.net/booking" style="color: #3498db;">きぼりのよやく・きろく</a></p>
            <p>次回以降の予約や会計記録や参加の記録もこちらからできますよ。</p>
            <p>スマホのブラウザで「ホームに追加」や「ブックマーク」しておくと便利です！</p>
          </div>

          <p>下に教室に関して連絡事項をまとめました。1度目を通しておいてください。<br>
          他にも質問あれば、このメールに直接ご返信ください。</p>

          <p>それではどうぞよろしくお願いいたします！</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd;">
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

ご予約の申込みをいただき、ありがとうございます！
木彫り作家の川崎誠二です。

私の教室を見つけていただき、また選んでくださり、とてもうれしく思います！！

${createBookingDetailsText(reservation, formattedDate, statusText)}

初回の方にはまずは「だるま」の木彫りを制作しながら、木彫りの基本をお話します。
単純な形なので、ていねいに木目と刃の入れ方についてくわしく説明しますよ！
きれいな断面を出しながら、カクカクしていてそれでいてころりんとしたかたちをつくっていきます。

残りの時間からは自由にお好きなものを製作していただけます。こちらは、どのような形・大きさにするかにもよりますが、初回だけでは完成まで至らない可能性が大きいので、その点はご了承ください。


予約の確認やキャンセルは、こちらのページで行えます！（私のお手製アプリです！）
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
  const bookingDetails = createBookingDetailsHtml(reservation, formattedDate, statusText);

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          ${realName}さま<br><br>

          いつもありがとうございます！<br>
          ご予約を承りました。<br><br>

          ${bookingDetails}

          <div style="background-color: #f0f8e8; padding: 15px; margin: 15px 0; border-radius: 5px;">
            <h3 style="color: #2c3e50; margin-top: 0;">予約管理について</h3>
            <p>予約の確認やキャンセルは、<a href="https://www.kibori-class.net/booking" style="color: #3498db;">こちらのページ</a>で行えます。</p>
            <p>メール連絡が不要な場合は、プロフィール編集から設定を変更できます。</p>
          </div>

          <p>何かご不明点があれば、このメールに直接ご返信ください。</p>

          <p>それでは当日お会いできることを楽しみにしています！</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">
              川崎誠二<br>
              Email: shiawasenahito3000@gmail.com<br>
              Tel: 09013755977
            </p>
          </div>

          ${getVenueDetailsHtml()}
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
ご予約を承りました。

${createBookingDetailsText(reservation, formattedDate, statusText)}

予約の確認やキャンセルは、こちらのページで行えます：
【きぼりのよやく・きろく】(https://www.kibori-class.net/booking)

メール連絡が不要な場合は、プロフィール編集から設定を変更できます。

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
  const { classroom, venue, options = {} } = reservation;
  
  // 会場情報の表示
  const venueDisplay = venue || getVenueForClassroom(classroom);
  
  // 時間表示の改善（セッション制対応）
  const timeDisplay = getTimeDisplayForReservation(reservation);
  
  return `
    <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px;">
      <h3 style="color: #333; margin-top: 0;">申込み内容</h3>
      <p><strong>教室:</strong> ${classroom}</p>
      <p><strong>会場:</strong> ${venueDisplay}</p>
      <p><strong>日付:</strong> ${formattedDate}</p>
      <p><strong>時間:</strong> ${timeDisplay}</p>
      <p><strong>基本授業料:</strong> ${options.firstLecture ? '初回授業料' : '通常授業料'}</p>
      <p><strong>受付日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
      <p style="color: #d2691e; font-weight: bold;">以上の内容を ${statusText} で承りました。</p>
    </div>
  `;
}

/**
 * 共通の申込み内容セクション生成（テキスト版）
 */
function createBookingDetailsText(reservation, formattedDate, statusText) {
  const { classroom, venue, options = {} } = reservation;
  
  // 会場情報の表示
  const venueDisplay = venue || getVenueForClassroom(classroom);
  
  // 時間表示の改善（セッション制対応）
  const timeDisplay = getTimeDisplayForReservation(reservation);
  
  return `・申込み内容
教室: ${classroom}
会場: ${venueDisplay}
日付: ${formattedDate}
時間: ${timeDisplay}
基本授業料: ${options.firstLecture ? '初回授業料' : '通常授業料'}
受付日時: ${new Date().toLocaleString('ja-JP')}

以上の内容を ${statusText} で承りました。`;
}

/**
 * 予約時間の表示を取得（セッション制対応）
 */
function getTimeDisplayForReservation(reservation) {
  const { classroom, startTime, endTime } = reservation;
  
  // 具体的な時間が設定されている場合（時間制・2部制）
  if (startTime && endTime && startTime !== '未定' && endTime !== '未定') {
    return `${startTime} - ${endTime}`;
  }
  
  // セッション制の場合、日程マスタから時間を取得
  if (reservation.date && classroom) {
    try {
      // 外部の関数を使って日程マスタ情報を取得
      const scheduleInfo = typeof getScheduleInfoForDate === 'function' 
        ? getScheduleInfoForDate(reservation.date, classroom) 
        : null;
        
      if (scheduleInfo && scheduleInfo.firstStart && scheduleInfo.firstEnd) {
        return `${scheduleInfo.firstStart} - ${scheduleInfo.firstEnd}`;
      }
    } catch (error) {
      Logger.log(`時間表示取得エラー: ${error.message}`);
    }
  }
  
  // フォールバック: デフォルトの時間表示
  return getDefaultTimeForClassroom(classroom);
}

/**
 * 教室別のデフォルト時間を取得
 */
function getDefaultTimeForClassroom(classroom) {
  const timeMap = {
    '東京教室 浅草橋': '10:00 - 18:00',
    '東京教室 東池袋': '10:00 - 18:00', 
    'つくば教室': '10:00 - 17:00',
    '沼津教室': '10:00 - 17:00',
  };
  return timeMap[classroom] || '時間については別途ご連絡します';
}

/**
 * 日付をメール用にフォーマット
 */
function formatDateForEmail(dateString) {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];

    return `${year}年${month}月${day}日(${weekday})`;
  } catch (error) {
    Logger.log(`日付フォーマットエラー: ${error.message}`);
    return dateString;
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
    <div style="background-color: #fff8dc; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 5px solid #ffa500;">
      <h3 style="color: #d2691e; margin-top: 0;">教室に関して連絡事項</h3>

      <h4 style="color: #333;">注意事項：</h4>
      <ul style="color: #555;">
        <li>体調不良の場合、連絡は後日でも構わないので無理をせずお休みください（キャンセル料なし）</li>
        <li>その他、キャンセルの場合はなるべくお早めにご連絡ください</li>
        <li>刃物を使うため怪我の可能性はあります。なにかあった場合は自己責任でお願いいたします</li>
      </ul>

      <h4 style="color: #333;">その他の料金：</h4>
      <ul style="color: #555;">
        <li>彫刻刀レンタル１回 ¥500 （持ち込みや購入の場合は不要）</li>
        <li>材料代 ¥100 ~¥2,000 程度（材料の大きさ、樹種に応じて計算）</li>
        <li>道具類などを購入する場合は、その代金</li>
      </ul>

      <p><strong>お支払い：</strong>現金、オンラインバンキング送金、ことら送金 （すべて当日）<br>
      <small>※ことら送金･･･電話番号やメールアドレス宛に、銀行のスマホアプリから、手数料なしで送金できるサービス。ゆうちょ銀行、三井住友銀行など。</small></p>

      <h4 style="color: #333;">もちもの：</h4>
      <ul style="color: #555;">
        <li>わくわくした気持ち</li>
        <li>作りたい物の見本や資料</li>
        <li>飲み物</li>
        <li>※セーターなど木屑が付きやすい服は避ける</li>
      </ul>

      <p><strong>お持ちであれば：</strong><br>
      ・よく切れる彫刻刀<br>
      ・その他の木彫り道具類</p>

      <p><strong>必要であれば：</strong><br>
      ・おやつ・昼食（外食も可）<br>
      ・エプロン<br>
      ・ブランケット（寒い時期）<br>
      ・椅子に敷くクッション</p>

      ${getVenueDetailsHtml()}
    </div>

    <div style="text-align: center; margin: 30px 0; padding-top: 20px; border-top: 2px solid #ddd;">
      <h4 style="color: #2c3e50; margin-bottom: 10px;">川崎 誠二 KAWASAKI Seiji</h4>
      <p style="color: #666; font-size: 14px; margin: 5px 0;">
        Email: <a href="mailto:shiawasenahito3000@gmail.com" style="color: #3498db;">shiawasenahito3000@gmail.com</a><br>
        教室サイト: <a href="https://www.kibori-class.net/" style="color: #3498db;">https://www.kibori-class.net/</a><br>
        ONLINE SHOP: <a href="https://seiji-kawasaki.stores.jp/" style="color: #3498db;">https://seiji-kawasaki.stores.jp/</a>
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 15px;">
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
    <h4 style="color: #333; margin-top: 20px;">会場：</h4>
    <div style="color: #555;">
      <p><strong>【東京教室 浅草橋】</strong><br>
      Parts Studio Tokyo パーツスタジオ2F<br>
      〒111-0053 東京都台東区浅草橋１丁目７−７（陶芸スタジオ2Fのギャラリースペース）<br>
      <a href="#" style="color: #3498db;">Googleマップで表示</a><br>
      ・浅草橋駅より徒歩1,2分（浅草橋駅はJR中央・総武線、都営浅草線の駅。秋葉原から1駅）</p>

      <p><strong>【東京教室 東池袋】</strong><br>
      総合不動産 店舗内（池袋サンシャインシティの近く）<br>
      〒170-0013 東京都豊島区東池袋３丁目２０－２０ 東池袋ハイツ壱番館 １Ｆ<br>
      （建物入り口正面から見て、右側の一段下がっているところにある不動産屋さんの店舗内）<br>
      <a href="#" style="color: #3498db;">Googleマップで表示</a><br>
      ・池袋駅東口より 15分<br>
      ・山手線 大塚駅より 15分<br>
      ・有楽町線 東池袋駅より 10分<br>
      ・都電荒川線 向原駅より 7分<br>
      （いずれも徒歩の場合）</p>

      <p><strong>【つくば教室】</strong><br>
      〒305-0861 茨城県つくば市谷田部 1051-7<br>
      駐車場など詳しい情報は<a href="https://sites.google.com/view/kwskikbr/tukuba" style="color: #3498db;">こちらのリンク先</a></p>

      <p><strong>【沼津教室】</strong><br>
      〒410-0844 静岡県沼津市春日町67-5<br>
      駐車場など詳しい情報は<a href="https://sites.google.com/view/kwskikbr/numazu" style="color: #3498db;">こちらのリンク先</a></p>
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
