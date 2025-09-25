# パフォーマンス最適化計画書

**プロジェクト**: きぼりの よやく・きろく **作成日**: 2025年9月24日 **対象**: Google Apps Script Web Application

## 📋 エグゼクティブサマリー

現在のシステムは初回アクセス時に**合計13秒**の待機時間が発生しており、ユーザビリティに深刻な問題があります。本計画書では、段階的なアプローチにより**85%の処理時間短縮（2-3秒）**を実現する最適化案を提示します。

## 📊 現状分析

### パフォーマンス問題の詳細

| 処理段階                | 現在の処理時間 | 主要原因                          | 影響度      |
| ----------------------- | -------------- | --------------------------------- | ----------- |
| **ログイン画面表示**    | **5秒**        | 初期化待機ポーリング（300ms間隔） | 🔴 High     |
| **認証→ダッシュボード** | **8秒**        | Schedule Master診断処理の毎回実行 | 🔴 High     |
| **合計初回アクセス**    | **13秒**       | -                                 | 🔴 Critical |

### 技術的根本原因

#### 1. ログイン画面表示ボトルネック

- **ファイル**: `src/templates/10_WebApp.html:117-153`
- **問題**: `initializeApp()`での300ms間隔ポーリング待機
- **コード例**:

  ```javascript
  const checkReady = setInterval(() => {
    // 条件チェック...
  }, 300); // 非効率な300ms間隔
  ```

#### 2. 認証・初期データ取得ボトルネック

- **ファイル**: `src/backend/09_Backend_Endpoints.js:345-371`
- **問題**: 毎回`diagnoseAndFixScheduleMasterCache()`を実行
- **影響**: キャッシュ存在時でも重い診断処理を実行

#### 3. シーケンシャル処理の非効率性

```
現在: ログイン画面(5秒) → 認証+データ取得(8秒) → 表示
改善: ログイン画面(1秒) || バックグラウンド取得 → 高速表示
```

## 🎯 最適化戦略

### 戦略概要：バックグラウンド事前取得アーキテクチャ

**現在のシーケンシャル処理:**

```
ログイン画面表示(5秒) → 認証処理 + 初期データ取得(8秒) → ダッシュボード表示
```

**改善後の並行処理:**

```
ログイン画面表示(1秒) || バックグラウンド: 初期データ事前取得
                    ↓
軽量認証処理(1秒) → 事前取得データ使用 → ダッシュボード表示
```

### 段階的実装アプローチ

## 🚀 実装計画

### フェーズ1：即効性の高い基本最適化

**実装期間**: 1-2時間 **リスクレベル**: 🟢 Low

#### 1.1 初期化待機処理の改善

**対象ファイル**: `src/templates/10_WebApp.html`

**現在の実装**:

```javascript
// 300ms間隔の非効率なポーリング
const checkReady = setInterval(() => {
  // 条件チェック
}, 300);
```

**改善案**:

```javascript
// 100ms間隔 + タイムアウト機能
const checkReady = setInterval(() => {
  // 条件チェック
}, 100);

// フォールバック機能追加
setTimeout(() => {
  if (!initialized) {
    console.warn('初期化タイムアウト - フォールバック処理実行');
    performFallbackInitialization();
  }
}, 3000);
```

**期待効果**: ログイン画面表示 5秒 → 1-2秒

#### 1.2 Schedule Master診断頻度の制御

**対象ファイル**: `src/backend/09_Backend_Endpoints.js`

**現在の問題**:

```javascript
// 毎回診断処理を実行（非効率）
if (!scheduleMaster || scheduleMaster.length === 0) {
  diagnoseAndFixScheduleMasterCache(); // 重い処理
}
```

**改善案**:

```javascript
function shouldRunScheduleMasterDiagnosis() {
  const lastDiagnosis = PropertiesService.getScriptProperties().getProperty('LAST_SCHEDULE_DIAGNOSIS');
  const now = Date.now();
  const interval = 30 * 60 * 1000; // 30分間隔

  if (!lastDiagnosis) return true;
  return now - parseInt(lastDiagnosis) > interval;
}

// 条件分岐で診断頻度を制御
if (!scheduleMaster || scheduleMaster.length === 0) {
  if (shouldRunScheduleMasterDiagnosis()) {
    diagnoseAndFixScheduleMasterCache();
    PropertiesService.getScriptProperties().setProperty('LAST_SCHEDULE_DIAGNOSIS', Date.now().toString());
  }
}
```

