/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Utils.js
 * 目的: 各ビューで共通利用するUIヘルパーと定数を提供する
 * 主な責務:
 *   - ビュー共通の判定・整形ロジックを集約
 *   - MarkdownコンテンツやスニペットHTMLを管理
 *   - 他ビューから呼び出されるユーティリティ関数を公開
 * AI向けメモ:
 *   - ビュー専用の共通処理を追加する際は重複実装を避けるためまずこのファイルを検討する
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';
import { renderBookingLessons } from './13_WebApp_Views_Booking.js';

const viewsUtilsStateManager = appWindow.stateManager;
// =================================================================
// --- Privacy Policy Content (タスク1で追加) ---
// -----------------------------------------------------------------
// プライバシーポリシーの内容を定数として定義
// =================================================================

/**
 * プライバシーポリシーの内容（Markdown形式）
 */
export const PRIVACY_POLICY_CONTENT = `# プライバシーポリシー

川崎誠二木彫り教室 予約システム「きぼりの よやく・きろく」（以下「本サービス」といいます）は、利用者の皆様（以下「ユーザー」といいます）の個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。

## 1. 事業者の名称および連絡先

* **名称:** 川崎誠二
* **連絡先:** [お問い合わせフォーム](https:\/\/www.kibori-class.net/contact)

## 2. 個人情報の取得方法

本サービスは、ユーザーが利用登録または予約を行う際に、以下の情報をフォームへの入力によって取得します。

**【登録に必須の情報】**

* 氏名（本名）
* 電話番号
* メールアドレス

**【任意でご提供いただく情報】**

* ニックネーム
* お住まいの地域（市区町村など）
* 年代
* その他、ユーザーが任意で入力する情報

## 3. 個人情報の利用目的

取得した個人情報は、以下の目的で利用いたします。

* ユーザーのアカウント認証および本人確認のため
* 予約の受付、管理、および変更・キャンセル等の連絡のため
* 教室の利用に関する緊急の連絡のため
* ユーザーからのお問い合わせに対応するため
* 教室からの重要なお知らせ（日程変更など）を連絡のため
* （メール配信を希望した場合）空席情報などのご案内を送付するため
* より良い教室運営や指導を行うための参考情報として（任意でご提供いただいた情報に限る）

## 4. 個人データの第三者提供について

本サービスは、次の場合を除き、あらかじめユーザーの同意を得ることなく、第三者に個人データを提供することはありません。

* 法令に基づく場合
* 人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき

## 5. 個人データの安全管理措置

本サービスは、ユーザーの個人情報を正確かつ最新の内容に保つよう努め、不正なアクセス・改ざん・漏えい・滅失及び毀損から保護するため、適切な安全管理措置を講じます。

なお、本サービスのデータは、セキュリティに優れたGoogle社の提供するGoogleスプレッドシート上に保管・管理されています。

## 6. 個人データの開示、訂正、削除

ユーザーは、本サービスが保有している自己の個人情報について、開示、訂正、追加、削除、または利用の停止を求めることができます。

登録情報の訂正・追加は、ログイン後のプロフィール編集ページにてご自身で操作いただけます。アカウントの削除（退会）やその他のご要望については、上記の連絡先までお問い合わせください。本人確認を行った上で、法令に従い速やかに対応いたします。

## 7. 免責事項

本サービスの利用によって生じたいかなるトラブル・損失・損害についても、当方は一切責任を負わないものとします。

## 8. プライバシーポリシーの変更

本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。変更後のプライバシーポリシーは、本ページに掲載したときから効力を生じるものとします。

【2025年9月30日 策定】
`;

// =================================================================
// --- View Helper Components ---
// -----------------------------------------------------------------
// 各ビューを構成するための、より小さな部品を生成するヘルパー関数群。
// =================================================================

/**
 * 当日かどうかを判定します。
 * @param {DateString} dateString - 日付文字列 (YYYY-MM-DD)
 * @returns {boolean} 当日の場合true
 */
export const _isToday = dateString => {
  const itemDate = new Date(dateString);
  const today = new Date();
  return itemDate.toDateString() === today.toDateString();
};

/**
 * 指定日が「今日もしくは過去」かどうかを判定します。
 * @param {DateString} dateString - 日付文字列 (YYYY-MM-DD)
 * @returns {boolean} 「今日もしくは過去」の場合true
 */
