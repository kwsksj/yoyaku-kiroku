/**
 * =================================================================
 * ファイル概要
 * -----------------------------------------------------------------
 * 名称: 13_WebApp_Views_Auth.js
 * 目的: 認証・プロフィール領域のビューをまとめて生成する
 * 主な責務:
 *   - ログイン/登録/プロフィール更新画面のHTMLを返す
 *   - stateManager の値を参照してフォーム初期値を整形
 *   - 電話番号フォーマットなどのユーティリティと連携
 * AI向けメモ:
 *   - 新しい認証ステップを追加する際は既存ビューを参考にし、`Components`でUI統一を図る
 * =================================================================
 */

// ================================================================
// UI系モジュール
// ================================================================
import { Components } from './13_WebApp_Components.js';

// ================================================================
// ユーティリティ系モジュール
// ================================================================
import { formatPhoneNumberForDisplay } from './14_WebApp_Handlers_Utils.js';

const authViewsStateManager = appWindow.stateManager;
// =================================================================
// --- Authentication Views ---
// -----------------------------------------------------------------
// ログイン、新規登録、プロフィール編集に関連するビュー関数群
// =================================================================

/**
 * ログイン画面
 * 【主要機能】電話番号入力による認証とユーザー識別
 * @returns {HTMLString} ログイン画面のHTML文字列
 */
