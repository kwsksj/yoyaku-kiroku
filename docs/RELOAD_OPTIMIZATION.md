# リロード最適化 実装ガイド

> このドキュメントは、画面リロード時のパフォーマンス最適化とUX改善のための技術詳細をまとめたものです。

## 目次

- [完了済み: データ再取得エラーのユーザー通知](#完了済みデータ再取得エラーのユーザー通知)
- [1. sessionStorageサイズ監視機能](#1-sessionstorageサイズ監視機能)
- [2. データ再取得のタイムアウト処理](#2-データ再取得のタイムアウト処理)
- [3. 必要な情報のローカル事前保存](#3-必要な情報のローカル事前保存)
- [4. フォーム入力キャッシュの重複コード削減](#4-フォーム入力キャッシュの重複コード削減)
- [5. 型定義の整備（formInputCache）](#5-型定義の整備forminputcache)

---

## ✅ 完了済み: データ再取得エラーのユーザー通知

### 実装日

2026-01-11 (PR #43)

### 概要

リロード時のデータ再取得が失敗した場合に、ユーザーへエラーメッセージを表示する機能を追加しました。

### 実装内容

`src/frontend/14_WebApp_Handlers.js` の `withFailureHandler` にエラー通知を追加：

```javascript
['withFailureHandler'](
  /** @param {Error} error */
  error => {
    console.error('❌ リロード復元: データ再取得エラー:', error);

    // ✅ ユーザーにエラーを通知
    showInfo('データの読み込みに失敗しました。再度ログインしてください。', 'エラー');

    // エラー時はログイン画面へ遷移
    handlersStateManager.dispatch({
      type: 'NAVIGATE',
      payload: { to: 'login' },
    });
    hideLoading();
    render();
  },
);
```

### メリット

- **ユーザーエクスペリエンス向上**: エラー発生時に何が起きたか明確に伝わる
- **デバッグ支援**: コンソールログとUIメッセージの両方で確認可能
- **低リスク実装**: 既存処理フローに影響なし

---

## 1. sessionStorageサイズ監視機能

### 概要

sessionStorageには容量制限（一般的に5-10MB）があるため、保存時にサイズを監視し、容量超過時の適切なエラーハンドリングが必要。

### 優先度

🟡 **中** - 「必要な情報のローカル事前保存」実装時に必須

### 実装箇所

`src/frontend/12_WebApp_StateManager.js` の `saveStateToStorage()` メソッド

### 実装方法

```javascript
/**
 * 状態をSessionStorageに保存します
 */
saveStateToStorage() {
  try {
    // 省略可能なデータを除外（サイズ削減）
    const stateToSave = {
      view: this.state.view,
      currentUser: this.state.currentUser,
      loginPhone: this.state.loginPhone,
      registrationData: this.state.registrationData,
      registrationPhone: this.state.registrationPhone,
      editingReservationIds: this.state.editingReservationIds,
      formInputCache: this.state['formInputCache'] || {},

      // 将来的に追加するデータ（要サイズ監視）
      lessons: this.state.lessons,
      myReservations: this.state.myReservations,
      accountingMaster: this.state.accountingMaster,

      // メタデータ
      savedAt: Date.now(),
      version: CONSTANTS.APP_VERSION,
    };

    // JSON文字列化
    const serialized = JSON.stringify(stateToSave);

    // サイズ計算（Blobを使って正確なバイトサイズを取得）
    const sizeInBytes = new Blob([serialized]).size;
    const sizeInMB = sizeInBytes / 1024 / 1024;

    // サイズ警告（4MB超過時）
    if (sizeInBytes > 4 * 1024 * 1024) {
      appWindow.PerformanceLog?.warn(
        `sessionStorage サイズが大きい: ${sizeInMB.toFixed(2)}MB (推奨: 4MB以下)`,
      );
    }

    // デバッグ用ログ（通常時は非表示）
    if (appWindow.PerformanceLog?.isDebugMode?.()) {
      appWindow.PerformanceLog.debug(
        `sessionStorage保存サイズ: ${sizeInMB.toFixed(2)}MB`,
      );
    }

    // sessionStorageに保存
    sessionStorage.setItem(this.storageKey, serialized);

  } catch (error) {
    // QuotaExceededError（容量超過）のハンドリング
    if (error.name === 'QuotaExceededError') {
      appWindow.PerformanceLog?.error(
        'sessionStorage容量超過: データを削減してください',
      );

      // フォールバック: 最小限のデータのみ保存
      const minimalState = {
        view: this.state.view,
        currentUser: this.state.currentUser,
        loginPhone: this.state.loginPhone,
        savedAt: Date.now(),
        version: CONSTANTS.APP_VERSION,
      };

      try {
        sessionStorage.setItem(this.storageKey, JSON.stringify(minimalState));
        appWindow.PerformanceLog?.warn('最小限の状態のみ保存しました');
      } catch (fallbackError) {
        appWindow.PerformanceLog?.error('最小限の保存も失敗しました');
      }
    } else {
      // その他のエラー
      appWindow.PerformanceLog?.error('sessionStorage保存エラー:', error);
    }
  }
}
```

### テスト方法

1. **通常時のサイズ確認**
   - ブラウザの開発者ツール → Application → Session Storage
   - 保存されているデータサイズを確認

2. **容量超過時のテスト**
   ```javascript
   // 開発者ツールのコンソールで実行
   // 大量のダミーデータを追加してテスト
   const dummyData = new Array(100000).fill('test');
   window.stateManager.dispatch({
     type: 'SET_STATE',
     payload: { dummyData },
   });
   ```

---

## 2. データ再取得のタイムアウト処理

### 概要

リロード時のデータ再取得が長時間かかる場合（ネットワーク不安定時など）、ユーザーを待たせないためにタイムアウト処理を追加。

### 優先度

🟡 **中** - ネットワーク不安定時のUX改善

### 実装箇所

`src/frontend/14_WebApp_Handlers.js` の `window.onload` 内、リロード復元処理

### 実装方法

```javascript
// リロード時のデータ再取得処理（window.onload内）
const restoredPhone = handlersStateManager.getRestoredPhone();
const needsRefresh = handlersStateManager.needsDataRefresh();

if (restoredPhone && needsRefresh) {
  console.log('🔄 リロード復元: データ再取得を開始します');

  const viewContainer = document.getElementById('view-container');
  if (viewContainer) {
    viewContainer.innerHTML = '';
  }
  showLoading('dataFetch');

  // タイムアウト設定（10秒）
  const TIMEOUT_MS = 10000;
  let timeoutId = null;
  let isCompleted = false;

  // タイムアウトハンドラ
  const handleTimeout = () => {
    if (isCompleted) return; // 既に完了している場合は何もしない

    console.error('❌ リロード復元: データ再取得がタイムアウトしました');

    // ユーザーに通知
    showInfo('データの読み込みに時間がかかっています。再度ログインしてください。', 'タイムアウト');

    // ログイン画面へ遷移
    handlersStateManager.dispatch({
      type: 'NAVIGATE',
      payload: { to: 'login' },
    });

    hideLoading();
    render();
  };

  // タイムアウトを設定
  timeoutId = setTimeout(handleTimeout, TIMEOUT_MS);

  // 成功ハンドラ
  const handleSuccess = response => {
    // 完了フラグを設定（タイムアウト処理を防ぐ）
    isCompleted = true;
    clearTimeout(timeoutId);

    if (response.success && response.userFound) {
      console.log('✅ リロード復元: データ再取得成功');

      // 既存の処理...（省略）

      handlersStateManager.markDataRefreshComplete();

      if (currentView === 'sessionConclusion') {
        tryRestoreWizardFromCache();
      }
    } else {
      console.warn('⚠️ リロード復元: ユーザーが見つかりません');
      handlersStateManager.dispatch({
        type: 'NAVIGATE',
        payload: { to: 'login' },
      });
    }

    hideLoading();
    render();
  };

  // エラーハンドラ
  const handleError = error => {
    // 完了フラグを設定
    isCompleted = true;
    clearTimeout(timeoutId);

    console.error('❌ リロード復元: データ再取得エラー:', error);

    showInfo('データの読み込みに失敗しました。再度ログインしてください。', 'エラー');

    handlersStateManager.dispatch({
      type: 'NAVIGATE',
      payload: { to: 'login' },
    });
    hideLoading();
    render();
  };

  // Google Apps Script API呼び出し
  google.script.run.withSuccessHandler(handleSuccess).withFailureHandler(handleError).getLoginData(restoredPhone);
}
```

### テスト方法

1. **タイムアウトのシミュレーション**
   - バックエンドの`getLoginData`に遅延を追加

   ```javascript
   function getLoginData(phone) {
     Utilities.sleep(12000); // 12秒待機（タイムアウト発生）
     // 既存の処理...
   }
   ```

2. **ネットワーク制限でのテスト**
   - Chrome DevTools → Network → Throttling → Slow 3G
   - リロードして動作確認

---

## 3. 必要な情報のローカル事前保存

### 概要

`lessons`, `myReservations`, `accountingMaster` などのデータをsessionStorageに保存し、リロード時のデータ再取得を削減。

### 優先度

🟡 **中** - UX向上、ただしデータ不整合リスク要対策

### 注意事項

⚠️ **データ不整合リスク**

- sessionStorageに保存されたデータと、サーバー側の最新データが異なる可能性
- バージョン管理・有効期限の仕組みが必須

### 実装方針

#### 3.1 データ保存の拡張

`src/frontend/12_WebApp_StateManager.js` の `saveStateToStorage()` を拡張：

```javascript
saveStateToStorage() {
  try {
    const stateToSave = {
      // 既存の保存データ
      view: this.state.view,
      currentUser: this.state.currentUser,
      loginPhone: this.state.loginPhone,
      registrationData: this.state.registrationData,
      registrationPhone: this.state.registrationPhone,
      editingReservationIds: this.state.editingReservationIds,
      formInputCache: this.state['formInputCache'] || {},

      // 追加: 基本データ（lessonsなど）
      lessons: this.state.lessons,
      myReservations: this.state.myReservations,
      accountingMaster: this.state.accountingMaster,

      // 管理者の場合のみadminLogsも保存（サイズが大きいので要検討）
      // adminLogs: this.state.currentUser?.isAdmin ? this.state['adminLogs'] : undefined,

      // メタデータ（データ整合性チェック用）
      savedAt: Date.now(),
      version: CONSTANTS.APP_VERSION,
      dataVersion: this.state.lessonsVersion || '', // データバージョン
    };

    // サイズチェック & 保存（前述の実装を使用）
    // ...
  } catch (error) {
    // エラーハンドリング
  }
}
```

#### 3.2 データ鮮度チェック

リロード時に保存データの有効性を確認：

```javascript
restoreStateFromStorage() {
  try {
    const saved = sessionStorage.getItem(this.storageKey);
    if (!saved) return false;

    const parsed = JSON.parse(saved);

    // データ有効期限チェック（例: 30分）
    const MAX_AGE_MS = 30 * 60 * 1000; // 30分
    const age = Date.now() - (parsed.savedAt || 0);

    if (age > MAX_AGE_MS) {
      appWindow.PerformanceLog?.warn(
        `保存データが古い（${Math.floor(age / 1000 / 60)}分前）ため再取得します`,
      );
      sessionStorage.removeItem(this.storageKey);
      return false;
    }

    // バージョンチェック
    if (parsed.version !== CONSTANTS.APP_VERSION) {
      appWindow.PerformanceLog?.warn(
        'アプリバージョンが異なるため保存データをクリアします',
      );
      sessionStorage.removeItem(this.storageKey);
      return false;
    }

    // データバージョンチェック（lessonsVersionと比較）
    // ※ サーバー側で最新バージョンを返す仕組みが必要

    // 状態を復元
    Object.assign(this.state, parsed);

    delete this.state.savedAt;
    delete this.state.dataVersion;

    appWindow.PerformanceLog?.info('状態とデータをSessionStorageから復元しました');
    return true;

  } catch (error) {
    appWindow.PerformanceLog?.error('SessionStorage復元エラー:', error);
    sessionStorage.removeItem(this.storageKey);
    return false;
  }
}
```

#### 3.3 データ再取得判定の修正

`needsDataRefresh()` を修正：

```javascript
needsDataRefresh() {
  // 復元されていなければ不要
  if (!this._restoredFromStorage) {
    return false;
  }

  // ユーザー情報がなければ不要
  if (!this.state.currentUser) {
    return false;
  }

  // ログイン画面の場合は不要
  if (this.state.view === 'login' || this.state.view === 'register') {
    return false;
  }

  // lessonsが復元されていればデータ再取得不要
  const hasLessons =
    this.state.lessons &&
    Array.isArray(this.state.lessons) &&
    this.state.lessons.length > 0;

  if (hasLessons) {
    appWindow.PerformanceLog?.info(
      'リロード復元: データがsessionStorageから復元されました（再取得スキップ）',
    );
    return false; // データ再取得不要
  }

  // データがない場合は再取得必要
  appWindow.PerformanceLog?.info(
    'リロード復元: lessonsデータがないため再取得必要',
  );
  return true;
}
```

### 実装時の注意点

1. **サイズ監視**
   - `lessons`は比較的小さい（数十件〜数百件）
   - `myReservations`も小さい（ユーザーごとに数十件）
   - `adminLogs`は大きい（数千〜数万件の可能性）→ 保存対象外を推奨

2. **データ不整合対策**
   - 有効期限（30分など）を設定
   - バージョンチェック（アプリバージョン、データバージョン）
   - サーバー側で最新データバージョンを返す仕組みが必要

3. **フォールバック**
   - データが古い場合は自動で再取得
   - エラー時はログイン画面へ遷移

---

## 4. フォーム入力キャッシュの重複コード削減

### 概要

ダッシュボード・履歴ビューで重複している`input`イベントリスナー設定を共通化。

### 優先度

🟢 **低** - 動作に問題なし、保守性向上のため

### 実装箇所

- `src/frontend/13_WebApp_Views_Dashboard.js`
- `src/frontend/14_WebApp_Handlers_History.js`
- `src/frontend/12_WebApp_StateManager.js` （共通メソッド追加）

### 現状の重複コード

#### ダッシュボード ([13_WebApp_Views_Dashboard.js:653-666](../src/frontend/13_WebApp_Views_Dashboard.js#L653-L666))

```javascript
// 編集開始時にキャッシュに保存
handlersStateManager['cacheFormInput']('goalEdit', {
  isEditing: true,
  text: textarea.value,
});
// 入力時にキャッシュを更新
textarea.addEventListener('input', () => {
  handlersStateManager['cacheFormInput']('goalEdit', {
    isEditing: true,
    text: textarea.value,
  });
});
textarea.focus();
```

#### 履歴ビュー ([14_WebApp_Handlers_History.js:67-82](../src/frontend/14_WebApp_Handlers_History.js#L67-L82))

```javascript
// 入力時にキャッシュを更新
setTimeout(() => {
  const textarea = document.getElementById(`memo-edit-textarea-${d.reservationId}`);
  if (textarea) {
    textarea.addEventListener('input', () => {
      historyStateManager['cacheFormInput'](`memoEdit:${d.reservationId}`, {
        isEditing: true,
        text: textarea.value,
      });
    });
  }
}, 100);
```

### 改善案: 共通メソッド追加

`src/frontend/12_WebApp_StateManager.js` に共通メソッドを追加：

```javascript
/**
 * textarea要素に入力キャッシュ機能を設定
 * リロード時の入力保持のため、編集中の内容をformInputCacheに自動保存
 *
 * @param {HTMLTextAreaElement} textarea - キャッシュ対象のtextarea要素
 * @param {string} cacheKey - キャッシュキー（例: 'goalEdit', 'memoEdit:reservationId'）
 * @param {boolean} [autoFocus=true] - 自動的にフォーカスするか
 */
setupTextareaCache(textarea, cacheKey, autoFocus = true) {
  if (!textarea) {
    appWindow.PerformanceLog?.warn(`setupTextareaCache: textarea not found for key "${cacheKey}"`);
    return;
  }

  // 初期値をキャッシュに保存
  this.cacheFormInput(cacheKey, {
    isEditing: true,
    text: textarea.value,
  });

  // 入力時にキャッシュを更新
  textarea.addEventListener('input', () => {
    this.cacheFormInput(cacheKey, {
      isEditing: true,
      text: textarea.value,
    });
  });

  // フォーカス
  if (autoFocus) {
    textarea.focus();
  }
}
```

### 使用例

#### ダッシュボード（改善後）

```javascript
// 編集モード開始
editGoal: () => {
  const displayMode = document.getElementById('goal-display-mode');
  const editMode = document.getElementById('goal-edit-mode');

  if (displayMode && editMode) {
    displayMode.classList.add('hidden');
    editMode.classList.remove('hidden');

    const textarea = document.getElementById('goal-edit-textarea');
    if (textarea) {
      // 共通メソッドを使用（3行で済む）
      handlersStateManager.setupTextareaCache(textarea, 'goalEdit');
    }
  }
},
```

#### 履歴ビュー（改善後）

```javascript
editInlineMemo: d => {
  // ... 既存の処理 ...

  // 該当カードのみを部分更新
  if (d.reservationId) {
    updateSingleHistoryCard(d.reservationId);

    // 共通メソッドを使用
    setTimeout(() => {
      const textarea = document.getElementById(`memo-edit-textarea-${d.reservationId}`);
      historyStateManager.setupTextareaCache(
        textarea,
        `memoEdit:${d.reservationId}`,
        false, // 自動フォーカスしない
      );
    }, 100);
  }

  // ... 既存の処理 ...
},
```

---

## 5. 型定義の整備（formInputCache）

### 概要

`UIState`インターフェースに`formInputCache`プロパティを明示的に追加し、型安全性を向上。

### 優先度

🟢 **低** - TypeScript型チェックの恩恵を受けるため

### 実装箇所

`types/frontend.d.ts`

### 実装方法

```typescript
/**
 * UIの状態を表す型
 */
interface UIState {
  // --- View State ---
  view: ViewType;
  previousView: ViewType | null;

  // --- User State ---
  currentUser: UserData | null;
  loginPhone: string;

  // --- Registration State ---
  registrationData: RegistrationData | null;
  registrationPhone: string;

  // --- Data State ---
  lessons: LessonCore[];
  myReservations: ReservationCore[];
  accountingMaster: AccountingItem[];
  lessonsVersion: string;

  // --- Edit State ---
  editingReservationIds: string[];

  // --- Computed Data ---
  computed: ComputedStateData;

  // --- Form Input Cache (リロード時保持用) ---
  /**
   * フォーム入力キャッシュ
   * リロード時に編集中の入力内容を復元するために使用
   *
   * キー例:
   * - 'goalEdit': ダッシュボードの目標編集
   * - 'memoEdit:{reservationId}': 履歴メモ編集
   * - 'wizardState': セッション終了フローのウィザード状態
   */
  formInputCache: {
    /** ダッシュボード目標編集 */
    goalEdit?: {
      isEditing: boolean;
      text: string;
    };
    /** 履歴メモ編集（reservationId別） */
    [key: `memoEdit:${string}`]: {
      isEditing: boolean;
      text: string;
    };
    /** セッション終了フローウィザード状態 */
    wizardState?: {
      currentStep: string;
      currentReservationId: string;
      sessionNoteToday: string;
      nextLessonGoal: string;
      nextStartTime: string;
      nextEndTime: string;
      orderInput: string;
      materialInput: string;
      accountingFormData: Record<string, any>;
      filterClassroom: string;
      reservationSkipped: boolean;
      selectedLessonId: string | null;
    };
    /** その他の任意のキャッシュ */
    [key: string]: any;
  };
}
```

### ブラケット表記の削除

型定義を追加後、以下のファイルでブラケット表記を通常のプロパティアクセスに変更：

#### `src/frontend/12_WebApp_StateManager.js`

```javascript
// 変更前
this.state['formInputCache'] = { ...currentCache, [key]: value };

// 変更後
this.state.formInputCache = { ...currentCache, [key]: value };
```

#### `src/frontend/13_WebApp_Views_Dashboard.js`

```javascript
// 変更前
const goalEditCache = dashboardStateManager['getFormInputCache']('goalEdit');

// 変更後
const goalEditCache = dashboardStateManager.getFormInputCache('goalEdit');
```

#### その他のファイルでも同様に変更

### メリット

1. **型安全性の向上**
   - TypeScriptの型チェックが効くようになる
   - IDEの自動補完が機能する

2. **可読性の向上**
   - ブラケット表記（`state['formInputCache']`）より直感的
   - コードレビュー時に理解しやすい

3. **リファクタリング支援**
   - プロパティ名変更時にIDEが自動で追跡

---

## まとめ

### 実装優先度

| 項目                                   | 優先度 | 理由                                   |
| -------------------------------------- | ------ | -------------------------------------- |
| データ再取得のタイムアウト処理         | 🟡 中  | ネットワーク不安定時のUX改善           |
| sessionStorageサイズ監視機能           | 🟡 中  | ローカル事前保存実装時に必須           |
| 必要な情報のローカル事前保存           | 🟡 中  | UX向上、ただしデータ不整合リスク要対策 |
| フォーム入力キャッシュの重複コード削減 | 🟢 低  | 保守性向上                             |
| 型定義の整備（formInputCache）         | 🟢 低  | 型安全性・可読性向上                   |

### 推奨実装順序

1. **sessionStorageサイズ監視機能** + **データ再取得のタイムアウト処理**
   - リスク低、効果大
   - 2つまとめて実装可能

2. **必要な情報のローカル事前保存**
   - データ不整合対策の設計が必要
   - 段階的に実装（まず`lessons`のみ、次に`myReservations`など）

3. **フォーム入力キャッシュの重複コード削減** + **型定義の整備**
   - リファクタリング系、機能追加後に実施

---

## 関連ドキュメント

- [TODO.md](../TODO.md) - タスク管理
- [AI_INSTRUCTIONS.md](../AI_INSTRUCTIONS.md) - 開発ルール
- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) - システムアーキテクチャ
