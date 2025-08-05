/**
 * =================================================================
 * 【ファイル名】: unified-environment.js
 * 【作成者】: AIエージェント
 * 【役割】: テスト/本番環境統一管理
 * =================================================================
 */

/**
 * 実行環境検出
 */
function detectEnvironment() {
  try {
    // GAS環境でのみ利用可能なサービスをテスト
    SpreadsheetApp.getActiveSpreadsheet();
    return 'production';
  } catch (error) {
    // GAS以外の環境（ブラウザテストなど）
    return 'test';
  }
}

/**
 * 環境に応じたデータ取得
 */
function getEnvironmentData(dataType) {
  const env = detectEnvironment();

  if (env === 'test') {
    // テストデータを使用
    return getTestData(dataType);
  } else {
    // 本番データを使用
    return getProductionData(dataType);
  }
}

/**
 * テストデータ取得
 */
function getTestData(dataType) {
  const mockData = {
    user: {
      id: 'test-user-001',
      name: 'テストユーザー',
      email: 'test@example.com',
    },
    bookings: [
      {
        id: 'booking-001',
        date: '2025-08-05',
        time: '10:00',
        venue: 'テスト会場A',
      },
    ],
    settings: {
      theme: 'light',
      notifications: true,
    },
  };

  return mockData[dataType] || null;
}

/**
 * 本番データ取得
 */
function getProductionData(dataType) {
  switch (dataType) {
    case 'user':
      return getUserData();
    case 'bookings':
      return getBookingData();
    case 'settings':
      return getSettingsData();
    default:
      return null;
  }
}

/**
 * 統一ビュー生成関数（環境自動検出）
 */
function generateUnifiedView(viewType, params = {}) {
  const env = detectEnvironment();
  const data = getEnvironmentData(viewType);

  console.log(`Generating ${viewType} view in ${env} environment`);

  // 環境に関係なく同一のビューロジック
  switch (viewType) {
    case 'login':
      return generateLoginView(data, env);
    case 'dashboard':
      return generateDashboardView(data, env);
    case 'booking':
      return generateBookingView(data, env);
    default:
      return `<div>Unknown view type: ${viewType}</div>`;
  }
}

/**
 * ログインビュー生成（統一）
 */
function generateLoginView(data, env) {
  const debugInfo =
    env === 'test' ? `<div class="text-xs text-gray-500 mb-2">🧪 テスト環境</div>` : '';

  return `
    ${debugInfo}
    <div class="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h2 class="text-2xl font-bold mb-4 text-center">ログイン</h2>
      <form>
        <input type="email" placeholder="メールアドレス"
               class="w-full mb-3 p-2 border rounded">
        <input type="password" placeholder="パスワード"
               class="w-full mb-4 p-2 border rounded">
        <button type="submit"
                class="w-[200px] mx-auto block bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600">
          ログイン
        </button>
      </form>
    </div>
  `;
}

/**
 * ダッシュボードビュー生成（統一）
 */
function generateDashboardView(data, env) {
  const debugInfo =
    env === 'test'
      ? `<div class="text-xs text-gray-500 mb-2">🧪 テスト環境 - ユーザー: ${data?.user?.name}</div>`
      : '';

  return `
    ${debugInfo}
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6">ダッシュボード</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white p-4 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-3">予約状況</h3>
          ${
            data?.bookings
              ?.map(
                booking => `
            <div class="border-b pb-2 mb-2">
              <div>${booking.date} ${booking.time}</div>
              <div class="text-sm text-gray-600">${booking.venue}</div>
            </div>
          `,
              )
              .join('') || '<div class="text-gray-500">予約がありません</div>'
          }
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-3">クイックアクション</h3>
          <button class="w-[200px] mx-auto block bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 mb-2">
            新規予約
          </button>
          <button class="w-[200px] mx-auto block bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600">
            履歴確認
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 開発用：即時テスト実行
 */
function runUnifiedTest() {
  console.log('=== 統一環境テスト開始 ===');

  const env = detectEnvironment();
  console.log(`実行環境: ${env}`);

  // 各ビューをテスト
  const views = ['login', 'dashboard'];

  views.forEach(viewType => {
    console.log(`\n--- ${viewType} ビューテスト ---`);
    const html = generateUnifiedView(viewType);

    // ボタンスタイル確認
    const hasCorrectWidth = html.includes('w-[200px]');
    const hasCorrectMargin = html.includes('mx-auto');

    console.log(`✓ w-[200px]: ${hasCorrectWidth ? '✅' : '❌'}`);
    console.log(`✓ mx-auto: ${hasCorrectMargin ? '✅' : '❌'}`);
    console.log(`✓ HTML length: ${html.length} characters`);
  });

  console.log('\n=== 統一環境テスト完了 ===');
}
