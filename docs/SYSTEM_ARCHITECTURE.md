# システムアーキテクチャ図（v3.2対応）

**最終更新**: 2025年10月2日 | **対象バージョン**: v3.2.0

## はじめに

このドキュメントは、プロジェクトの全体像を視覚的に理解するために、主要な設計要素とデータフローを図で示します。

- **プロジェクト構造**: 主要なファイル群とそれらの役割・依存関係
- **開発ワークフロー**: JavaScript分離開発アーキテクチャ（src/ → build-output/）
- **キャッシュ層アーキテクチャ**: インクリメンタル更新と分割キャッシュシステム
- **画面遷移図**: Webアプリのユーザーインターフェースの遷移
- **データフロー図**: ユーザー操作に応じたバックエンドでのデータ処理の流れ
- **主要機能の関連図**: バックエンドの主要機能間の呼び出し関係
- **フロントエンドアーキテクチャ**: フロントエンドの状態管理と画面描画の仕組み

## プロジェクト構造図（v3.2対応）

プロジェクトを構成する主要なコンポーネントと、JavaScript分離開発アーキテクチャを示します。

```mermaid
graph TD
    subgraph "開発環境（ローカル）"
        DEV_SRC[src/ ディレクトリ<br>JavaScriptファイル開発]
        DEV_BUILD[npm run dev:build<br>ビルドシステム]
        DEV_OUTPUT[build-output/ ディレクトリ<br>HTML統合ファイル生成]

        DEV_SRC --> DEV_BUILD
        DEV_BUILD --> DEV_OUTPUT
    end

    subgraph "デプロイメント"
        DEP_TEST[npm run dev:test<br>テスト環境プッシュ]
        DEP_PROD[npm run dev:prod<br>本番環境プッシュ]

        DEV_OUTPUT --> DEP_TEST
        DEV_OUTPUT --> DEP_PROD
    end

    subgraph "ユーザー"
        A[ブラウザ / WebApp] -- HTTPSリクエスト --> B(GAS WebAppサーバー)
    end

    subgraph "Google Apps Script バックエンド"
        B -- 実行 --> C{09_Backend_Endpoints.js<br>APIエントリーポイント}

        C -- 認証・ユーザー操作 --> D[04_Backend_User.js<br>ユーザー管理]
        C -- 予約・書き込み --> E[05-2_Backend_Write.js<br>予約処理]
        C -- データ取得 --> F[05-3_Backend_AvailableSlots.js<br>空き枠計算]

        D -- 読み書き --> G[07_CacheManager.js<br>キャッシュ管理]
        E -- 読み書き --> G
        F -- 読み込み --> G

        G -- キャッシュなければ<br>直接アクセス --> H[Spreadsheet]

        subgraph "共通モジュール"
            I[00_Constants.js<br>共通定数]
            J[08_Utilities.js<br>汎用ヘルパー]
            K[00_SpreadsheetManager.js<br>シート操作]
        end

        C --> I & J & K
        D --> I & J & K
        E --> I & J & K
        F --> I & J & K
        G --> I & J & K
    end

    subgraph "フロントエンド（build-output/）"
        L[10_WebApp.html<br>メインページ<br>（JavaScriptを統合）] -- include --> M[11_WebApp_Config.js<br>UI設定]
        L -- include --> N[12_WebApp_Core.js<br>状態管理・コアロジック]
        L -- include --> O[13_WebApp_Views.js<br>画面生成]
        L -- include --> P[14_WebApp_Handlers.js<br>イベント処理]
    end

    DEP_TEST -.テスト環境.-> B
    DEP_PROD -.本番環境.-> B
    B -- HTML生成 --> L
```

### ファイル構造の詳細

**開発ディレクトリ（src/）**:

```text
src/
├── backend/                        # バックエンドロジック
│   ├── 00_Constants.js            # グローバル定数・設定
│   ├── 00_SpreadsheetManager.js   # スプレッドシート操作管理
│   ├── 01_Code.js                 # エントリーポイント・トリガー
│   ├── 02-5_BusinessLogic_Notification.js  # 通知ロジック
│   ├── 04_Backend_User.js         # ユーザー認証・管理
│   ├── 05-2_Backend_Write.js      # データ書き込みAPI
│   ├── 05-3_Backend_AvailableSlots.js  # 空き枠計算API
│   ├── 07_CacheManager.js         # キャッシュ管理
│   ├── 08_ErrorHandler.js         # エラーハンドリング
│   ├── 08_Utilities.js            # 汎用ユーティリティ
│   └── 09_Backend_Endpoints.js    # 統一APIエンドポイント
├── frontend/                       # フロントエンドロジック
│   ├── 11_WebApp_Config.js        # フロントエンド設定・デザイン定数
│   ├── 12_WebApp_Core.js          # コアユーティリティ
│   ├── 12_WebApp_Core_*.js        # コアモジュール群
│   ├── 12_WebApp_StateManager.js  # State管理
│   ├── 13_WebApp_Components.js    # UIコンポーネント
│   ├── 13_WebApp_Views_*.js       # ビュー生成モジュール
│   └── 14_WebApp_Handlers*.js     # イベントハンドラー
└── templates/
    └── 10_WebApp.html             # HTMLテンプレート

build-output/                       # デプロイ対象（自動生成）
└── [上記ファイルがビルドされたもの]
```

**開発ワークフローの重要な注意事項**:

1. **開発作業は必ず `src/` ディレクトリで実施**
2. **`build-output/` ディレクトリのファイルは絶対に直接編集禁止**（ビルド時に上書きされる）
3. **修正後は必ず `npm run dev:build` でbuild-outputに反映**
4. **テスト**: `npm run dev:test` でテスト環境に自動プッシュ＆確認
5. **本番**: `npm run dev:prod` で本番デプロイ

## キャッシュ層アーキテクチャ（v5.0-5.5対応）

新しいキャッシュシステムの全体像を示します。

```mermaid
graph TD
    subgraph "データソース層"
        SS1[日程マスタシート]
        SS2[統合予約シート]
        SS3[生徒名簿シート]
        SS4[会計マスタシート]
    end

    subgraph "CacheService層（v5.5分割キャッシュ対応）"
        C1[master_schedule_data<br>24時間<br>約30KB]
        C2[all_reservations<br>6時間<br>インクリメンタル更新<br>分割対応最大1.8MB]
        C3[all_students_basic<br>24時間<br>基本情報8項目<br>分割対応最大1.8MB]
        C4[master_accounting_data<br>6時間<br>約10KB]
        VERSION[バージョン管理<br>数値インクリメント]
    end

    subgraph "キャッシュ管理（07_CacheManager.js）"
        GET[getCachedData<br>統一アクセスAPI]
        REBUILD[rebuild***Cache<br>全体再構築<br>分割対応]
        INCR_ADD[addReservationToCache<br>インクリメンタル追加]
        INCR_UPD[updateReservationInCache<br>インクリメンタル更新]
        INCR_DEL[deleteReservationFromCache<br>インクリメンタル削除]
        SPLIT[splitDataIntoChunks<br>90KB単位分割]
        SAVE[saveChunkedData<br>分割保存]
        LOAD[loadChunkedData<br>分割読み込み]
    end

    subgraph "アプリケーション層"
        API[Backend APIs<br>09_Endpoints]
        FRONTEND[Frontend<br>WebApp]
    end

    SS1 -.初回構築/定期再構築.-> REBUILD
    SS2 -.初回構築/定期再構築.-> REBUILD
    SS3 -.初回構築/定期再構築.-> REBUILD
    SS4 -.初回構築/定期再構築.-> REBUILD

    REBUILD --> SPLIT
    SPLIT --> SAVE
    SAVE --> C1 & C2 & C3 & C4

    SS2 -.予約操作時.-> INCR_ADD & INCR_UPD & INCR_DEL
    INCR_ADD --> C2
    INCR_UPD --> C2
    INCR_DEL --> C2

    C1 & C2 & C3 & C4 --> VERSION
    VERSION --> GET

    LOAD --> GET
    GET --> API
    API --> FRONTEND

    style C2 fill:#ffeb9c
    style INCR_ADD fill:#c6efce
    style INCR_UPD fill:#c6efce
    style INCR_DEL fill:#c6efce
    style SPLIT fill:#ffd9b3
    style SAVE fill:#ffd9b3
    style LOAD fill:#ffd9b3
```

### キャッシュシステムの特徴