**期待効果**: 認証→ダッシュボード 8秒 → 3-4秒（診断スキップ時）

### フェーズ2：バックグラウンド事前取得実装

**実装期間**: 2-3時間 **リスクレベル**: 🟡 Medium

#### 2.1 フロントエンドでの事前取得ロジック

**対象ファイル**: `src/templates/10_WebApp.html`

**新規実装**:

```javascript
// グローバルキャッシュ管理
window.appCache = {
  initialData: null,
  loading: false,
  timestamp: null,
  maxAge: 5 * 60 * 1000, // 5分間有効
};

// ログイン画面表示と同時に開始
function startPreloadInitialData() {
  if (window.appCache.loading) {
    console.log('事前取得は既に実行中です');
    return;
  }

  // キャッシュの有効性チェック
  if (isPreloadedDataValid()) {
    console.log('有効な事前取得データが存在します');
    return;
  }

  console.log('🚀 バックグラウンドで初期データ取得開始');
  window.appCache.loading = true;

  google.script.run.withSuccessHandler(handlePreloadSuccess).withFailureHandler(handlePreloadFailure).getAppInitialData();
}

function handlePreloadSuccess(data) {
  window.appCache = {
    initialData: data,
    loading: false,
    timestamp: Date.now(),
  };
  console.log('✅ 初期データの事前取得完了:', data.success);
  updatePreloadStatus('完了');
}

function handlePreloadFailure(error) {
  console.warn('❌ 事前取得失敗:', error);
  window.appCache.loading = false;
  updatePreloadStatus('失敗');
}

function isPreloadedDataValid() {
  if (!window.appCache.initialData || !window.appCache.timestamp) {
    return false;
  }

  const age = Date.now() - window.appCache.timestamp;
  return age < window.appCache.maxAge;
}

// ログイン画面初期化時に自動実行
function initializeLoginScreen() {
  // 既存の初期化処理
  // ...

  // 事前取得開始
  startPreloadInitialData();
}
```

#### 2.2 軽量認証処理の分離

**対象ファイル**: `src/backend/04_Backend_User.js`

**新規関数追加**:

```javascript
/**
 * 軽量認証：電話番号検証のみ実行（初期データ取得を除外）
 * @param {string} phoneNumber - 認証する電話番号
 * @returns {AuthResult} 認証結果（初期データなし）
 */
function authenticateUserLightweight(phoneNumber) {
  try {
    Logger.log(`軽量認証開始: ${phoneNumber}`);

    // 特殊ログインコマンドチェック
    const noPhoneLoginCommand = PropertiesService.getScriptProperties().getProperty('SPECIAL_NO_PHONE_LOGIN_COMMAND');

    if (noPhoneLoginCommand && phoneNumber === noPhoneLoginCommand) {
      logActivity('N/A', '特殊ログイン試行', '成功', `Command: ${phoneNumber}`);
      return { success: false, commandRecognized: 'all' };
    }

    // キャッシュから生徒データのみ取得
    const studentsCache = getCachedData(CACHE_KEYS.ALL_STUDENTS_BASIC);
    if (!studentsCache || !studentsCache.students) {
      throw new Error('生徒データのキャッシュが取得できません');
    }

    const allStudents = studentsCache.students;
    const normalizedInputPhone = _normalizeAndValidatePhone(phoneNumber).normalized;

    // 電話番号検証
    let foundUser = null;
    const studentIds = Object.keys(allStudents);

    for (const studentId of studentIds) {
      const student = allStudents[studentId];
      if (!student) continue;

      const storedPhone = _normalizeAndValidatePhone(student.phone).normalized;
      if (storedPhone && storedPhone === normalizedInputPhone) {
        foundUser = {
          studentId: student.studentId,
          displayName: String(student.nickname || student.realName),
          realName: student.realName,
          phone: student.phone,
        };
        break;
      }
    }

    if (foundUser) {
      logActivity(foundUser.studentId, '軽量ログイン試行', '成功', `電話番号: ${phoneNumber}`);
      return {
        success: true,
        user: foundUser,
        // 初期データは含めない（事前取得データを使用）
      };
    } else {
      logActivity('N/A', '軽量ログイン試行', '失敗', `電話番号: ${phoneNumber}`);
      return {
        success: false,
        message: '登録されている電話番号と一致しません。',
        registrationPhone: phoneNumber,
      };
    }
  } catch (err) {
    Logger.log(`軽量認証エラー: ${err.message}`);
    return {
      success: false,
      message: '認証処理中にエラーが発生しました。',
    };
  }
}

/**
 * 既存authenticateUser関数の拡張
 * @param {string} phoneNumber - 電話番号
 * @param {boolean} skipInitialData - 初期データ取得をスキップするか
 */
function authenticateUser(phoneNumber, skipInitialData = false) {
  if (skipInitialData) {
    return authenticateUserLightweight(phoneNumber);
  }

  // 既存の処理を継続
  // ... 既存コード
}
```

