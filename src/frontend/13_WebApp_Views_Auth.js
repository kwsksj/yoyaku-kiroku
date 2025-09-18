// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 13_WebApp_Views_Auth.js
 * 【バージョン】: 1.0
 * 【役割】: 認証関連のビュー（ログイン、新規登録、プロフィール編集）を管理
 * 【構成】: Views.jsから分割された認証関連機能
 * =================================================================
 */

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
const getLoginView = () => {
  const phoneValue = stateManager.getState()['loginPhone'] || '';
  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <div class="text-center pt-8 pb-4">
          <h1 class="text-3xl font-bold text-brand-text tracking-tight">きぼりの<br>よやく・きろく</h1>
          <h2 class="text-xl text-brand-subtle mt-2 mb-10">川崎誠二 木彫り教室</h2>
      </div>
      <div class="${DesignConfig.inputs.container}">
        <label for="phone" class="block text-brand-subtle text-sm text-center mb-1">電話番号</label>
        <input
          type="tel"
          id="phone"
          value="${phoneValue}"
          class="${DesignConfig.inputs.base} text-center"
          placeholder="090 1234 5678"
          autocomplete="tel"
          inputmode="numeric"
          pattern="[0-9]*"
        >
      </div>
      ${Components.actionButtonSection({
        primaryButton: {
          action: 'login',
          text: 'ログイン または 新規登録',
          style: 'primary',
        },
        spacing: 'normal',
      })}
    `,
  });
};

/**
 * ユーザー情報入力フォーム（新規登録・プロフィール編集共通）
 * 【統合設計】新規登録と編集を1つの関数で処理する効率的な実装
 * @param {UserFormConfig} config - 設定オブジェクト
 * @returns {HTMLString} HTML文字列
 */
const getUserFormView = config => {
  const { mode, phone } = config;
  const isEdit = mode === 'edit';
  const u = stateManager.getState().currentUser || {};

  // 入力値の保持: 新規登録Step1ではstateManager.getState().registrationDataを参照
  let regData = /** @type {RegistrationFormData} */ (
    stateManager.getState()['registrationData'] || {}
  );
  const userData = /** @type {UserData} */ (u);
  const realNameValue = isEdit
    ? userData.realName || ''
    : regData.realName || '';
  const nicknameValue = isEdit
    ? userData.displayName || ''
    : regData.nickname || '';
  const phoneValue = isEdit
    ? stateManager.getState().registrationPhone || userData.phone || ''
    : regData.phone || phone || '';

  // 電話番号表示の判定
  const isPhoneInputNeeded =
    isEdit && (stateManager.getState().registrationPhone || !userData.phone);

  // タイトルと説明文
  const title = isEdit ? 'プロフィール編集' : '新規登録';
  const description = isEdit
    ? ''
    : '<p class="text-brand-subtle mb-6">お名前を登録してください。</p>';

  // 電話番号セクション
  let phoneSection = '';
  if (!isEdit) {
    // 新規登録時：電話番号を表示のみ
    phoneSection = `
        <div class="mb-4">
            <label class="block text-brand-text text-base font-bold mb-2">電話番号</label>
            <input type="tel" id="reg-phone" value="${phoneValue}" class="${DesignConfig.inputs.base}" placeholder="090 1234 5678" autocomplete="tel" inputmode="numeric" pattern="[0-9]*">
        </div>`;
  } else if (isPhoneInputNeeded) {
    // プロフィール編集時：電話番号入力が必要
    phoneSection = `
        <div class="mb-4">
            <label for="edit-phone" class="block text-brand-text text-base font-bold mb-2">電話番号</label>
            <input type="tel" id="edit-phone" value="${phoneValue}"
                   class="${DesignConfig.inputs.base}" placeholder="090 1234 5678"
                   autocomplete="tel" inputmode="numeric" pattern="[0-9]*">
            <p class="text-sm text-brand-subtle mt-1">電話番号を登録すると次回からスムーズにログインできます。</p>
        </div>`;
  } else {
    // プロフィール編集時：電話番号表示のみ
    phoneSection = `
        <div class="mb-4">
            <label class="block text-brand-text text-base font-bold mb-2">電話番号</label>
            <p class="font-semibold p-3 bg-ui-surface text-brand-text rounded-lg w-auto inline-block">${phoneValue}</p>
        </div>`;
  }

  // メール設定セクション（プロフィール編集時のみ）
  const emailSection = isEdit
    ? `
        <div class="space-y-4">
          ${Components.input({
            id: 'edit-email',
            label: 'メールアドレス',
            type: 'email',
            value: /** @type {UserData} */ (u).email || '',
            placeholder: 'example@email.com',
          })}
          <div class="p-3 bg-ui-surface rounded-md">
            <label class="flex items-center space-x-3">
              <input type="checkbox" id="edit-wants-email"
                     class="h-5 w-5 accent-action-primary-bg"
                     ${/** @type {UserData} */ (u).wantsEmail ? 'checked' : ''}>
              <span class="text-brand-text text-sm">メール連絡を希望します（教室日程、予約受付、など）**初回予約時は、すべての方へ連絡します**</span>
            </label>
          </div>
        </div>
      `
    : '';

  // ボタン設定
  // ボタン設定を統一フォーマットで定義
  const buttonConfig = isEdit
    ? {
        secondaryButton: {
          text: 'もどる',
          action: 'smartGoBack',
          style: /** @type {ComponentStyle} */ ('secondary'),
        },
        primaryButton: {
          text: 'この内容で更新',
          action: 'saveProfile',
          style: /** @type {ComponentStyle} */ ('primary'),
        },
      }
    : {
        secondaryButton: {
          text: 'もどる',
          action: 'goBackToLogin',
          style: /** @type {ComponentStyle} */ ('secondary'),
        },
        primaryButton: {
          text: 'すすむ',
          action: 'goToStep2',
          style: /** @type {ComponentStyle} */ ('primary'),
        },
      };

  const nameIdPrefix = isEdit ? 'edit' : 'reg';

  return `
        <div class="max-w-md mx-auto">
            <h1 class="text-xl font-bold text-brand-text mb-4">${title}</h1>
            ${description}
            <div class="space-y-4">
              ${Components.input({
                id: `${nameIdPrefix}-realname`,
                label: 'お名前 *必須項目*',
                type: 'text',
                required: true,
                value: realNameValue,
                containerClass: '',
                autocomplete: 'name',
              })}
              ${Components.input({
                id: `${nameIdPrefix}-nickname`,
                label: 'ニックネーム（表示名）',
                caption: '他の生徒さんにも表示されます',
                type: 'text',
                value: nicknameValue,
                placeholder: '空欄の場合はお名前',
                containerClass: '',
              })}
              ${phoneSection}
              ${emailSection}
            </div>

            ${Components.actionButtonSection({
              ...buttonConfig,
              layout: 'horizontal',
            })}
        </div>`;
};

/**
 * 新規登録画面（ステップ1）
 * 【設計方針】userFormViewへの簡潔なラッパー
 * @param {PhoneNumber} p - 電話番号
 * @returns {HTMLString} HTML文字列
 */
const getRegisterView = p => getUserFormView({ mode: 'register', phone: p });

/**
 * 新規登録フローのステップ2（プロフィール詳細）
 * 【設計方針】ステップ式登録により、ユーザー負担を軽減
 * @returns {string} プロフィール詳細フォームのHTML文字列
 */
const getRegistrationStep2View = () => {
  const data = /** @type {RegistrationFormData} */ (
    stateManager.getState()['registrationData']
  );
  const genderOptions = ['女性', '男性', 'その他']
    .map(
      opt =>
        `<label class="flex items-center space-x-2"><input type="radio" name="gender" value="${opt}" ${data?.gender === opt ? 'checked' : ''}><span class="text-brand-text">${opt}</span></label>`,
    )
    .join('');
  const handOptions = ['右利き', '左利き', '両利き']
    .map(
      opt =>
        `<label class="flex items-center space-x-2"><input type="radio" name="dominantHand" value="${opt}" ${data?.dominantHand === opt ? 'checked' : ''}><span class="text-brand-text">${opt}</span></label>`,
    )
    .join('');
  const ageOptions = [
    '----',
    '10代（16歳以上）',
    '20代',
    '30代',
    '40代',
    '50代',
    '60代',
    '70代',
    '80代以上',
    'ひみつ',
  ]
    .map(
      opt =>
        `<option value="${opt}" ${data?.ageGroup === opt ? 'selected' : ''}>${opt}</option>`,
    )
    .join('');

  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <h1 class="text-xl font-bold text-brand-text mb-4 text-center">プロフィール</h1>
      <form id="step2-form" class="space-y-6">
        ${Components.input({ id: 'q-email', label: 'メールアドレス *必須項目*', type: 'email', value: data?.email || '', required: true })}
        <div class="p-3 bg-ui-surface rounded-md">
          <label class="flex items-center space-x-3">
            <input type="checkbox" id="q-wants-email" name="wantsEmail" class="h-5 w-5 accent-action-primary-bg" ${data?.wantsEmail ? 'checked' : ''}>
            <span class="text-brand-text text-sm">メール連絡を希望します（教室日程、予約受付、など）</span>
          </label>
        </div>
        ${Components.input({ id: 'q-address', label: '住所（市区町村のみ）', type: 'text', value: data?.address || '', required: false })}
        <div>
          <label class="block text-brand-text text-sm font-medium mb-2">年代</label>
          <select id="q-age" name="ageGroup" class="${DesignConfig.inputs.base}">${ageOptions}</select>
        </div>
        <div>
          <label class="block text-brand-text text-sm font-medium mb-2">性別</label>
          <div class="space-y-2">${genderOptions}</div>
        </div>
        <div>
          <label class="block text-brand-text text-sm font-medium mb-2">利き手</label>
          <div class="space-y-2">${handOptions}</div>
        </div>
        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'goBackToStep1',
            style: 'secondary',
          },
          primaryButton: {
            text: 'すすむ',
            action: 'goToStep3',
            style: 'primary',
          },
          layout: 'horizontal',
        })}
      </form>
    `,
  });
};

