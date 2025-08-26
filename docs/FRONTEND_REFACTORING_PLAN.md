# フロントエンド リファクタリング計画書

## 1. 目的

このドキュメントは、**[FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)** で定義された「あるべきアーキテクチャ（To-Be）」を実現するための、具体的な作業手順とタスクリストを定義します。

**最終目標**:

- `setState()` を呼び出すだけで、UIが自動的かつ確実に更新される、予測可能な状態管理システムを構築する。
- 各ファイルの責務を明確にし、コードの可読性と保守性を大幅に向上させる。

---

## 2. 全体計画

リファクタリングは、以下の3つのフェーズで段階的に実施します。各フェーズは独立して完了させることができ、安全に作業を進めることが可能です。

- **フェーズ1: StateManagerの強化とUI更新の自動化**
  - 状態更新とUI描画を統合し、`render()` の手動呼び出しを撤廃します。
- **フェーズ2: ロジックの責務分離**
  - `render()` 関数からデータ取得ロジックを分離し、アクションハンドラに責務を移譲します。
- **フェーズ3: コードクリーンアップと品質向上**
  - 不要になったコードの削除と、グローバル変数の参照を段階的に削減します。

---

## 3. フェーズ1: StateManagerの強化とUI更新の自動化

**ゴール: `setState()` を呼び出すだけで、UIが自動で再描画されるようにする。**

### タスクリスト フェーズ1

- [ ] **`12_WebApp_StateManager.html` の改修**
  - [ ] `SimpleStateManager` クラスに `dispatch(action)` メソッドを新設する。
    - `action` は `{ type: 'ACTION_NAME', payload: { ... } }` 形式のオブジェクトとする。
    - `dispatch` 内で、まず状態更新ロジックを呼び出し、その直後に `render()` を呼び出すように実装する。
  - [ ] 既存の `updateState(newState)` メソッドの名前を `_updateState(newState)` に変更し、`dispatch` から呼び出される内部メソッドとする。
  - [ ] `render()` の呼び出しを `requestAnimationFrame(render)` に変更し、ブラウザの描画サイクルに最適化する。

- [ ] **グローバル関数の改修**
  - [ ] `12_WebApp_StateManager.html` の末尾にあるグローバルな `setState(newState)` 関数を修正する。
    - `stateManager.updateState(newState)` を呼び出す代わりに、`stateManager.dispatch({ type: 'SET_STATE', payload: newState })` を呼び出すラッパー関数に変更する。

- [ ] **`14_WebApp_Handlers.html` のクリーンアップ**
  - [ ] すべての `actionHandlers` 内にある、`render()` の**手動呼び出しを全て削除**する。
    - 例: `login` アクション内の `render();` を削除。

### 完了の定義 フェーズ1

- `actionHandlers` 内で `setState()` を呼び出すと、UIが自動的に更新されること。
- `14_WebApp_Handlers.html` から `render()` の直接呼び出しが完全に削除されていること。

---

## 4. フェーズ2: ロジックの責務分離

**ゴール: `render()` 関数を描画処理に専念させ、データ取得ロジックを適切な場所に移譲する。**

### タスクリスト フェーズ2

- [ ] **`14_WebApp_Handlers.html` の `render()` 関数をリファクタリング**
  - [ ] `render()` 関数から、データ鮮度をチェックするロジック (`shouldUpdateAppStateForView`) の呼び出しを削除する。
  - [ ] `render()` 関数から、データ取得処理 (`updateAppStateFromCache`) の呼び出しを削除する。
  - [ ] `render()` を、現在の `appState.view` に基づいて対応する `getView...()` 関数を呼び出し、DOMに描画するだけのシンプルな関数にする。

- [ ] **`14_WebApp_Handlers.html` のデータ取得関数を改修**
  - [ ] `updateAppStateFromCache()` 関数を修正し、データ取得後に遷移したいビュー名を引数 `targetView` として受け取れるようにする。
    - データ取得成功後、`setState({ view: targetView, ... })` のように状態を更新する。

- [ ] **`14_WebApp_Handlers.html` のアクションハンドラを改修**
  - [ ] `goToDashboard`, `goToEditProfile` などの画面遷移を担当するアクションハンドラを修正する。
  - [ ] 遷移前に `if (!appState.isDataFresh)` のような条件分岐を追加する。
  - [ ] データが古い場合 (`isDataFresh` が `false`) は、`updateAppStateFromCache('dashboard')` のように、遷移先ビュー名を渡してデータ取得関数を呼び出す。
  - [ ] データが新鮮な場合は、従来通り `setState({ view: 'dashboard' })` を呼び出す。

### 完了の定義 フェーズ2

- `render()` 関数が副作用（データ取得など）を持たなくなること。
- データの再取得は、画面遷移アクションの責務となること。

---

## 5. フェーズ3: コードクリーンアップと品質向上

**ゴール: リファクタリングによって不要になったコードを整理し、将来の拡張性を高める。**

### タスクリスト フェーズ3

- [ ] **不要な関数の削除**
  - [ ] `14_WebApp_Handlers.html` から、`hasDataChanged()` 関数を削除する。
  - [ ] `14_WebApp_Handlers.html` から、`shouldUpdateAppStateForView()` 関数を削除する。
  - [ ] `14_WebApp_Handlers.html` から、`getUpdateTypeForView()` 関数を削除する。

- [ ] **グローバル変数の参照削減（段階的）**
  - [ ] `13_WebApp_Views.html` などで `C.items.MAIN_LECTURE` のように直接参照しているグローバル定数を、`appState.constants.items.MAIN_LECTURE` のように `appState` 経由での参照に少しずつ置き換える。
    - **Note**: この作業は影響範囲が広いため、他のタスクと並行して少しずつ進めることを推奨します。

- [ ] **JSDocによる型定義の強化**
  - [ ] `12_WebApp_StateManager.html` の `this.state` の各プロパティに、`@type` を用いて型コメントを追加する。
    - 例: `/** @type {string | null} */ this.state.selectedClassroom = null;`
  - [ ] `processInitialData` などの主要な関数の引数と戻り値に型コメントを追加する。

### 完了の定義 フェーズ3

- 不要なコードが削除され、コードベースがスリム化されていること。
- 主要なデータ構造や関数に型定義が付与され、エディタでの開発支援が強化されること。

---

## 6. 成果物

- より堅牢で、バグが少なく、予測可能なフロントエンドアプリケーション。
- 新機能の追加や仕様変更が容易に行える、保守性の高いコードベース。

---

## 7. 担当者とスケジュール

| フェーズ                                      | 担当者 | 完了予定日 | ステータス |
| --------------------------------------------- | ------ | ---------- | ---------- |
| **フェーズ1: StateManagerの強化**             |        |            | 未着手     |
| **フェーズ2: ロジックの責務分離**             |        |            | 未着手     |
| **フェーズ3: コードクリーンアップと品質向上** |        |            | 未着手     |