#### 2.3 フロントエンドでの統合処理

**実装ロジック**:

```javascript
/**
 * 最適化されたログイン処理
 * @param {string} phoneNumber - 入力された電話番号
 */
async function performOptimizedLogin(phoneNumber) {
  try {
    console.log('🔐 最適化ログイン開始');

    // 事前取得データの有効性チェック
    if (isPreloadedDataValid()) {
      console.log('✨ 事前取得データを使用した高速認証');

      // 軽量認証実行
      const authResult = await new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).authenticateUser(phoneNumber, true); // skipInitialData = true
      });

      if (authResult.success) {
        // 事前取得データと認証情報を統合
        const enrichedData = await enrichWithPersonalData(window.appCache.initialData.data, authResult.user);

        console.log('⚡ 高速ログイン成功 - ダッシュボード表示');
        showDashboard({
          success: true,
          user: authResult.user,
          initialData: enrichedData,
        });
        return;
      }
    }

    // フォールバック：従来の完全認証処理
    console.log('🔄 フォールバック: 完全認証処理実行');
    const fullResult = await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).authenticateUser(phoneNumber, false); // 従来の処理
    });

    if (fullResult.success) {
      console.log('✅ 完全認証成功 - ダッシュボード表示');
      showDashboard(fullResult);
    } else {
      handleAuthenticationError(fullResult);
    }
  } catch (error) {
    console.error('❌ ログイン処理エラー:', error);
    handleAuthenticationError({
      success: false,
      message: 'ログイン処理中にエラーが発生しました。',
    });
  }
}

/**
 * 個人データで初期データを拡張
 */
async function enrichWithPersonalData(initialData, user) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(personalData => {
        resolve({
          ...initialData,
          myReservations: personalData.myReservations,
        });
      })
      .withFailureHandler(reject)
      .extractPersonalDataFromCache(user.studentId, initialData);
  });
}
```

### フェーズ3：アーキテクチャ改善（中長期）

**実装期間**: 3-4時間 **リスクレベル**: 🟡 Medium-High

#### 3.1 段階的データ読み込み

**コンセプト**:

- 最小限データでダッシュボードを先に表示
- バックグラウンドで追加データを読み込み
- プログレッシブ読み込みUI実装

**実装例**:

```javascript
// 段階的データ読み込み
async function loadDashboardProgressively(user) {
  // ステップ1: 基本データでダッシュボード表示
  const basicData = await loadBasicDashboardData(user.studentId);
  showDashboard(basicData, { partial: true });

  // ステップ2: 詳細データをバックグラウンド読み込み
  const detailedData = await loadDetailedData(user.studentId);
  updateDashboard(detailedData);

  // ステップ3: 完全データ読み込み完了
  const fullData = await loadFullDashboardData(user.studentId);
  finalizeDashboard(fullData);
}
```

#### 3.2 キャッシュ戦略の最適化

**改善項目**:

- クライアントサイドキャッシュの導入
- キャッシュ有効期限の動的調整
- キャッシュヒット率向上施策

## 📈 期待効果とマイルストーン

### パフォーマンス改善目標

| フェーズ      | ログイン画面 | ダッシュボード | 合計時間  | 改善率     | ユーザー体感  |
| ------------- | ------------ | -------------- | --------- | ---------- | ------------- |
| **現状**      | 5秒          | 8秒            | **13秒**  | -          | 🔴 非常に遅い |
| **フェーズ1** | 1-2秒        | 3-4秒          | **4-6秒** | 60-70%短縮 | 🟡 改善       |
| **フェーズ2** | 1秒          | 1-2秒          | **2-3秒** | 80-85%短縮 | 🟢 高速       |
| **フェーズ3** | 1秒          | 1秒            | **2秒**   | 85%短縮    | 🟢 非常に高速 |