export const _isPastOrToday = dateString => {
  const itemDate = new Date(dateString);
  const today = new Date();
  // 時間を00:00:00にリセットして日付のみで比較
  itemDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return itemDate <= today;
};

/**
 * 時刻選択用の<option>タグ群を生成します。
 * @param {number} startHour - 開始時刻（時）
 * @param {number} endHour - 終了時刻（時）
 * @param {number} step - 間隔（分）
 * @param {TimeString | null} selectedValue - 事前に選択する時刻 (HH:mm)
 * @returns {HTMLString} HTMLの<option>タグ文字列
 */
export const getTimeOptionsHtml = (startHour, endHour, step, selectedValue) => {
  const options = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += step) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push(
        `<option value="${time}" ${time === selectedValue ? 'selected' : ''}>${time}</option>`,
      );
    }
  }
  return options.join('');
};

/**
 * 教室名に基づいてTailwindCSSのカラークラスを返します。
 * @param {ClassroomName} classroomName - 教室名
 * @param {'colorClass' | 'badgeClass'} [type='colorClass'] - 取得するクラスの種類
 * @returns {string} Tailwindカラークラス
 */
export const getClassroomColorClass = (classroomName, type = 'colorClass') => {
  /**
   * 教室名からDesignConfigのキーへ変換する対応表
   * @type {Record<string, keyof typeof DesignConfig.classroomColors>}
   */
  const classroomKeyMap = {
    東京教室: 'tokyo',
    沼津教室: 'numazu',
    つくば教室: 'tsukuba',
  };

  const classroomConfig = DesignConfig.classroomColors || {};
  const classroomKey = classroomKeyMap[classroomName];

  if (classroomKey && classroomConfig[classroomKey]?.[type]) {
    return classroomConfig[classroomKey][type];
  }

  return classroomConfig.default?.[type] || '';
};

/**
 * 会場名に基づいてTailwindCSSのカラークラスを返します。
 * @param {string} venueName - 会場名（例: '浅草橋', '東池袋'）
 * @param {'colorClass' | 'badgeClass'} [type='colorClass'] - 取得するクラスの種類
 * @returns {string} Tailwindカラークラス
 */
export const getVenueColorClass = (venueName, type = 'colorClass') => {
  const venueConfig = DesignConfig.venueColors || {};

  if (venueName && venueConfig[venueName]?.[type]) {
    return venueConfig[venueName][type];
  }

  return venueConfig.default?.[type] || '';
};

/**
 * 完了画面のUIを生成します。
 * @param {string} msg - 表示するメッセージ
 * @returns {string} HTML文字列
 */
