/**
 * =================================================================
 * 【ファイル名】  : 02-1_BusinessLogic_Batch.gs
 * 【モジュール種別】: バックエンド（GAS）
 * 【役割】        : 管理メニューから手動実行される重いバッチ処理（アーカイブ・集計）をまとめる。
 *
 * 【主な責務】
 *   - 予約記録のアーカイブ転送や売上ログの再集計など、定期実行では重過ぎる処理を提供
 *   - テスト環境構築や各種ベースデータ初期化のユーティリティ関数を提供
 *   - エラー時は `handleError` を通じて統一ログに記録
 *
 * 【関連モジュール】
 *   - `08_Utilities.js`: エラーハンドリング・共通処理で連携
 *   - `07_CacheManager.js`: バッチ後にキャッシュ整合性を保つための再構築を呼び出すケースがある
 *   - `05-2_Backend_Write.js`: アーカイブ対象の予約データフォーマットを共有
 *
 * 【利用時の留意点】
 *   - 本番環境での実行は手動確認が必要。データ破壊的操作が含まれるため十分にバックアップを取る
 *   - UI からの操作では進捗トーストを表示するが、長時間バッチの場合はログも併用する
 *   - 処理を分割したい場合は個別関数化してメニューから呼び出せるようにする
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { handleError } from './08_Utilities.js';

/**
 * 【開発用】テスト環境をセットアップします。
 * 現在のスプレッドシートをコピーし、テスト用の新しい環境を作成します。
 */
export function setupTestEnvironment() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'テスト環境の作成',
    '現在のスプレッドシートの完全なコピーを作成し、テスト環境としてセットアップします。よろしいですか？',
    ui.ButtonSet.OK_CANCEL,
  );

  if (response !== ui.Button.OK) {
    ui.alert('処理を中断しました。');
    return;
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'テスト環境を作成中です...',
      '処理中',
      -1,
    );

    const sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceFile = DriveApp.getFileById(sourceSpreadsheet.getId());

    // 1. スプレッドシートをコピー
    const newFileName = `【テスト用】${sourceSpreadsheet.getName()}`;
    const copiedFile = sourceFile.makeCopy(newFileName);
    const copiedSpreadsheet = SpreadsheetApp.openById(copiedFile.getId());

    // 2. コピーしたスプレッドシートの情報を取得
    const newUrl = copiedSpreadsheet.getUrl();
    const newId = copiedSpreadsheet.getId();

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'テスト環境の作成が完了しました。',
      '完了',
      5,
    );

    // 3. ユーザーに情報を提示
    const htmlOutput = HtmlService.createHtmlOutput(
      `<h4>テスト環境のセットアップが完了しました</h4>
       <p>新しいテスト用スプレッドシートと、それに紐づくApps Scriptプロジェクトが作成されました。</p>
       <p><b>ファイル名:</b> ${newFileName}</p>
       <p><b>スプレッドシートURL:</b> <a href="${newUrl}" target="_blank">ここをクリックして開く</a></p>
       <p><b>スプレッドシートID:</b> <code>${newId}</code></p>
       <hr>
       <h4>次のステップ: ローカル開発環境の接続とトリガー設定</h4>
       <ol style="text-align: left; padding-left: 20px;">
           <li>
               <b>新しいスクリプトIDの確認:</b>
               上記URLから新しいスプレッドシートを開き、拡張機能 &gt; Apps Script からスクリプトエディタを開いてください。
               開いたら、左側の「プロジェクトの設定」（歯車のアイコン）をクリックし、<b>「スクリプトID」</b>をコピーしてください。
           </li>
           <li>
               <b>ローカル環境（.clasp.json）の更新:</b>
               ターミナルで以下のコマンドを実行し、<code>.clasp.json</code>の<code>scriptId</code>をコピーした<b>スクリプトID</b>に更新してください。<br>
               <pre style="background-color:#f0f0f0; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 0.9em;"><code>clasp setting scriptId &lt;ここにコピーしたスクリプトIDをペースト&gt;</code></pre>
           </li>
           <li>
               <b>コードのプッシュ:</b>
               その後、<code>clasp push</code>でコードをデプロイしてください。
           </li>
           <li>
               <b>トリガーの再設定:</b>
               新しいスクリプトプロジェクトのエディタで、左側の「トリガー」（時計のアイコン）をクリックし、<code>handleOnChange</code>と<code>handleEdit</code>のトリガーを再設定してください。<br>
               (イベントの種類: <code>変更時</code> と <code>編集時</code>)
           </li>
       </ol>
       <br>
       <input type="button" value="閉じる" onclick="google.script.host.close()" style="background-color: #f0f0f0; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">`,
    )
      .setWidth(600)
      .setHeight(400);

    ui.showModalDialog(htmlOutput, 'セットアップ完了');
  } catch (err) {
    handleError(
      `テスト環境の作成中にエラーが発生しました: ${err.message}`,
      true,
    );
  }
}