### 実装優先度マトリクス

#### 🔴 最優先（即座に実装推奨）

1. **初期化待機処理改善**
   - 実装難易度: 🟢 Easy
   - 効果: 🔴 High
   - リスク: 🟢 Low

2. **Schedule Master診断頻度制御**
   - 実装難易度: 🟢 Easy
   - 効果: 🟡 Medium
   - リスク: 🟢 Low

#### 🟡 高優先（短期実装）

3. **バックグラウンド事前取得**
   - 実装難易度: 🟡 Medium
   - 効果: 🔴 High
   - リスク: 🟡 Medium

4. **軽量認証処理分離**
   - 実装難易度: 🟡 Medium
   - 効果: 🔴 High
   - リスク: 🟡 Medium

#### 🟢 中優先（中長期実装）

5. **段階的データ読み込み**
   - 実装難易度: 🔴 Hard
   - 効果: 🟡 Medium
   - リスク: 🔴 High

## ⚠️ 実装時の重要事項

### リスク管理

#### バックアップ戦略

```bash
# 実装前の必須バックアップ
git add -A
git commit -m "feat: パフォーマンス最適化実装前のバックアップ"
git tag performance-optimization-backup-$(date +%Y%m%d)
```

#### 段階的テスト手順

1. **各フェーズ完了後の動作確認**

   ```bash
   npm run dev:build
   npm run dev:test
   ```

2. **パフォーマンス測定**
   - 処理時間のログ出力追加
   - ブラウザ開発者ツールでの計測
   - ユーザー体感テスト

#### フォールバック機能

```javascript
// 新機能失敗時の既存処理維持
function performLoginWithFallback(phoneNumber) {
  try {
    return await performOptimizedLogin(phoneNumber);
  } catch (error) {
    console.warn('最適化ログイン失敗 - フォールバック実行:', error);
    return await performTraditionalLogin(phoneNumber);
  }
}
```

### 互換性確保

#### API互換性

- **既存関数**: `authenticateUser`の既存呼び出しに影響なし
- **新機能**: 新しいオプションパラメータで拡張
- **移行期間**: 新旧処理の並行運用

#### データ整合性

- キャッシュデータのバージョン管理
- 事前取得データの有効性検証
- エラー時の適切なフォールバック

## 📋 実装チェックリスト

### フェーズ1チェックリスト

- [ ] `src/templates/10_WebApp.html`の初期化間隔を300ms→100msに変更
- [ ] タイムアウト機能の実装
- [ ] `src/backend/09_Backend_Endpoints.js`に診断頻度制御関数を追加
- [ ] PropertiesServiceでの最終診断時刻管理
- [ ] テスト環境での動作確認
- [ ] パフォーマンス測定と効果確認

### フェーズ2チェックリスト

- [ ] フロントエンドキャッシュ機能の実装
- [ ] 事前取得ロジックの追加
- [ ] 軽量認証関数の実装
- [ ] 既存authenticateUser関数の拡張
- [ ] 統合ログイン処理の実装
- [ ] エラーハンドリングとフォールバック機能
- [ ] 包括的テストの実行

### フェーズ3チェックリスト

- [ ] 段階的データ読み込み機能
- [ ] プログレッシブUI実装
- [ ] クライアントサイドキャッシュ最適化
- [ ] 最終的なパフォーマンス測定
- [ ] ユーザーアクセプタンステスト

## 🎯 成功指標

### 定量的指標

- **処理時間**: 13秒 → 2-3秒（85%短縮）
- **初期表示**: 5秒 → 1秒（80%短縮）
- **キャッシュヒット率**: 向上目標 90%以上

### 定性的指標

- **ユーザー体感**: "遅い" → "普通" → "速い"
- **システム安定性**: エラー率の維持または改善
- **開発保守性**: コードの可読性と拡張性

## 📞 サポートとメンテナンス

### 監視項目

- API応答時間の継続監視
- エラー率の追跡
- キャッシュ効率の分析

### 今後の改善案

- Service Workerを使用したオフライン対応
- WebAssembly活用による計算処理高速化
- CDN導入による静的リソース配信最適化

---

**この計画書により、きぼりの よやく・きろくシステムのパフォーマンスを劇的に改善し、ユーザーエクスペリエンスの大幅な向上を実現します。**