**インクリメンタル更新システム（v5.0）**:

- **差分更新**: シート全体を再読み込みせず、変更部分のみ更新
- **パフォーマンス**: 2-3秒 → 50-200ms（95%以上の高速化）
- **自動フォールバック**: エラー時は全体再構築に自動切り替え
- **バージョン管理**: 数値インクリメントで効率的な差分検出

**分割キャッシュシステム（v5.5）**:

- **自動分割**: データが90KB超過時に自動チャンク分割
- **最大容量**: 20チャンクまで対応（合計1.8MB）
- **透過的操作**: アプリケーション層は分割を意識不要
- **CacheService制限解決**: 100KB制限問題を根本解決

**時間主導型トリガー**:

- **6時間ごと**: 全キャッシュの自動再構築
- **安定性向上**: キャッシュ有効期限切れを事前に防止
- **高可用性**: Googleの自動削除に対する耐性

## 画面遷移図

ユーザーがWebアプリケーションをどのように操作し、画面が遷移していくかを示します。

```mermaid
stateDiagram-v2
    [*] --> Login: アプリ起動

    Login --> Dashboard: ログイン成功
    Login --> Register: 電話番号が未登録
    Login --> UserSearch: 特殊コマンド入力

    UserSearch --> Register: 新規登録を選択
    UserSearch --> EditProfile: 自分のアカウントを選択

    Register --> RegisterStep2: 名前入力後
    RegisterStep2 --> RegisterStep3: プロフィール入力後
    RegisterStep3 --> ClassroomSelection: 登録完了

    Dashboard --> ClassroomSelection: 「あたらしく よやく する」
    Dashboard --> EditProfile: 「Profile 編集」
    Dashboard --> Accounting: 「会計」ボタン
    Dashboard --> EditReservation: 「確認/編集」ボタン

    ClassroomSelection --> BookingView: 教室を選択
    BookingView --> NewReservation: 日付を選択

    NewReservation --> Complete: 予約内容を確定
    EditReservation --> Complete: 予約内容を更新
    Accounting --> Complete: 会計処理完了

    Complete --> Dashboard: 「ホームへ戻る」

    state "戻る操作" as Back {
        ClassroomSelection --> Dashboard
        BookingView --> ClassroomSelection
        NewReservation --> BookingView
        EditReservation --> Dashboard
        EditProfile --> Dashboard
        Accounting --> Dashboard
    }
```

## データフロー図

主要な操作における、フロントエンドとバックエンド間のデータの流れを時系列で示します。

### ログイン処理（キャッシュ統合版）

ユーザーが電話番号でログインする際のデータフローです。

```mermaid
sequenceDiagram
    participant FE as フロントエンド
    participant EP as 09_Endpoints
    participant US as 04_User
    participant CM as 07_CacheManager
    participant SS as Spreadsheet

    FE->>EP: getLoginData(phone)
    EP->>US: authenticateUser(phone)
    US->>CM: getCachedData("all_students_basic")
    alt キャッシュなし
        CM->>SS: 生徒名簿を読み込み
        SS-->>CM: 全生徒データ
        CM->>CM: キャッシュを構築（分割対応）
    end
    CM-->>US: 生徒データ
    US-->>EP: 認証結果 (ユーザー情報)

    alt 認証成功
        EP->>CM: getCachedData("all_reservations")
        CM-->>EP: 空き枠データ
        EP->>CM: getUserReservations(studentId)
        CM-->>EP: 個人の予約・履歴データ
    end

    EP-->>FE: ログイン結果と全ての初期データ
```

### 予約作成処理（インクリメンタル更新版）

ユーザーが新しい予約を入れる際のデータフローです。

