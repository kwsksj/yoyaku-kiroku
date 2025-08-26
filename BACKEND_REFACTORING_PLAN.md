# バックエンド改修実行計画書 (タスク3 & 4)

## 1. はじめに

このドキュメントは、`ACTION_PLAN.md`で定義されたバックエンドの優先タスクである「タスク3: 不要コードの削除」と「タスク4: トランザクション管理の強化」について、具体的な実行計画を定めるものです。

### 対象タスク

- **タスク3: 不要コードの削除 (デッドコードのクリーンアップ)**
  - **内容**: データモデル刷新に伴い不要となった旧データモデル（教室別シート、予約サマリーシート等）を参照するコードを完全に削除する。
  - **目的**: コードベースの複雑性を低減し、新規開発者の混乱を防ぐ。

- **タスク4: トランザクション管理の強化**
  - **内容**: `LockService`の利用をカプセル化したユーティリティ関数を導入し、複数リソース（シート、キャッシュ）の更新処理をアトミックに実行するパターンを徹底する。
  - **目的**: データの不整合や競合状態のリスクを最小化し、システムの信頼性を高める。

## 2. タスク3: 不要コードの削除 (デッドコードのクリーンアップ) 実行計画

### フェーズ1: 調査と特定 (1-2時間)

1.  **旧データモデルのリストアップ**:
    - ~~教室別予約シート~~ → **実態**: 教室名（`東京教室`, `つくば教室`等）は現在も有効な定数として使用中
    - ~~予約サマリーシート (`予約サマリー`)~~ → **実態**: 既に廃止済み、定数のみ残存
    - ~~きろくキャッシュシート (`きろくキャッシュ`)~~ → **実態**: 既に廃止済み、定数のみ残存
    - **実際の削除対象**: 使用されていない定数とフィルター処理のハードコード文字列

2.  **参照箇所の検索結果**:
    - **現在も使用中**: `東京教室`, `つくば教室` (CONSTANTS.CLASSROOMSとして定義、test環境でも使用)
    - **削除候補**: `CONSTANTS.SHEET_NAMES.SUMMARY` (`予約サマリー`)
    - **削除候補**: `CONSTANTS.SHEET_NAMES.RECORD_CACHE` (`きろくキャッシュ`)
    - **削除候補**: `SUMMARY_SHEET_NAME` 定数
    - **削除候補**: `02-4_BusinessLogic_ScheduleMaster.js:505` のハードコード文字列 `'予約サマリー'`

3.  **削除対象リストの作成（実態ベース）**:
    - **00_Constants.js**: 未使用のシート名定数（SUMMARY, RECORD_CACHE）とそれに対応するグローバル定数
    - **02-4_BusinessLogic_ScheduleMaster.js**: isReservationSheet()関数内のハードコード文字列 `'予約サマリー'`
    - **影響範囲**: 上記2ファイルのみ（他のファイルに旧データモデル参照は発見されず）

### フェーズ2: 段階的な削除とテスト (0.5-1時間)

1.  **削除作業の簡素化**: 実際の削除対象は非常に限定的（未使用定数とハードコード文字列のみ）
2.  **ファイル単位での削除**:
    - **00_Constants.js**: `SHEET_NAMES.SUMMARY`, `SHEET_NAMES.RECORD_CACHE`, `SUMMARY_SHEET_NAME`定数を削除
    - **02-4_BusinessLogic_ScheduleMaster.js**: `isReservationSheet`関数から`'予約サマリー'`文字列を削除
3.  **テスト**:
    - **ローカルテスト**: `npm run watch` でフロントエンドに影響がないか確認
    - **GAS環境テスト**: `npm run push:test` で主要機能が正常動作することを確認

### フェーズ3: 最終確認 (0.5時間)

1.  **リストの照合**: フェーズ1で作成した削除対象リストの全項目がコードベースから削除されたことを確認します。
2.  **最終検索**: プロジェクト全体で、旧データモデルへの参照が完全に消去されたことを再度検索して確認します。

## 3. タスク4: トランザクション管理の強化 実行計画

### フェーズ1: 設計とユーティリティ関数の実装 (1時間)