export const getCompleteView = msg => {
  // 教室情報を取得（複数のソースから取得を試行）
  const state = viewsUtilsStateManager.getState();
  const classroom =
    state.accountingReservation?.classroom ||
    state.selectedLesson?.classroom ||
    state.currentReservationFormContext?.lessonInfo?.classroom ||
    state.selectedClassroom;

  // 初回予約者かどうかを判定
  const wasFirstTimeBooking =
    viewsUtilsStateManager.getState().wasFirstTimeBooking || false;
  const currentUser = viewsUtilsStateManager.getState().currentUser;
  const studentHasEmail = currentUser && currentUser.email;
  const emailPreference = currentUser && currentUser.wantsEmail;

  // 完了種別を判定
  /** @type {'reservation' | 'accounting' | 'cancel'} */
  const completionType = (() => {
    const normalized = (msg || '').toString();
    if (normalized.includes('キャンセル')) return 'cancel';
    if (normalized.includes('会計')) return 'accounting';
    return 'reservation';
  })();
  const isReservationComplete = completionType === 'reservation';

  // メール送信に関する案内メッセージ（予約完了時のみ表示）
  let emailNoticeHtml = '';
  if (wasFirstTimeBooking && isReservationComplete) {
    emailNoticeHtml = `
        <div class="bg-ui-info-bg border-2 border-ui-info-border rounded-lg p-4 mt-4">
          <div class="flex items-start">
            <svg class="flex-shrink-0 h-5 w-5 text-ui-info-text mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
            </svg>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-ui-info-text">予約受付完了のメールをお送りしました！</h3>
              <p class="mt-1 text-sm text-ui-info-text">
                会場の住所や駐車場情報なども記載しています。メールが届かない場合は、迷惑メールフォルダもご確認ください。<br>
                予約の確認やキャンセルは、このページ（Webアプリ上）でおこなえます<br>
                <br>
                送信元アドレス: shiawasenahito3000@gmail.com
              </p>
            </div>
          </div>
        </div>
      `;
  } else if (studentHasEmail && emailPreference && isReservationComplete) {
    emailNoticeHtml = `
        <div class="bg-ui-surface rounded-lg p-3 mt-4">
          <p class="text-sm text-brand-subtle text-center">
          予約受付完了のメールをお送りしました！<br>
          （会場の住所や駐車場情報なども記載）<br>
          <br>
          送信元アドレス: shiawasenahito3000@gmail.com
        </p>
        </div>
      `;
  }

  let nextBookingHtml = '';

  // 該当教室の未来の予約枠が存在する場合
  if (classroom && viewsUtilsStateManager.getState().lessons) {
    // バックエンドで計算済みの空き情報を直接使用
    const relevantLessons = viewsUtilsStateManager
      .getState()
      .lessons.filter(
        (/** @type {LessonCore} */ lesson) => lesson.classroom === classroom,
      );
    const bookingLessonsHtml = renderBookingLessons(relevantLessons);

    if (bookingLessonsHtml) {
      // 完了種別ごとに表記を変更
      const sectionTitle =
        completionType === 'reservation'
          ? '↓ さらに よやく をする！'
          : completionType === 'accounting'
            ? '↓ つぎの よやく をする！'
            : '↓ かわりの よやく をする！';

      nextBookingHtml = `
          <div class="mt-0 pt-0">
              <h3 class="text-xl font-bold text-brand-text text-center mb-4">${sectionTitle}</h3>
              <div class="${DesignConfig.cards.container}">
              ${bookingLessonsHtml}
              </div>
          </div>`;
    }
  }

  // チェックマークの色を状況に応じて変更
  const checkmarkColorClass = isReservationComplete
    ? 'text-state-available-text' // 予約完了時: 緑系
    : 'text-yellow-500'; // 会計完了時: 黄色系

  return `
    <div class="text-center pt-6 pb-4">
        <div class="mb-6">
            <svg class="w-12 h-12 mx-auto ${checkmarkColorClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        </div>

        <h1 class="text-2xl font-bold ${DesignConfig.colors.text} mb-3">ありがとうございました</h1>
        <p class="${DesignConfig.colors.textSubtle} mb-6 text-lg">${msg}</p>

        ${emailNoticeHtml}

        <div class="max-w-xs mx-auto mt-6 mb-6">
             ${Components.button({
               text: 'ホームへもどる',
               action: 'goToDashboard',
               style: 'secondary',
               size: 'normal',
             })}
        </div>

        ${nextBookingHtml}

    </div>`;
};

/**
 * プライバシーポリシーのモーダルを生成します（タスク1実装）
 * @returns {string} HTML文字列
 */
export const getPrivacyPolicyModal = () => {
  // marked.jsライブラリが読み込まれていることを確認
  /** @type {any} */
  const markedGlobal =
    typeof window !== 'undefined'
      ? /** @type {any} */ (window)['marked']
      : undefined;
  /** @type {any} */
  const markedLib = typeof markedGlobal !== 'undefined' ? markedGlobal : null;

  if (!markedLib) {
    console.error('marked.js is not loaded!');
    return Components.modal({
      id: 'privacy-policy-modal',
      title: 'エラー',
      content: '<p>コンテンツを読み込めませんでした。</p>',
      maxWidth: 'max-w-3xl',
      showCloseButton: true,
    });
  }

  const policyHtml = markedLib.parse(PRIVACY_POLICY_CONTENT);

  const content = `
    <div class="markdown-content">
        ${policyHtml}
    </div>
    <div class="mt-6 text-center">
        ${Components.button({
          text: '閉じる',
          action: 'closePrivacyPolicy',
          style: 'secondary',
          size: 'normal',
        })}
    </div>`;

  return Components.modal({
    id: 'privacy-policy-modal',
    title: 'プライバシーポリシー',
    content: content,
    maxWidth: 'max-w-3xl',
    showCloseButton: true,
  });
};