```mermaid
sequenceDiagram
    participant FE as フロントエンド
    participant EP as 09_Endpoints
    participant WR as 05-2_Write
    participant CM as 07_CacheManager
    participant SS as Spreadsheet

    FE->>EP: makeReservationAndGetLatestData(予約情報)
    EP->>WR: makeReservation(予約情報)
    WR->>CM: getCachedData("all_reservations")
    WR->>CM: getCachedData("master_schedule_data")
    CM-->>WR: キャッシュデータ
    WR->>WR: checkCapacityFull() (満席チェック)
    WR->>SS: 新しい予約行を追記
    SS-->>WR: 書き込み成功

    Note over WR,CM: v5.0インクリメンタル更新
    WR->>CM: addReservationToCache(新予約)
    CM->>CM: キャッシュに差分追加（シート再読み込み不要）
    CM->>CM: バージョン番号インクリメント
    alt エラー発生
        CM->>CM: 自動フォールバック（全体再構築）
    end

    WR-->>EP: { success: true }

    EP->>EP: getBatchData() (最新の全データを再取得)
    EP-->>FE: 予約完了メッセージと最新データ

    Note over FE: ポーリングでバージョン確認
    FE->>EP: checkForUpdates()
    EP->>CM: getCachedData("all_reservations").version
    CM-->>EP: 最新バージョン番号
    EP-->>FE: バージョン差分 → UI自動更新
```

## 主要機能の関連図

バックエンドにおける主要なビジネスロジック間の呼び出し関係を示します。

### 空き枠計算 (`getAvailableSlots`)

```mermaid
graph TD
    A["09_Endpoints<br>getAvailableSlots"] --> B("05-3_AvailableSlots<br>getAvailableSlots")
    B --> C{"02-4_ScheduleMaster<br>getAllScheduledDates"}
    C --> D["07_CacheManager<br>getCachedData(master_schedule_data)"]
    B --> E["07_CacheManager<br>getCachedData(all_reservations)"]
    B --> F["08_Utilities<br>convertReservationsToObjects"]

    style D fill:#c6efce
    style E fill:#c6efce
```

### ユーザー認証 (`authenticateUser`)

```mermaid
graph TD
    A["09_Endpoints<br>authenticateUser"] --> B("04_User<br>authenticateUser")
    B --> C{"09_Endpoints<br>getAppInitialData"}
    C --> D["07_CacheManager<br>getCachedData(各種キャッシュ)"]
    B --> E{"04_User<br>extractPersonalDataFromCache"}
    E --> F["08_Utilities<br>convertReservationsToObjects"]

    style D fill:#c6efce
```

## フロントエンド アーキテクチャ

フロントエンドは「**状態管理 (State Management)**」モデルに基づいて構築されています。ユーザーの操作によって「状態」が変更され、その変更を検知して画面が自動的に再描画される、という一方向のデータフローを特徴とします。

これにより、UIの整合性を保ちやすく、予測可能な動作を実現しています。

```mermaid
graph TD
    subgraph "ユーザー操作"
        A(ボタンクリックなど)
    end

    subgraph "フロントエンド JavaScript"
        B["イベントリスナー<br>(14_WebApp_Handlers*.js)"]
        C{"アクションハンドラ<br>(actionHandlers)"}
        D["stateManager<br>(12_WebApp_StateManager.js)"]
        E((状態<br>State))
        F["render() 関数"]
        G{"ビュー関数<br>(13_WebApp_Views_*.js)"}
        H["コンポーネント関数<br>(13_WebApp_Components.js)"]
        I["生成されたHTML"]
    end

    subgraph "バックエンド"
        J(Backend API<br>google.script.run)
    end

    A -- イベント発生 --> B
    B -- 対応する関数を呼び出し --> C

    C -- "1a. 状態変更を指示" --> D
    C -- "1b. サーバー処理が<br>必要な場合" --> J
    J -- "2. 処理結果を返す" --> C
    C -- "3. 結果を元に<br>状態変更を指示" --> D

    D -- "4. 状態(State)を更新" --> E
    E -- "5. 変更を通知" --> F

    F -- "6. 最新の状態を読み取り" --> E
    F -- "7. 表示すべきビューを決定" --> G
    G -- "8. UI部品を要求" --> H
    H -- "9. HTML部品を生成" --> G
    G -- "10. 画面全体のHTMLを構築" --> I

    I -- "11. DOMを更新し画面表示" --> A
```

### フロントエンドの責任分離