1.  **現状分析**:
    - `08_Utilities.js`には既にトランザクション関数は存在しない
    - 各ファイルで個別に`LockService.getScriptLock()`、`waitLock()`、`releaseLock()`を実装
    - 現在使用中のファイル: `05-2_Backend_Write.js`, `07_CacheManager.js`, `01_Code.js`, `06_ExternalServices.js`, `04_Backend_User.js`

2.  **ユーティリティ関数の作成**:
    - `08_Utilities.js` に、`withTransaction` という名前の新しいヘルパー関数を実装します。

3.  **関数の仕様**:
    - `LockService.getScriptLock()` を使用してスクリプト全体で排他ロックを取得します。
    - `try...finally` 構文を使用し、処理の成功・失敗にかかわらず `finally` ブロックで `lock.releaseLock()` を確実に呼び出します。
    - ロックの待機時間は `CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS` を使用（既存コードとの統一性）
    - データ更新処理本体は、引数として渡されるコールバック関数内で実行します。

    ```javascript
    // 08_Utilities.js に追加する関数のイメージ
    /**
     * スクリプトロックを利用して処理をアトミックに実行する
     * @param {function} callback - 実行する処理
     * @returns {*} callbackの戻り値
     */
    function withTransaction(callback) {
      const lock = LockService.getScriptLock();
      lock.waitLock(CONSTANTS.LIMITS.LOCK_WAIT_TIME_MS);
      try {
        return callback();
      } finally {
        lock.releaseLock();
      }
    }
    ```

### フェーズ2: 既存コードへの適用 (2-3時間)

1.  **対象処理の特定（実態ベース）**:
    - **05-2_Backend_Write.js**: 4つの関数でLockServiceを使用
      - `makeReservationAndGetLatestData` (行59-291でロック使用)
      - `updateReservationDetailsAndGetLatestData` (行301-425でロック使用)
      - `cancelReservationAndGetLatestData` (行435-560でロック使用)
      - `saveAccountingDetails` (行576-762でロック使用)
    - **07_CacheManager.js**: 2つの関数でLockServiceを使用
      - `rebuildStudentCache` (行62-137でロック使用)
      - `rebuildAllReservationCache` (行516-545でロック使用)
    - **04_Backend_User.js**: 2つの関数でLockServiceを使用
      - `updateUserProfile` (行250-327でロック使用)
      - `registerUser` (行337-424でロック使用)

2.  **リファクタリング**:
    - 特定した各関数内のデータ更新ロジック全体を、`withTransaction` ヘルパー関数でラップします。
    - 既存の `LockService` の呼び出しコードは削除し、`withTransaction` に一本化します。

    ```javascript
    // 05-2_Backend_Write.js のリファクタリング例
    function makeReservationAndGetLatestData(p) {
      return withTransaction(() => {
        // 既存の予約作成、シート更新、キャッシュ更新のロジックをここに移動
        // ...
        // 既存の lock.releaseLock() などは不要
        return createApiResponse({ success: true, ... });
      });
    }
    ```

### フェーズ3: テストと検証 (1時間)

1.  **機能テスト**: トランザクションを適用した全ての書き込み処理が、以前と同様に正常に動作することを確認します。
2.  **競合テスト**:
    - `npm run push:test` でテスト環境にデプロイします。
    - 複数のブラウザやタブを開き、短時間に同じ予約枠への予約やキャンセルを試みるなど、意図的に競合状態を発生させ、データ不整合が起きないことを確認します。

## 4. 作業の進め方と注意点

- **ブランチ戦略**: 現在の`fix-weapp-reservation-editing`ブランチで作業を継続、または新規ブランチ作成を検討
- **作業規模の見直し**:
  - **タスク3**: 実態調査により大幅に簡素化（2個の未使用定数削除のみ）
  - **タスク4**: 8つの関数のトランザクション管理統一化（既存パターンのリファクタリング）
- **コミット粒度**:
  - 「タスク3: 未使用定数（SUMMARY, RECORD_CACHE）を削除」
  - 「タスク4: withTransactionユーティリティを実装」
  - 「タスク4: 05-2_Backend_Write.jsにトランザクション適用」
  - 「タスク4: 07_CacheManager.jsにトランザクション適用」
  - 「タスク4: 04_Backend_User.jsにトランザクション適用」のように、ファイル単位で意味のあるコミットに分割します。
- **テスト重点項目**:
  - LockService使用箇所の動作確認（並行アクセス制御）
  - 既存の予約・キャンセル・更新機能の正常性確認
