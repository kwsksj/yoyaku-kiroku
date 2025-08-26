# 実行計画: タスク2 - 状態管理の完全移行

## 1. タスク概要

- **タスク名**: 状態管理の完全移行
- **目的**: 現在、下位互換性のために残されているグローバルな `appState` 変数と `setState` 関数を完全に廃止し、`StateManager` を通じた厳密な単一方向データフローを確立する。これにより、コードの予測可能性、保守性、デバッグの容易性を向上させる。
- **関連ファイル**:
  - `12_WebApp_StateManager.html`: `window.appState` と `window.setState` の定義箇所
  - `12_WebApp_Core.html`: `appState` を参照している可能性のある箇所
  - `13_WebApp_Views.html`: `appState` を参照してビューを生成している箇所
  - `14_WebApp_Handlers.html`: `appState` の参照および `setState` を呼び出している箇所

## 2. 現状の課題

`SimpleStateManager` の導入により状態管理の基盤は大幅に改善されましたが、以下の課題が残っています。

1. **グローバル変数の残存**: `window.appState` と `window.setState` がグローバルスコープに存在するため、どのコンポーネントからでも直接状態にアクセス・更新できてしまい、意図しない副作用のリスクが残ります。
2. **データフローの不徹底**: 一部の処理（例: `actionHandlers.editHistoryMemo`）では、`appState` 内のオブジェクトや配列を直接変更（ミューテーション）した後に `setState` を呼び出しており、イミュータブル（不変）な状態更新の原則が守られていません。
3. **コードの可読性低下**: `setState` と `stateManager.dispatch`、`appState` と `stateManager.getState()` が混在することで、コードの意図が読み取りにくくなっています。

## 3. 修正方針

以下の3ステップで、段階的にリファクタリングを進めます。

1. **呼び出し形式の統一**: まず、すべての状態更新と参照を `StateManager` のインターフェース経由に統一します。
   - `setState({...})` → `window.stateManager.dispatch({ type: 'SET_STATE', payload: {...} })`
   - `appState.currentUser` → `window.stateManager.getState().currentUser`
2. **イミュータブルな状態更新の徹底**: 状態オブジェクトを直接変更している箇所を特定し、新しいオブジェクト/配列を生成して更新する方式に修正します。
3. **グローバル互換レイヤーの削除**: すべての参照が `StateManager` 経由になったことを確認後、`window.appState` と `window.setState` を完全に削除します。

## 4. 実装ステップ

### Step 1: `setState` を `stateManager.dispatch` に置き換える

- **対象ファイル**: `14_WebApp_Handlers.html`
- **作業内容**: ファイル内のすべての `setState({...})` 呼び出しを、`window.stateManager.dispatch({ type: 'SET_STATE', payload: {...} })` に機械的に置き換えます。
- **注意点**: `payload` には `setState` に渡していたオブジェクトをそのまま渡します。

### Step 2: `appState` の直接参照を `stateManager.getState()` に置き換える

- **対象ファイル**: `13_WebApp_Views.html`, `14_WebApp_Handlers.html`, `12_WebApp_Core.html`
- **作業内容**:
  - `appState` を参照している各関数の冒頭で `const state = window.stateManager.getState();` のように現在の状態を取得します。
  - 関数内の `appState.currentUser` や `appState.view` などの参照を、`state.currentUser` や `state.view` に変更します。
  - これにより、関数内での状態の一貫性を保ち、グローバル変数への依存をなくします。

### Step 3: イミュータブルな状態更新を徹底する

- **対象**: 主に `14_WebApp_Handlers.html` 内の楽観的UIを実装している箇所。
- **作業内容**: 状態オブジェクトを直接変更しているコードを修正します。
- **具体例 (`editHistoryMemo`):**
  - **修正前**:

    ```javascript
    const item = appState.history.find(h => h.reservationId === d.reservationId);
    // ...
    item.workInProgress = newMemo; // ← 直接変更（ミューテーション）
    setState({ history: [...appState.history] });
    ```

  - **修正後**:

    ```javascript
    const state = window.stateManager.getState();
    const newHistory = state.history.map(h => {
      if (h.reservationId === d.reservationId) {
        return { ...h, workInProgress: newMemo }; // ← 新しいオブジェクトを返す
      }
      return h;
    });
    window.stateManager.dispatch({
      type: 'SET_STATE',
      payload: { history: newHistory },
    });
    ```

### Step 4: グローバル互換レイヤーを削除する

- **対象ファイル**: `12_WebApp_StateManager.html`
- **作業内容**: Step 1〜3が完了し、アプリケーションが正常に動作することを確認した後、以下の2行を完全に削除します。

  ```javascript
  // グローバルインスタンスを作成
  window.stateManager = new SimpleStateManager();

  // シンプルなappState（プロキシなし）
  window.appState = window.stateManager.state; // 削除

  // setState関数をdispatch呼び出しのラッパーに変更
  window.setState = function (newState) {
    // 削除
    console.log('🔄 setState:', Object.keys(newState));
    window.stateManager.dispatch({ type: 'SET_STATE', payload: newState });
  };
  ```

- **最終確認**: 削除後、アプリケーション全体で `appState` や `setState` を直接参照している箇所がないか、再度検索して確認します。

## 5. 検証方法

1. **機能テスト**: すべての画面遷移、ボタン操作、フォーム入力、データ更新（予約、編集、キャンセル、会計など）が正常に動作することを確認します。
2. **コンソールログの確認**: `stateManager` の `dispatch` ログが表示され、状態更新が意図通りに行われていることを確認します。
3. **開発者ツールでの確認 (Step 4完了後)**:
   - コンソールで `window.appState` と `window.setState` を実行し、`undefined` となることを確認します。
   - `window.stateManager` は存在し、`window.stateManager.getState()` で状態オブジェクトが取得できることを確認します。

## 6. 実装に関する補足・追加改善点

### 6.1 現状分析結果

**実際のコードベースでの使用状況（2025年1月時点）:**

- `setState()` 呼び出し: 約49箇所（主に `14_WebApp_Handlers.html` に集中）
- `appState.` 参照: 約119箇所（`14_WebApp_Handlers.html`: 63箇所、`13_WebApp_Views.html`: 38箇所、`12_WebApp_Core.html`: 18箇所）
- 計画書の想定を上回る使用頻度のため、段階的なアプローチが重要

### 6.2 追加で検討すべき改善点

1. **段階的実装の詳細化**:
   - 各ステップでの動作確認とロールバック準備
   - 大量の変更箇所に対するリスク管理

2. **イミュータブル更新パターンの標準化**:
   - 配列・オブジェクトの更新に使用する共通ヘルパー関数の作成を検討
   - 例: `updateArrayItem(array, predicate, updater)` など

3. **状態更新の一貫性確保**:
   - 複数の状態プロパティを同時に更新する際の原子性保証
   - 状態更新エラー時のフォールバック処理

4. **開発者体験の向上**:
   - 状態管理パターンの開発ガイドライン作成
   - よくあるアンチパターンの警告機能

### 6.3 実装順序の見直し提案

計画書のStep 1-4に加えて、以下の前処理ステップを推奨:

**Step 0: 事前準備**

- 現在のコードベースの完全バックアップ
- テスト環境での動作確認基準の確立
- 状態更新ヘルパー関数の実装（オプション）

**修正後のStep 3: イミュータブル更新の徹底**

- `editHistoryMemo` 以外にも、配列やオブジェクトを直接変更している箇所がないか追加調査
- 特に `history`, `myBookings`, `slots` 配列の操作箇所を重点確認
