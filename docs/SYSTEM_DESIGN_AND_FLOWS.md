# システム設計とデータフロー

## 1. はじめに

このドキュメントは、プロジェクトの全体像を視覚的に理解するために、主要な設計要素とデータフローを図で示します。

- **プロジェクト構造**: 主要なファイル群とそれらの役割・依存関係
- **画面遷移図**: Webアプリのユーザーインターフェースの遷移
- **データフロー図**: ユーザー操作に応じたバックエンドでのデータ処理の流れ
- **主要機能の関連図**: バックエンドの主要機能間の呼び出し関係
- **フロントエンドアーキテクチャ**: フロントエンドの状態管理と画面描画の仕組み

## 2. プロジェクト構造図

プロジェクトを構成する主要なコンポーネントと、それらの基本的な依存関係を示します。

```mermaid
graph TD
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

    subgraph "フロントエンド (HTMLファイル群)"
        L[10_WebApp.html<br>メインページ] -- include --> M[11_WebApp_Config.html<br>UI設定]
        L -- include --> N[12_WebApp_Core.html<br>状態管理・コアロジック]
        L -- include --> O[13_WebApp_Views.html<br>画面生成]
        L -- include --> P[14_WebApp_Handlers.html<br>イベント処理]
    end

    B -- HTML生成 --> L
```

## 3. 画面遷移図

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

## 4. データフロー図

主要な操作における、フロントエンドとバックエンド間のデータの流れを時系列で示します。

### 4.1. ログイン処理

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
    US->>CM: getCachedData("生徒キャッシュ")
    alt キャッシュなし
        CM->>SS: 生徒名簿を読み込み
        SS-->>CM: 全生徒データ
        CM->>CM: キャッシュを構築
    end
    CM-->>US: 生徒データ
    US-->>EP: 認証結果 (ユーザー情報)

    alt 認証成功
        EP->>CM: getAvailableSlots()
        CM-->>EP: 空き枠データ
        EP->>CM: getUserReservations(studentId)
        CM-->>EP: 個人の予約・履歴データ
    end

    EP-->>FE: ログイン結果と全ての初期データ
```

### 4.2. 予約作成処理

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
    WR->>CM: getCachedData("予約キャッシュ")
    WR->>CM: getCachedData("日程マスタキャッシュ")
    CM-->>WR: キャッシュデータ
    WR->>WR: checkCapacityFull() (満席チェック)
    WR->>SS: 新しい予約行を追記
    SS-->>WR: 書き込み成功
    WR->>CM: rebuildAllReservationsCache() (予約キャッシュ更新)
    WR-->>EP: { success: true }

    EP->>EP: getBatchData() (最新の全データを再取得)
    EP-->>FE: 予約完了メッセージと最新データ
```

## 5. 主要機能の関連図

バックエンドにおける主要なビジネスロジック間の呼び出し関係を示します。

### 5.1. 空き枠計算 (`getAvailableSlots`)

```mermaid
graph TD
    A["09_Endpoints<br>getAvailableSlots"] --> B("05-3_AvailableSlots<br>getAvailableSlots")
    B --> C{"02-4_ScheduleMaster<br>getAllScheduledDates"}
    C --> D["07_CacheManager<br>getCachedData(日程マスタ)"]
    B --> E["07_CacheManager<br>getCachedData(予約キャッシュ)"]
    B --> F["08_Utilities<br>convertReservationsToObjects"]
```

### 5.2. ユーザー認証 (`authenticateUser`)

```mermaid
graph TD
    A["09_Endpoints<br>authenticateUser"] --> B("04_User<br>authenticateUser")
    B --> C{"09_Endpoints<br>getAppInitialData"}
    C --> D["07_CacheManager<br>getCachedData(各種キャッシュ)"]
    B --> E{"04_User<br>extractPersonalDataFromCache"}
    E --> F["08_Utilities<br>convertReservationsToObjects"]
```

## 6. フロントエンド アーキテクチャ

フロントエンドは「**状態管理 (State Management)**」モデルに基づいて構築されています。ユーザーの操作によって「状態」が変更され、その変更を検知して画面が自動的に再描画される、という一方向のデータフローを特徴とします。

これにより、UIの整合性を保ちやすく、予測可能な動作を実現しています。

```mermaid
graph TD
    subgraph "ユーザー操作"
        A(ボタンクリックなど)
    end

    subgraph "フロントエンド JavaScript"
        B["イベントリスナー<br>(14_WebApp_Handlers.html)"]
        C{"アクションハンドラ<br>(actionHandlers)"}
        D["stateManager<br>(12_WebApp_StateManager.html)"]
        E((状態<br>State))
        F["render() 関数"]
        G{"ビュー関数<br>(13_WebApp_Views.html)"}
        H["コンポーネント関数<br>(13_WebApp_Components.html)"]
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

### 解説

1. **ユーザー操作**: ユーザーがボタンをクリックするなど、何らかのアクションを起こします。
2. **イベントリスナー**: `14_WebApp_Handlers.html` にあるイベントリスナーがその操作を検知し、対応する `actionHandlers` の関数を呼び出します。
3. **アクションハンドラ**: 呼び出された関数は、必要に応じてバックエンドAPI (`google.script.run`) を呼び出すか、または直接 `stateManager` に状態の変更を依頼 (dispatch) します。
4. **状態更新**: `stateManager` (`12_WebApp_StateManager.html`) がアプリケーションの唯一の「状態 (State)」を更新します。
5. **再描画**: 状態が変更されると、`stateManager` は `render()` 関数に「状態が変わった」ことを通知します。
6. **画面構築**: `render()` 関数は、最新の状態を元に、`13_WebApp_Views.html` のビュー関数を呼び出して画面全体のHTMLを再構築します。
7. **DOM更新**: 新しく構築されたHTMLで、実際の画面が更新されます。

このサイクルにより、データと表示の一貫性が保たれます。
