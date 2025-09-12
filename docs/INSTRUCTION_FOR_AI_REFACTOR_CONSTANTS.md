# 改修指示書：定数注入方式のビルドタイムへの移行

## 1. はじめに

このドキュメントは、本プロジェクトの定数管理アーキテクチャを改善するための改修作業を指示するものです。AI開発者（Sonnet 4）が本指示書に従い、正確かつ効率的に作業を完了することを期待します。

## 2. 目的 (Why)

現在、フロントエンドで利用する定数は、GASサーバーが**実行時（ランタイム）**にHTMLへ注入しています。この方式を、開発者のローカル環境で**ビルド時（ビルドタイム）**に静的に注入する方式へ変更します。

これにより、以下の改善を目指します。

- **パフォーマンス向上**: ページリクエスト時のサーバー処理をなくし、表示を高速化します。
- **開発フローの統一**: 「コードを修正したらビルドする」というモダンな開発スタイルに、定数の反映プロセスを完全に統合します。
- **アーキテクチャの簡素化**: ビルドプロセスとランタイムの役割を明確に分離します。

## 3. 現状の仕組み (As-Is)

- **サーバーサイド**: `src/backend/01_Code.js` の `doGet` 関数が `HtmlService.createTemplateFromFile('10_WebApp').evaluate()` を使い、実行時にHTMLテンプレートを評価しています。
- **HTMLテンプレート**: `src/templates/10_WebApp.html` は `<?!= include(...) ?>` というGASのテンプレート構文を使い、複数のJSファイルを動的に読み込んでいます。
- **ビルドスクリプト**: `tools/unified-build.js` は、`src/frontend/*.js` ファイル群を一つに結合し、HTMLに埋め込む機能を持っていますが、バックエンドの定数ファイル（`src/backend/00_Constants.js`）は参照していません。

## 4. 完了の定義 (Definition of Done)

以下のすべての項目が満たされたとき、このタスクは完了とみなされます。

- [ ] `tools/unified-build.js` が `src/backend/00_Constants.js` の内容を読み込み、フロントエンド用JSの先頭に注入するようになっている。
- [ ] フロントエンドのJSファイル（`src/frontend/*`）内にある、重複した定数定義が削除されている。
- [ ] `src/backend/01_Code.js` の `doGet` 関数が、テンプレート評価（`.evaluate()`）を行わず、静的なHTMLを返すようになっている。
- [ ] `npm run build` 等のビルドコマンドで生成された `build-output/10_WebApp.html` が、単体で動作する自己完結したファイルになっている。
- [ ] デプロイ後、Webアプリケーションが正常に動作し、`CONSTANTS` が正しく設定されていることが確認できる。

## 5. 作業手順 (Step-by-Step)

以下の手順に従って、慎重に作業を進めてください。

### Step 1: ビルドスクリプトの機能拡張 (`tools/unified-build.js`)

`tools/unified-build.js` 内の `buildUnifiedJavaScript` メソッドを修正し、バックエンドの定数ファイルを読み込む機能を追加します。

**変更対象ファイル**: `tools/unified-build.js`

```javascript
// tools/unified-build.js

  // ...（ファイル上部）

  async buildUnifiedJavaScript() {
    console.log(`[${formatTime()}] 🔨 Unifying frontend JavaScript files...`);

    if (!fs.existsSync(this.frontendDir)) {
      console.log(
        `[${formatTime()}]    ⚠️  Frontend directory not found: ${this.frontendDir}`,
      );
      return this.generateFallbackJavaScript();
    }

    const frontendFiles = fs
      .readdirSync(this.frontendDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    let unifiedContent = '';

    // --- ▼▼▼ ここから追加 ▼▼▼ ---
    const constantsPath = path.join(this.backendDir, '00_Constants.js');
    if (fs.existsSync(constantsPath)) {
      const constantsContent = fs.readFileSync(constantsPath, 'utf8');
      unifiedContent += `
  // =================================================================
`;
      unifiedContent += `  // 00_Constants.js (自動注入 from backend)
`;
      unifiedContent += `  // =================================================================