1. **ユーザー操作**: ユーザーがボタンをクリックするなど、何らかのアクションを起こします。
2. **イベントリスナー**: `14_WebApp_Handlers*.js` にあるイベントリスナーがその操作を検知し、対応する `actionHandlers` の関数を呼び出します。
3. **アクションハンドラ**: 呼び出された関数は、必要に応じてバックエンドAPI (`google.script.run`) を呼び出すか、または直接 `stateManager` に状態の変更を依頼 (dispatch) します。
4. **状態更新**: `stateManager` (`12_WebApp_StateManager.js`) がアプリケーションの唯一の「状態 (State)」を更新します。
5. **再描画**: 状態が変更されると、`stateManager` は `render()` 関数に「状態が変わった」ことを通知します。
6. **画面構築**: `render()` 関数は、最新の状態を元に、`13_WebApp_Views_*.js` のビュー関数を呼び出して画面全体のHTMLを再構築します。
7. **DOM更新**: 新しく構築されたHTMLで、実際の画面が更新されます。

このサイクルにより、データと表示の一貫性が保たれます。

### フロントエンド設計原則

**Atomic Design + StateManager**:

- **Atomic Components**: `13_WebApp_Components.js` - 再利用可能な小部品
- **Views**: `13_WebApp_Views_*.js` - 純粋な表示ロジック（状態を読むのみ）
- **Handlers**: `14_WebApp_Handlers*.js` - ビジネスロジックとstate更新の調整
- **StateManager**: `12_WebApp_StateManager.js` - 唯一の状態管理責任

**単方向データフロー**:

```text
ユーザー操作 → Handlers → dispatch() → StateManager
    ↓
State更新 → render()呼び出し
    ↓
Views → Components → DOM更新 → 画面表示
```

## システム最適化の成果（v3.2時点）

### パフォーマンス改善

| 指標               | 改善前     | 改善後       | 改善率    |
| ------------------ | ---------- | ------------ | --------- |
| 予約表示速度       | 5-10秒     | 0.5-1秒      | 90%+      |
| 予約更新速度       | 2-3秒      | 50-200ms     | 95%+      |
| サーバー負荷       | 高         | 低           | 80%削減   |
| キャッシュ容量     | 不安定     | 140KB        | 最適化    |
| スケーラビリティ   | 限定的     | 最大1.8MB    | 大幅向上  |
| リアルタイム性     | なし       | ポーリング   | 新機能    |

### アーキテクチャ改善

**データモデル**:

- 教室別分散シート → 統合予約シート（単一ソース）
- 重複データ排除 → 正規化された構造
- シート数削減 → 運用・保守の簡素化

**キャッシュシステム**:

- 静的キャッシュ → インクリメンタル更新（v5.0）
- 100KB制限問題 → 分割キャッシュで解決（v5.5）
- 手動管理 → 自動再構築（時間主導型トリガー）

**開発環境**:

- HTML内JavaScript → JavaScript分離開発（2025年9月）
- 手動ビルド → 自動ビルドシステム
- 環境手動切り替え → 環境自動判定

## 開発ワークフロー（v3.2対応）

### 推奨開発フロー

1. **開発**: `src/backend/` または `src/frontend/` でコード編集
2. **ビルド**: `npm run dev:build` で変更を `build-output/` に反映
3. **品質チェック**: `npm run check` でフォーマット・lint・型チェック
4. **テスト**: `npm run dev:test` でテスト環境に自動プッシュ＆確認
5. **本番**: `npm run dev:prod` で本番デプロイ（テストOK後のみ）

### 重要な開発ルール

1. **🚨 NEVER EDIT `build-output/` FILES**: 必ず `src/` で開発
2. **BUILD REQUIRED**: `src/` 編集後は必ず `npm run dev:build`
3. **QUALITY FIRST**: コミット前に `npm run check` を実行
4. **TEST BEFORE PROD**: 本番デプロイ前に必ずテスト環境で確認

## 参考ドキュメント

- [データモデル設計仕様書](DATA_MODEL.md) - バックエンドデータ構造とキャッシュシステムの詳細
- [State管理ガイド](STATE_MANAGEMENT_GUIDE.md) - フロントエンドState管理の完全仕様
- [JavaScript分離開発アーキテクチャ](JS_TO_HTML_ARCHITECTURE.md) - ビルドシステムと開発ワークフロー
- [CLAUDE.md](../CLAUDE.md) - プロジェクト全体のガイドライン

---

**作成日**: 2024年初版
**最終更新**: 2025年10月2日
**対象バージョン**: v3.2.0
**ステータス**: 実装完了・運用中