/**
 * 新規登録フローのステップ3（参加動機・経験）
 * 【設計方針】ユーザーの背景を理解し、適切な指導を行うためのアンケート
 * @returns {string} 参加動機フォームのHTML文字列
 */
const getRegistrationStep3View = () => {
  const data = /** @type {RegistrationFormData} */ (
    stateManager.getState()['registrationData'] || {}
  );

  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <h1 class="text-xl font-bold text-brand-text mb-4 text-center">ご経験・ご希望について</h1>
      <form id="step3-form" class="space-y-6">
        ${Components.textarea({
          id: 'q-experience',
          label: '木彫りや手工芸のご経験',
          value: data['experience'] || '',
          placeholder:
            '例：全くの初心者です、数年前に一度体験したことがあります、彫刻刀は使ったことがあります、など',
          rows: 3,
        })}
        ${Components.textarea({
          id: 'q-past-work',
          label: '過去に作った作品や手工芸（なければ空欄で）',
          value: data['pastWork'] || '',
          placeholder:
            '例：学校の図工で木彫りをしました、趣味で粘土を触ったことがあります、など',
          rows: 2,
        })}
        ${Components.textarea({
          id: 'q-future-goal',
          label: '将来的に作ってみたいもの',
          value: data['futureGoal'] || '',
          placeholder: '例：小さな動物の置物、実用的な器、など',
          rows: 2,
        })}
        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'goBackToStep2',
            style: 'secondary',
          },
          primaryButton: {
            text: 'すすむ',
            action: 'goToStep4',
            style: 'primary',
          },
          layout: 'horizontal',
        })}
      </form>
    `,
  });
};

/**
 * 新規登録フローのステップ4（参加頻度・きっかけ）
 * 【設計方針】教室運営の参考データ収集
 * @returns {string} 最終アンケートフォームのHTML文字列
 */
const getRegistrationStep4View = () => {
  const data = /** @type {RegistrationFormData} */ (
    stateManager.getState()['registrationData'] || {}
  );

  const participationOptions = [
    '月1回程度',
    '月2-3回程度',
    '週1回程度',
    '不定期（時間があるとき）',
    'まだ分からない',
  ]
    .map(
      opt =>
        `<label class="flex items-center space-x-2"><input type="radio" name="futureParticipation" value="${opt}" ${data['futureParticipation'] === opt ? 'checked' : ''}><span class="text-brand-text">${opt}</span></label>`,
    )
    .join('');

  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <h1 class="text-xl font-bold text-brand-text mb-4 text-center">参加について</h1>
      <form id="step4-form" class="space-y-6">
        <div>
          <label class="block text-brand-text text-sm font-medium mb-3">今後の参加頻度の希望</label>
          <div class="space-y-2">${participationOptions}</div>
        </div>
        ${Components.textarea({
          id: 'q-trigger',
          label: '木彫り教室を知ったきっかけ',
          value: data['trigger'] || '',
          placeholder: '例：友人の紹介、ウェブ検索、SNS、など',
          rows: 2,
        })}
        ${Components.textarea({
          id: 'q-first-message',
          label: '講師へのメッセージ（任意）',
          value: data['firstMessage'] || '',
          placeholder: '何かございましたら、お気軽にお書きください',
          rows: 3,
        })}
        ${Components.actionButtonSection({
          secondaryButton: {
            text: 'もどる',
            action: 'goBackToStep3',
            style: 'secondary',
          },
          primaryButton: {
            text: '登録完了',
            action: 'completeRegistration',
            style: 'primary',
          },
          layout: 'horizontal',
        })}
      </form>
    `,
  });
};

