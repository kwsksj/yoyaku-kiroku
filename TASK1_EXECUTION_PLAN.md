# 実行計画: タスク1 - イベントリスナーのメモリリーク修正

## 1. タスク概要

- **タスク名**: イベントリスナーのメモリリーク修正
- **問題点**: 会計画面(`accounting`ビュー)が表示されるたびにイベントリスナーが重複して登録され、メモリリークとパフォーマンス低下を引き起こしている。
- **原因**: `render`関数内で`setupAccountingFormListeners`が繰り返し呼び出されているため。
- **目的**: ビューのライフサイクル（表示/非表示）と連動したイベントリスナー管理を導入し、メモリリークを根本的に解決する。

## 2. 関連ファイル

- `14_WebApp_Handlers.html`: `setupAccountingFormListeners`関数および`render`関数が定義されている。
- `12_WebApp_Core.html`: `StateManager`やUIのコアロジックが定義されている。
- `13_WebApp_Views.html`: `getAccountingView`関数が定義されている。

## 3. 修正方針

現在のアーキテクチャ（`StateManager`による状態管理）を最大限に活用し、クリーンで拡張性の高い方法で問題を解決します。

1. **リスナー管理の集中化**:
   - ビューが切り替わるタイミングで、古いビューに紐づくイベントリスナーをすべて解除し、新しいビューに必要なリスナーを登録する仕組みを導入します。
2. **`StateManager`の活用**:
   - `stateManager.subscribe`を利用して`state.view`の変更を監視します。
   - ビューの変更をトリガーとして、リスナーの登録・解除処理を実行します。
3. **汎用的なヘルパー関数の導入**:
   - 登録したリスナーを追跡し、一括で解除するためのヘルパー関数 (`addTrackedListener`,
     `teardownAllListeners`) を作成します。これにより、将来他のビューで同様の問題が発生した場合にも容易に対応できます。

## 4. 実装ステップ

### Step 1: `render`関数からリスナー登録処理を削除

- `14_WebApp_Handlers.html`内の`render`関数から、`setupAccountingFormListeners`の呼び出しを完全に削除します。
- これにより、UIが再描画されるたびにリスナーが重複登録される問題の直接的な原因を取り除きます。

### Step 2: イベントリスナー管理ヘルパーの導入

- `12_WebApp_Core.html`（または`14_WebApp_Handlers.html`の適切な場所）に、以下のヘルパー関数群を新設します。
  - `activeListeners`配列: 現在アクティブなリスナーの情報を保持します。
  - `addTrackedListener(element, type, listener, options)`:
    `addEventListener`をラップし、登録情報を`activeListeners`配列に追加します。
  - `teardownAllListeners()`:
    `activeListeners`配列をループ処理し、登録されているすべてのリスナーを`removeEventListener`で解除します。

### Step 3: `setupAccountingFormListeners`の修正

- `14_WebApp_Handlers.html`内の`setupAccountingFormListeners`関数を修正します。
- `element.addEventListener(...)`の直接呼び出しを、新しく作成した`addTrackedListener(...)`に置き換えます。
- これにより、会計画面で登録されるすべてのリスナーが自動的に追跡されるようになります。

### Step 4: `StateManager`にビュー変更の監視ロジックを追加

- アプリケーションの初期化処理を行う箇所（例:
  `12_WebApp_Core.html`の`initializeStateManager`の後）で、`stateManager.subscribe`を呼び出すロジックを追加します。
- `subscribe`のコールバック関数内で、`newState.view`と`oldState.view`を比較します。
- ビューが変更された場合:
  1. `teardownAllListeners()`を呼び出し、古いビューのリスナーをすべてクリーンアップします。
  2. `newState.view`の値に応じて、新しいビューに必要なリスナー登録関数を呼び出します。
     - `if (newState.view === 'accounting') { requestAnimationFrame(() => setupAccountingFormListeners(...)); }`
     - `requestAnimationFrame`を使い、DOMの描画が完了してからリスナーを登録することで、要素が見つからないエラーを防ぎます。

## 5. コード修正案（抜粋）

### `12_WebApp_Core.html` または `14_WebApp_Handlers.html` への追加

```javascript
// --- イベントリスナー管理 ---
let activeListeners = [];

/**
 * 登録されたイベントリスナーを全て解除する
 */
function teardownAllListeners() {
  activeListeners.forEach(({ element, type, listener, options }) => {
    if (element) {
      element.removeEventListener(type, listener, options);
    }
  });
  activeListeners = [];
  if (isTestEnvironment) console.log('🎧 All event listeners torn down.');
}

/**
 * イベントリスナーを登録し、解除できるように追跡するヘルパー関数
 * @param {Element} element - 対象要素
 * @param {string} type - イベントタイプ
 * @param {Function} listener - リスナー関数
 * @param {object} [options] - addEventListenerのオプション
 */
function addTrackedListener(element, type, listener, options) {
  if (!element) {
    console.warn(`Attempted to add listener to a null element for event: ${type}`);
    return;
  }
  element.addEventListener(type, listener, options);
  activeListeners.push({ element, type, listener, options });
}
```

### `12_WebApp_Core.html` の初期化部分への追加

```javascript
// StateManagerの初期化後に追加する関数
function setupViewListener() {
  if (!window.stateManager) {
    console.error('StateManager not initialized. Cannot set up view listener.');
    return;
  }

  window.stateManager.subscribe((newState, oldState) => {
    // ビューが変更された場合のみ処理
    if (newState.view !== oldState.view) {
      // 古いビューのリスナーを全て解除
      teardownAllListeners();

      // 新しいビューに応じたリスナーを登録
      // requestAnimationFrameでDOMの描画を待つ
      requestAnimationFrame(() => {
        if (newState.view === 'accounting') {
          if (newState.accountingReservation) {
            setupAccountingFormListeners(newState.accountingReservation.reservationId);
            // 初回計算を実行
            calculateAccountingDetails();
          } else {
            console.error('Accounting view rendered without accountingReservation data.');
          }
        }
        // 他のビューでリスナーが必要な場合はここに追加
        // else if (newState.view === 'someOtherView') {
        //   setupSomeOtherViewListeners();
        // }
      });
    }
  });
  if (isTestEnvironment) console.log('View listener subscribed to StateManager.');
}

// 既存の初期化フローの最後に呼び出しを追加
// 例:
// window.initializeStateManager();
// setupViewListener();
```

## 6. 検証方法

1. **開発者ツールでの確認**:
   - 会計画面とダッシュボード画面を何度も行き来します。
   - Chrome開発者ツールの「Elements」パネルで、`#accounting-form`要素を選択し、「Event
     Listeners」タブを確認します。
   - 会計画面を表示した際にリスナーが1セットだけ登録され、他の画面に遷移した際にリスナーが消えることを確認します。
2. **メモリ使用量の確認**:
   - Chrome開発者ツールの「Memory」タブでヒープスナップショットを撮ります。
   - 画面遷移を繰り返した後、再度スナップショットを撮り、`EventListener`オブジェクトが不必要に増加していないことを確認します。
3. **機能の正常性確認**:
   - 会計画面のすべてのインタラクティブな要素（入力、ボタンクリック、チェックボックスなど）が、修正後も正しく機能することを確認します。