export const getLoginView = () => {
  const phoneValue = authViewsStateManager.getState()['loginPhone'] || '';
  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <div class="w-full pt-12 pb-64 md:pt-16 md:pb-64">
        <div class="w-full space-y-6">
          <div class="text-center">
            <h1 class="text-3xl font-bold text-brand-text tracking-tight">きぼりの<br>よやく・きろく</h1>
            <h2 class="text-xl text-brand-subtle mt-1">川崎誠二 木彫り教室</h2>
          </div>
          <div class="${DesignConfig.inputs.container}">
            <label for="phone" class="block text-brand-subtle text-base text-center mb-2">携帯電話番号</label>
            <div class="flex justify-center">
              <input
                type="tel"
                id="phone"
                value="${phoneValue}"
                class="${DesignConfig.inputs.phone} text-center"
                placeholder="090 1234 5678"
                autocomplete="tel"
                inputmode="numeric"
                pattern="[0-9]*"
              >
            </div>
          </div>
          ${Components.actionButtonSection({
            primaryButton: {
              action: 'login',
              text: 'ログイン または 新規登録',
              style: 'primary',
            },
            spacing: 'compact',
          })}
        </div>
      </div>
    `,
  });
};

/**
 * 新規登録画面（ステップ1）
 * 【設計方針】step2〜4と統一的な構造
 * @param {PhoneNumber} phone - 電話番号
 * @returns {HTMLString} HTML文字列
 */
export const getRegistrationStep1View = phone => {
  const data = /** @type {RegistrationFormData} */ (
    authViewsStateManager.getState()['registrationData'] || {}
  );
  const phoneValue = data.phone || phone || '';

  // 電話番号セクション（常に表示のみ・編集不可）
  const formattedPhoneValue =
    typeof formatPhoneNumberForDisplay === 'function'
      ? formatPhoneNumberForDisplay(phoneValue)
      : phoneValue;

  return `
    ${Components.pageHeader({
      title: '新規登録',
      showBackButton: false,
    })}
    ${Components.pageContainer({
      maxWidth: 'md',
      content: `
        <form id="register-step1-form" class="space-y-4">
        ${Components.input({
          id: 'reg-realname',
          label: 'お名前 *必須項目*',
          type: 'text',
          required: true,
          value: data.realName || '',
          containerClass: '',
          autocomplete: 'name',
        })}
        ${Components.input({
          id: 'reg-nickname',
          label: 'ニックネーム（表示名）',
          caption: '他の生徒さんにも表示されます',
          type: 'text',
          value: data.nickname || '',
          placeholder: '空欄の場合はお名前',
          containerClass: '',
        })}
        <div class="mb-4">
          <label class="block text-brand-text text-base font-bold mb-2">携帯電話番号</label>
          <p class="font-semibold p-3 bg-ui-surface text-brand-text rounded-lg w-auto inline-block"><span class="font-mono-numbers">${formattedPhoneValue}</span></p>
        </div>
        ${Components.input({
          id: 'reg-email',
          label: 'メールアドレス *必須項目*',
          type: 'email',
          value: data.email || '',
          placeholder: 'example@email.com',
          required: true,
          autocomplete: 'email',
        })}
        ${Components.cardContainer({
          variant: 'default',
          content: `
            ${Components.checkbox({
              id: 'reg-wants-schedule-notification',
              label: '教室日程 のメール連絡（毎月）を希望する',
              checked: data['wantsScheduleNotification'] ?? true,
              onChange:
                "document.getElementById('reg-schedule-notification-settings').classList.toggle('hidden', !this.checked)",
            })}
            <div id="reg-schedule-notification-settings" class="grid grid-cols-2 gap-3 mt-3 ${data['wantsScheduleNotification'] === false ? 'hidden' : ''}">
              ${Components.select(
                /** @type {SelectConfig} */ (
                  /** @type {unknown} */ ({
                    id: 'reg-notification-day',
                    label: '送信日',
                    options: [
                      { value: '5', label: '毎月5日' },
                      { value: '15', label: '毎月15日' },
                      { value: '25', label: '毎月25日' },
                    ],
                    selectedValue: String(data['notificationDay'] || '25'),
                  })
                ),
              )}
              ${Components.select(
                /** @type {SelectConfig} */ (
                  /** @type {unknown} */ ({
                    id: 'reg-notification-hour',
                    label: '送信時刻',
                    options: [
                      { value: '9', label: '9時' },
                      { value: '12', label: '12時' },
                      { value: '18', label: '18時' },
                      { value: '21', label: '21時' },
                    ],
                    selectedValue: String(data['notificationHour'] || '18'),
                  })
                ),
              )}
            </div>
          `,
        })}
        ${Components.cardContainer({
          variant: 'default',
          content: Components.checkbox({
            id: 'reg-wants-email',
            label: '予約受付 のメール連絡を希望する',
            checked: data.wantsEmail || false,
            caption:
              '初回予約時は、すべての方へ送信します。予約状況に関してはこのページで確認可能です。',
          }),
        })}
     </form>

        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'goBackToLogin',
            style: 'secondary',
          },
          primaryButton: {
            text: 'すすむ',
            action: 'goToStep2',
            style: 'primary',
          },
          layout: 'horizontal',
        })}
      `,
    })}
  `;
};

/**
 * 新規登録画面（ステップ1）へのラッパー（後方互換性のため）
 * @param {PhoneNumber} p - 電話番号
 * @returns {HTMLString} HTML文字列
 */
export const getRegisterView = p => getRegistrationStep1View(p);

/**
 * 新規登録フローのステップ2（プロフィール詳細）
 * 【設計方針】ステップ式登録により、ユーザー負担を軽減
 * @returns {string} プロフィール詳細フォームのHTML文字列
 */
export const getRegistrationStep2View = () => {
  const data = /** @type {RegistrationFormData} */ (
    authViewsStateManager.getState()['registrationData']
  );

  return `
    ${Components.pageHeader({
      title: '新規登録 - プロフィール',
      showBackButton: false,
    })}
    ${Components.pageContainer({
      maxWidth: 'md',
      content: `
        <form id="step2-form" class="space-y-6">
          ${Components.radioGroup({
            name: 'gender',
            label: '性別',
            options: [
              { value: '女性', label: '女性' },
              { value: '男性', label: '男性' },
              { value: 'その他', label: 'その他' },
            ],
            selectedValue: data?.gender || '',
            layout: 'horizontal',
          })}
          ${Components.radioGroup({
            name: 'dominantHand',
            label: '利き手',
            options: [
              { value: '右利き', label: '右利き' },
              { value: '左利き', label: '左利き' },
              { value: '両利き', label: '両利き' },
            ],
            selectedValue: data?.dominantHand || '',
            layout: 'horizontal',
          })}
          ${Components.select(
            /** @type {SelectConfig} */ (
              /** @type {unknown} */ ({
                id: 'q-age-group',
                label: '年代',
                options: [
                  { value: '----', label: '----' },
                  { value: '10代（13-15歳）', label: '10代（13-15歳）' },
                  { value: '10代（16-19歳）', label: '10代（16-19歳）' },
                  { value: '20代', label: '20代' },
                  { value: '30代', label: '30代' },
                  { value: '40代', label: '40代' },
                  { value: '50代', label: '50代' },
                  { value: '60代', label: '60代' },
                  { value: '70代', label: '70代' },
                  { value: '80代以上', label: '80代以上' },
                  { value: 'ひみつ', label: 'ひみつ' },
                ],
                selectedValue: data?.ageGroup || '',
              })
            ),
          )}
          ${Components.input({
            id: 'q-address',
            label: 'お住まいの地域',
            caption: '市区町村まででOK!',
            type: 'text',
            value: (data && data.address) || '',
          })}
        </form>
        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'backToStep1',
            style: 'secondary',
          },
          primaryButton: {
            text: 'すすむ',
            action: 'goToStep3',
            style: 'primary',
          },
          layout: 'horizontal',
        })}
      `,
    })}
  `;
};

/**
 * 新規登録フローのステップ3（木彫り関連情報）
 * 【UX配慮】動的表示制御により、経験者には詳細質問を表示
 * @returns {string} 木彫りアンケートフォームのHTML文字列
 */
export const getRegistrationStep3View = () => {
  const data = authViewsStateManager.getState()['registrationData'];

  return `
    ${Components.pageHeader({
      title: '新規登録 - 木彫りについて',
      showBackButton: false,
    })}
    ${Components.pageContainer({
      maxWidth: 'md',
      content: `
        <form id="step3-form" class="space-y-6">
          ${Components.radioGroup({
            name: 'experience',
            label: '木彫りの経験はありますか？',
            options: [
              { value: 'はじめて！', label: 'はじめて！' },
              { value: 'ちょっと', label: 'ちょっと' },
              { value: 'そこそこ', label: 'そこそこ' },
              { value: 'かなり！', label: 'かなり！' },
            ],
            selectedValue: data['experience'] || '',
            layout: 'vertical',
          })}
          <div id="past-work-container" class="${data['experience'] && data['experience'] !== 'はじめて！' ? '' : 'hidden'}">
            ${Components.textarea({
              id: 'q-past-work',
              label: 'いつ頃、どこで、何を作りましたか？',
              value: data['pastWork'] || '',
              placeholder: 'だいたいでOK！',
            })}
          </div>
          ${Components.textarea({
            id: 'q-future-goal',
            label: '将来的に制作したいものはありますか？',
            value: data['futureCreations'] || '',
            placeholder: '曖昧な内容でも大丈夫！',
          })}
        </form>
        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'backToStep2',
            style: 'secondary',
          },
          primaryButton: {
            text: 'すすむ',
            action: 'proceedToStep4',
            style: 'primary',
          },
          layout: 'horizontal',
        })}
      `,
    })}
  `;
};

/**
 * 新規登録フローのステップ4（アンケート）
 * 【設計方針】最終ステップでユーザーの参加意向とフィードバックを収集
 * @returns {string} アンケートフォームのHTML文字列
 */
export const getRegistrationStep4View = () => {
  const data = authViewsStateManager.getState()['registrationData'];

  return `
    ${Components.pageHeader({
      title: '新規登録 - アンケート',
      showBackButton: false,
    })}
    ${Components.pageContainer({
      maxWidth: 'md',
      content: `
        <form id="step4-form" class="space-y-6">
          ${Components.radioGroup({
            name: 'futureParticipation',
            label: '今後のご参加について',
            options: [
              { value: '毎月通いたい！', label: '毎月通いたい！' },
              {
                value: '2,3ヶ月ごとくらいで通いたい！',
                label: '2,3ヶ月ごとくらいで通いたい！',
              },
              {
                value: 'これるときにたまに通いたい！',
                label: 'これるときにたまに通いたい！',
              },
              { value: '1回やってみたい！', label: '1回やってみたい！' },
              {
                value: '通いたいがむずかしい…',
                label: '通いたいがむずかしい…',
              },
            ],
            selectedValue: data['futureParticipation'] || '',
            layout: 'vertical',
          })}

          ${Components.textarea({
            id: 'q-trigger',
            label: 'この教室を知ったきっかけは？参加しようと思ったきっかけは？',
            value: data['trigger'] || '',
          })}

          ${Components.textarea({
            id: 'q-first-message',
            label: 'メッセージ',
            value: data['firstMessage'] || '',
            placeholder: 'その他コメント・要望・意見など、あればどうぞ〜',
            rows: 6,
          })}

          ${Components.cardContainer({
            variant: 'default',
            customClass: 'mt-6',
            content: `
              <label class="flex items-start space-x-2 cursor-pointer">
                <input type="checkbox" id="privacy-policy-agree" class="h-5 w-5 mt-1 text-action-primary-bg focus:ring-action-primary-bg accent-action-primary-bg" required>
                <span class="text-sm text-brand-text">
                  <span data-action="showPrivacyPolicy" class="text-brand-muted underline hover:text-brand-text cursor-pointer">プライバシーポリシー</span>に同意します *必須項目
                </span>
              </label>
            `,
          })}
        </form>
        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'backToStep3',
            style: 'secondary',
          },
          primaryButton: {
            text: 'とうろく する！',
            action: 'submitRegistration',
            style: 'primary',
          },
          layout: 'horizontal',
        })}
      `,
    })}
  `;
};

/**
 * プロフィール編集画面
 * 【設計方針】step1と統一的な構造
 * @returns {HTMLString} HTML文字列
 */
export const getEditProfileView = () => {
  const userData = /** @type {UserCore} */ (
    authViewsStateManager.getState().currentUser || {}
  );
  const phoneValue = userData.phone || '';
  const formattedPhoneValue =
    typeof formatPhoneNumberForDisplay === 'function'
      ? formatPhoneNumberForDisplay(phoneValue)
      : phoneValue;

  // 「将来的に制作したいもの」の値を取得（生徒名簿シートから取得される想定）
  const futureCreationsValue =
    /** @type {any} */ (userData)['futureCreations'] || '';

  // 教室日程の連絡チェック状態を取得（シートの「日程連絡希望」列から）
  const wantsScheduleNotification =
    /** @type {any} */ (userData)['wantsScheduleNotification'] || false;

  return `
    ${Components.pageHeader({
      title: 'プロフィール編集',
      backAction: 'smartGoBack',
      showBackButton: true,
    })}
    ${Components.pageContainer({
      maxWidth: 'md',
      content: `
        <form id="edit-profile-form" class="space-y-4">
        ${Components.textarea({
          id: 'edit-future-goal',
          label: '将来的に制作したいもの',
          value: futureCreationsValue,
          placeholder: '曖昧な内容でも大丈夫！',
        })}
        ${Components.input({
          id: 'edit-realname',
          label: 'お名前 *必須項目*',
          type: 'text',
          required: true,
          value: userData.realName || '',
          containerClass: '',
          autocomplete: 'name',
        })}
        ${Components.input({
          id: 'edit-nickname',
          label: 'ニックネーム（表示名）',
          caption: '他の生徒さんにも表示されます',
          type: 'text',
          value: userData.nickname || '',
          placeholder: '空欄の場合はお名前',
          containerClass: '',
        })}
        <div class="mb-4">
          <label class="block text-brand-text text-base font-bold mb-2">携帯電話番号</label>
          <p class="font-semibold p-3 bg-ui-surface text-brand-text rounded-lg w-auto inline-block"><span class="font-mono-numbers">${formattedPhoneValue}</span></p>
        </div>
        ${Components.input({
          id: 'edit-email',
          label: 'メールアドレス *必須項目*',
          type: 'email',
          value: userData.email || '',
          placeholder: 'example@email.com',
          required: true,
          autocomplete: 'email',
        })}
        ${Components.cardContainer({
          variant: 'default',
          content: `
            ${Components.checkbox({
              id: 'edit-wants-schedule-notification',
              label: '教室日程 のメール連絡（毎月）を希望する',
              checked: wantsScheduleNotification,
              onChange:
                "document.getElementById('edit-schedule-notification-settings').classList.toggle('hidden', !this.checked)",
            })}
            <div id="edit-schedule-notification-settings" class="grid grid-cols-2 gap-3 mt-3 ${wantsScheduleNotification ? '' : 'hidden'}">
              ${Components.select(
                /** @type {SelectConfig} */ (
                  /** @type {unknown} */ ({
                    id: 'edit-notification-day',
                    label: '送信日',
                    options: [
                      { value: '5', label: '毎月5日' },
                      { value: '15', label: '毎月15日' },
                      { value: '25', label: '毎月25日' },
                    ],
                    selectedValue: String(
                      /** @type {any} */ (userData)['notificationDay'] || '25',
                    ),
                  })
                ),
              )}
              ${Components.select(
                /** @type {SelectConfig} */ (
                  /** @type {unknown} */ ({
                    id: 'edit-notification-hour',
                    label: '送信時刻',
                    options: [
                      { value: '9', label: '9時' },
                      { value: '12', label: '12時' },
                      { value: '18', label: '18時' },
                      { value: '21', label: '21時' },
                    ],
                    selectedValue: String(
                      /** @type {any} */ (userData)['notificationHour'] || '18',
                    ),
                  })
                ),
              )}
            </div>
          `,
        })}
        ${Components.cardContainer({
          variant: 'default',
          content: Components.checkbox({
            id: 'edit-wants-email',
            label: '予約受付 のメール連絡を希望する',
            checked: userData.wantsEmail || false,
            caption:
              '初回予約時は、すべての方へ送信します。予約状況に関してはこのページで確認可能です。',
          }),
        })}
        ${Components.input({
          id: 'edit-address',
          label: 'お住まいの地域',
          caption: '市区町村まででOK!',
          type: 'text',
          value: userData.address || '',
        })}
        </form>

        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'smartGoBack',
            style: 'secondary',
          },
          primaryButton: {
            text: 'この内容で更新',
            action: 'saveProfile',
            style: 'primary',
          },
          layout: 'horizontal',
        })}

        <div class="mt-8 pt-8 border-t border-ui-border">
          ${Components.button({
            text: 'アカウント退会',
            action: 'requestAccountDeletion',
            style: 'danger',
            size: 'full',
          })}
          <p class="text-xs text-brand-subtle text-center mt-2">退会するとログインできなくなります</p>
        </div>
      `,
    })}
  `;
};