/**
 * ユーザー検索画面
 * 【用途】管理者向け機能：電話番号検索による既存ユーザー情報閲覧
 * @returns {HTMLString} ユーザー検索画面のHTML文字列
 */
const getUserSearchView = () => {
  return Components.pageContainer({
    maxWidth: 'md',
    content: `
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-brand-text mb-2">ユーザー検索</h1>
        <p class="text-brand-subtle">電話番号でユーザー情報を検索できます</p>
      </div>

      <div class="space-y-4">
        ${Components.input({
          id: 'search-phone',
          label: '電話番号',
          type: 'tel',
          placeholder: '090 1234 5678',
          autocomplete: 'tel',
        })}

        ${Components.actionButtonSection({
          primaryButton: {
            action: 'searchUser',
            text: '検索',
            style: 'primary',
          },
          secondaryButton: {
            action: 'goBackToDashboard',
            text: 'もどる',
            style: 'secondary',
          },
          layout: 'horizontal',
        })}
      </div>

      <div id="search-results" class="mt-6"></div>
    `,
  });
};

/**
 * プロフィール編集画面
 * 【設計方針】getUserFormViewへの簡潔なラッパー
 * @returns {HTMLString} HTML文字列
 */
const getEditProfileView = () => getUserFormView({ mode: 'edit' });
