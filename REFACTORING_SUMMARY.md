## 引継書：グローバル定数 `CONSTANTS` の型安全性向上に関するリファクタリング

### 1. 目的

本作業は、グローバル定数オブジェクト `CONSTANTS` の型定義がTypeScriptに正しく認識されず、存在しないプロパティにアクセスしても型エラーが検出されない問題を解決することを目的としていました。最終的なゴールは、`CONSTANTS`オブジェクトに対する完全な型安全性（コード補完と型チェック）をエディタ上で実現することです。

### 2. 問題の根本原因

- **現状**: `CONSTANTS` オブジェクトが、TypeScriptの型チェックにおいて `any` 型として扱われている。
- **原因**: プロジェクトの型定義の仕組みに、古い形式とモダンな形式が混在していることが原因でした。
    1. `tsc`は `src/shared/00_Constants.js` から `export namespace CONSTANTS { ... }` という型定義を生成します。
    2. `tools/create-global-bridge.js` は、この `namespace` をグローバル変数として利用可能にするため、`declare global { const CONSTANTS: typeof import('.').CONSTANTS; }` という型定義を生成しようとします。
    3. しかし、`import('.')` が型を解決するために必要な「目次」ファイル (`index.d.ts`) が、古い `/// <reference path="..." />` 形式で生成されており、モダンな `import` と連携できていませんでした。

### 3. 試みたアプローチと結果

上記の問題を解決するため、プロジェクト全体の型定義の仕組みを、古い `/// <reference>` 形式からモダンな **ESモジュール形式 (`import`/`export`)** へ統一する、大規模なリファクタリングを試みました。

- **成功した点**:
  - `types` ディレクトリ配下のすべての `index.d.ts` および個別の `.d.ts` ファイルを、`import`/`export` を使うモダンな形式に修正しました。

- **失敗した点**:
  - `tools/create-global-bridge.js` が、`tsc` の生成する `export namespace` を正しく解釈し、最終的なグローバル型定義 `declare const CONSTANTS: { ... }` へ変換するロジックを、最後まで安定して動作させることができませんでした。
  - 度重なるスクリプトの構文エラーや、最終的に判明したBOM（目に見えない文字コード）の問題など、複雑な要因が絡み合い、根本原因の特定と修正に時間を要した結果、完遂を断念しました。

### 4. 現在の状態

**すべての変更は元に戻されています。**

リファクタリングの試みによって変更された以下のファイルは、すべて作業開始前の状態に復元済みです。現在のプロジェクトは、当初の問題を抱えたままですが、デグレードは発生していません。

- `tools/create-global-bridge.js`
- `tools/create-dts-index.js`
- `types/backend-index.d.ts`
- `types/frontend-index.d.ts`
- `types/core/index.d.ts`
- `types/view/index.d.ts`
- `types/view/window.d.ts`
- `types/core/reservation.d.ts`

### 5. 今後の推奨アプローチ（引継ぎ事項）

当初の目的（`CONSTANTS`の型安全性の確保）は、依然としてこのプロジェクトにとって価値のある改善です。もし、この問題に再度取り組む場合は、以下のアプローチを推奨します。

#### 推奨プラン：ESモジュール化の再挑戦（より慎重に）

今回試みた方針は正しいものの、進め方に問題がありました。次のように段階的に進めるのが安全です。

1. **BOM問題の解決**:
    `tools/create-global-bridge.js`で、`fs.readFileSync()` を使ってファイル内容を読み込んだ直後に、以下のコードでBOMを確実に除去します。これがすべての前提となります。

    ```javascript
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    ```

2. **`create-global-bridge.js`の変換ロジックの改善**:
    `export namespace CONSTANTS` の中身を `declare const CONSTANTS: { ... }` へ変換するロジックを改善します。ここが最も複雑な部分です。
    - **課題**: `tsc`が生成する`namespace`内には、さらにネストされた`namespace`、`let`、`export let`、エイリアス用の`export { ... }`が混在しています。
    - **アプローチ**: 単純な正規表現の繰り返しではなく、ファイル内容を行ごとに解析し、`namespace`のネストレベルを追跡しながら、各行を以下のように変換する、より堅牢なパーサー（解析処理）を実装する必要があります。
        - `namespace FOO` -> `readonly FOO: {`
        - `let BAR: string;` -> `readonly BAR: string;`
        - `export { FOO_1 as FOO };` -> このようなエイリアス定義を解釈し、正しいプロパティ名に変換する。

3. **段階的なESモジュール化**:
    上記が成功した後、`tools/create-d.ts-index.js`を`export * from '...'`形式に変更し、前回と同様に`types`配下の`.d.ts`ファイルを一つずつ`import`/`export`形式に修正していきます。一つ修正するごとに`npm run types:generate`と`npm run types:check`を実行し、問題が発生しないかを確認しながら進めるのが安全です。