`;
      unifiedContent += constantsContent + '
';
      console.log(`[${formatTime()}]   ✅ 00_Constants.js injected`);
    }
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---

    // 統合JavaScriptヘッダー
    unifiedContent += this.generateJavaScriptHeader();

    // 各フロントエンドファイルを統合
    for (const jsFile of frontendFiles) {
    // ...（以降、変更なし）
```

### Step 2: フロントエンド内の重複定数定義の削除

フロントエンドのコードに、バックエンドと重複する定数定義があれば削除します。特に `11_WebApp_Config.js` を確認してください。

**変更対象ファイル**: `src/frontend/11_WebApp_Config.js` （および同様の定義を持つ他のファイル）

**変更内容**: `const CONSTANTS = ...` や `const C = CONSTANTS;` のような、`00_Constants.js` と同じ内容を定義している箇所を**すべて削除**してください。Step 1で自動注入されるため、これらの定義は不要になります。

### Step 3: HTMLテンプレートのクリーンアップ

`10_WebApp.html` から、ビルドスクリプトが処理する対象の `<?!= include(...) ?>` 構文を削除し、テンプレートを簡素化します。

**変更対象ファイル**: `src/templates/10_WebApp.html`

**変更前**:

```html
<!-- GAS環境用のJavaScriptファイル読み込み（テンプレート評価対応） -->
<?!= include('11_WebApp_Config'); ?>
<!-- 設定・定数 -->
<?!= include('12_WebApp_StateManager'); ?>
<!-- 状態管理システム -->
<?!= include('12_WebApp_Core'); ?>
<!-- 中核機能・ユーティリティ -->
<?!= include('13_WebApp_Components'); ?>
<!-- UIコンポーネント -->
<?!= include('13_WebApp_Views'); ?>
<!-- 画面生成関数 -->
<?!= include('14_WebApp_Handlers'); ?>
<!-- イベント処理・アクション -->
```

**変更後**:

```html
<!-- 統合JavaScriptはビルド時にここに挿入されます -->
<!-- 設定・定数 -->
```

_(注意: `<!-- 設定・定数 -->` というコメント行は、ビルドスクリプトがJSを注入する際の目印として使用しているため、**削除しないでください**)_

### Step 4: サーバーサイドコードの簡素化

`doGet` 関数がテンプレート評価（`.evaluate()`）を行わず、ビルド済みの静的HTMLを直接返すように修正します。

**変更対象ファイル**: `src/backend/01_Code.js`

**変更前**:

```javascript
// src/backend/01_Code.js の doGet 関数内
return HtmlService.createTemplateFromFile('10_WebApp').evaluate().setTitle('きぼりの よやく・きろく').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

**変更後**:

```javascript
// src/backend/01_Code.js の doGet 関数内
return HtmlService.createHtmlOutputFromFile('10_WebApp').setTitle('きぼりの よやく・きろく').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

_(`.evaluate()` を削除し、`createTemplateFromFile` を `createHtmlOutputFromFile` に変更します)_

### Step 5: 検証

すべてのコード変更が完了したら、以下の手順で動作を検証してください。

1. **ビルド**: ターミナルで `npm run build` （またはプロジェクトで定義されているビルドコマンド）を実行します。エラーが発生しないことを確認してください。
2. **生成ファイルの確認**: `build-output/10_WebApp.html` ファイルを開きます。
   - `00_Constants.js` の内容（`const CONSTANTS = {...}`）が`<script>`タグ内に含まれていることを確認します。
   - `src/frontend/` 以下のすべてのJSファイルの内容が、その後に続いていることを確認します。
3. **デプロイ**: `clasp push` コマンドで、変更をGoogle Apps Scriptにデプロイします。
4. **動作確認**: WebアプリケーションのURLにアクセスします。
   - アプリケーションが以前と同様に正常に動作することを確認します。
   - ブラウザの開発者ツールを開き、コンソールで `window.CONSTANTS` と入力し、オブジェクトが正しく定義されていることを確認します。

## 6. 注意事項

- 作業前には、必ずバージョン管理システム（Git）でブランチを作成してください。
- 一つのステップが完了するごとに、可能であればビルドを実行し、問題がないかを確認しながら進めてください。
- この指示書の内容で不明な点があれば、作業を中断し、確認を求めてください。

以上です。作業をよろしくお願いします。
