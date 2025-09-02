# 予約確定メール送信機能 実装計画

## 概要

予約完了時に生徒に自動で予約確定メールを送信する機能を追加する。初回予約者には追加でメール送信に関する案内を表示する。

## 現状分析

### システム構成確認結果

1. **送信元メールアドレス**
   - ✅ プロパティサービスに `ADMIN_EMAIL` として既存設定済み
   - 場所: `src/01_Code.js:31`

2. **送信先メールアドレス**
   - ✅ 生徒名簿シートに「メールアドレス」列が存在
   - ヘッダー定数: `CONSTANTS.HEADERS.ROSTER.EMAIL` (`src/00_Constants.js:235`)
   - ❌ 現在はキャッシュされていない（生徒基本情報キャッシュは電話番号・氏名のみ）

3. **初回予約フラグ**
   - ✅ StateManagerに `isFirstTimeBooking` として管理済み
   - 複数箇所で参照・利用済み (`src/13_WebApp_Views.html`)
   - ⚠️ 予約完了後のデータ再取得で解除される可能性（要検証・対策）

4. **予約完了処理フロー**
   - フロントエンド: `confirmBooking()` → `makeReservationAndGetLatestData()`
   - バックエンド: `makeReservation()` → 予約作成 → 最新データ返却
   - 現在のフロー: 予約作成 → データ再取得 → 完了画面表示

## 実装方針

### アーキテクチャ方針

1. **責任分離**: メール送信ロジックを独立した関数として実装
2. **初回必須メール**: 初回予約者には住所情報等を含む確定メールを必ず送信
3. **プロフィール機能拡張**: メール設定項目をプロフィール編集で管理可能に
4. **キャッシュ活用**: メールアドレス情報のキャッシュ化で高速処理
5. **初回フラグ保持**: 予約完了後のデータ再取得で初回フラグが消失しないよう対策

### 技術的アプローチ

- **GmailApp**を使用したメール送信（PropertiesServiceの`ADMIN_EMAIL`から送信）
- **初回者特別対応**：メールアドレス未設定でも必須送信のための入力促進
- **プロフィール統合**：既存のregistrationStep2項目をプロフィール編集でも利用
- **エラーハンドリング**：初回者のメール送信失敗時の適切な処理
- **テンプレート化**：住所情報や予約管理案内を含むメール本文

## 実装計画

### Phase 1: メール送信基盤の構築

#### 1.1 メールサービス機能の実装

**ファイル**: `src/06_ExternalServices.js`（既存ファイル拡張）

**実装内容**:

```javascript
/**
 * 予約確定メール送信機能
 * @param {Object} reservation - 予約情報
 * @param {Object} student - 生徒情報（メールアドレス含む）
 * @param {boolean} isFirstTime - 初回予約フラグ
 */
function sendBookingConfirmationEmail(reservation, student, isFirstTime) {
  // メール送信ロジック
}

/**
 * メールテンプレート生成
 */
function createBookingConfirmationTemplate(reservation, student, isFirstTime) {
  // HTMLメールテンプレート生成
}
```

**機能詳細**:

- GmailAppを使用した HTML + テキスト形式のメール送信
- 初回者向け特別メッセージの挿入
- 送信エラー時のログ記録とエラーハンドリング
- メール送信失敗時も予約処理は継続

#### 1.2 メールアドレス取得機能の改善

**方針A: 既存キャッシュ拡張**（推奨）

- `all_students_basic`キャッシュにメールアドレスを追加
- キャッシュサイズ影響: 約+10KB（250名×40バイト想定）
- 実装場所: `src/07_CacheManager.js`

**方針B: オンデマンド取得**

- 予約時に生徒名簿から直接取得
- キャッシュサイズへの影響なし
- パフォーマンス: 若干の遅延（許容範囲）

**推奨**: 方針A（キャッシュ拡張）

- メール連絡希望フラグ（`EMAIL_PREFERENCE`）も同時にキャッシュ化
- 将来的なメール機能拡張に対応

### Phase 2: 予約処理との統合

#### 2.1 予約作成処理の拡張

**ファイル**: `src/05-2_Backend_Write.js` の `makeReservation()` 関数

**実装内容**:

```javascript
function makeReservation(reservationInfo) {
  try {
    // 既存の予約作成処理
    const result = [既存処理];
    
    // メール送信（非同期）
    if (result.success) {
      Utilities.sleep(100); // 予約確定後の短い待機
      try {
        sendBookingConfirmationEmailAsync(reservationInfo);
      } catch (emailError) {
        // メール送信エラーは予約成功に影響させない
        Logger.log(`メール送信エラー（予約は成功）: ${emailError.message}`);
      }
    }
    
    return result;
  } catch (e) {
    // 既存のエラーハンドリング
  }
}
```

#### 2.2 非同期メール送信関数

**実装内容**:

```javascript
function sendBookingConfirmationEmailAsync(reservationInfo) {
  const { user, studentId } = reservationInfo;
  
  // 初回フラグの取得（reservationInfoから）
  const isFirstTime = reservationInfo.options?.firstLecture || false;
  
  // 生徒情報（メールアドレス含む）を取得
  const studentWithEmail = getStudentWithEmail(studentId);
  
  if (!studentWithEmail || !studentWithEmail.email) {
    if (isFirstTime) {
      // 初回者でメールアドレス未設定の場合はエラーログ（本来は事前入力で防止）
      Logger.log(`初回者メール送信失敗: メールアドレス未設定 (${studentId})`);
      logActivity(studentId, 'メール送信エラー', '初回者: メールアドレス未設定');
    } else {
      Logger.log(`メール送信スキップ: メールアドレス未設定 (${studentId})`);
    }
    return;
  }
  
  // 初回者は必須送信、経験者はメール連絡希望確認
  if (!isFirstTime && studentWithEmail.emailPreference !== '希望する') {
    Logger.log(`メール送信スキップ: メール連絡希望なし (${studentId})`);
    return;
  }
  
  sendBookingConfirmationEmail(reservationInfo, studentWithEmail, isFirstTime);
}
```

### Phase 3: プロフィール編集機能の拡張

#### 3.1 プロフィール編集画面にメール設定追加

**ファイル**: `src/13_WebApp_Views.html` の `getUserFormView()` 関数

**実装内容**:

registrationStep2で既に実装されているメール設定項目を、プロフィール編集モードでも表示・編集可能にする

```javascript
// プロフィール編集時のメール設定セクション追加
const emailSection = isEdit ? `
  ${Components.createInput({ 
    id: 'edit-email', 
    label: 'メールアドレス', 
    type: 'email', 
    value: u.email || '',
    required: false 
  })}
  <div class="p-3 bg-ui-surface rounded-md">
    <label class="flex items-center space-x-3">
      <input type="checkbox" id="edit-wants-email" 
             class="h-5 w-5 accent-action-primary-bg" 
             ${u.wantsEmail ? 'checked' : ''}>
      <span class="text-brand-text text-sm">今後の教室日程などの、メール連絡を希望します</span>
    </label>
  </div>
` : '';
```

#### 3.2 予約完了画面の案内メッセージ更新

**ファイル**: `src/13_WebApp_Views.html` の予約完了画面

**実装内容**:

初回予約者への住所情報とシステム利用案内を含むメッセージ

```javascript
// 予約完了メッセージの拡張
if (isFirstTimeBooking) {
  completionMessage += `

📧 ご登録のメールアドレスに予約確定メールをお送りしました。
メールには詳しい住所や当日のご案内が記載されています。

メールが届かない場合は、迷惑メールフォルダもご確認ください。
今後の予約の確認やキャンセルは、こちらのページで行えます。`;
} else if (studentHasEmail && emailPreference) {
  completionMessage += `

📧 ご登録のメールアドレスに予約確定メールをお送りしました。`;
}
```

#### 3.3 保存処理の拡張

**ファイル**: `src/14_WebApp_Handlers.html` の `saveProfile()` 関数

**実装内容**:

メールアドレスとメール連絡希望フラグの保存処理を追加

```javascript
// saveProfile 関数の拡張
const emailInput = document.getElementById('edit-email');
const wantsEmailInput = document.getElementById('edit-wants-email');

const u = {
  ...stateManager.getState().currentUser,
  realName: r,
  displayName: n,
  phone: phone,
  email: emailInput ? emailInput.value : stateManager.getState().currentUser.email,
  wantsEmail: wantsEmailInput ? wantsEmailInput.checked : stateManager.getState().currentUser.wantsEmail,
};
```

#### 3.4 初回フラグ保持対策

**問題**: 予約完了後のデータ再取得で `isFirstTimeBooking` が解除される

**対策方針**:

1. **フラグ持続**: 予約作成時に初回フラグを確定し、完了画面表示まで保持
2. **レスポンス拡張**: `makeReservationAndGetLatestData()` のレスポンスに初回フラグ情報を含める

**実装**:

```javascript
// src/09_Backend_Endpoints.js の拡張
function makeReservationAndGetLatestData(reservationInfo) {
  const isFirstTime = reservationInfo.options?.firstLecture || false;
  
  const result = executeOperationAndGetLatestData(/* ... */);
  
  if (result.success && result.data) {
    // 初回フラグ情報を追加
    result.data.wasFirstTimeBooking = isFirstTime;
  }
  
  return result;
}
```

### Phase 4: メールテンプレート設計

#### 4.1 基本テンプレート構成

**件名**: `【川崎誠二 木彫り教室】受付完了のお知らせ - [予約日] [教室名]`

**本文構成**:

1. 挨拶・確認メッセージ
2. 予約詳細情報
   - 日時・教室
   - オプション（初講・彫刻刀レンタル）
   - 料金概要
3. **初回者限定: 詳しい住所・アクセス情報**（該当者のみ）
4. 当日の案内
   - 持ち物・注意事項
   - 駐車場情報
5. **予約管理システムの案内**
   - 予約確認・変更・キャンセル方法
   - システムURL
6. 変更・キャンセルに関する案内
7. 初回者限定メッセージ（該当者のみ）
8. 連絡先・署名

#### 4.2 初回者向け特別セクション

**初回参加メッセージ**:

```
{申込者名}さま

ご予約の申込みをいただき、ありがとうございます！
木彫り作家の川崎誠二です。

私の教室を見つけていただき、また選んでくださり、とてもうれしく思います！！

・申込み内容
教室:
会場:
日付:
時間:
基本授業料:
受付日時:

以上の内容を {キャンセル待ち or ご予約} で承りました。

初回の方にはまずは「だるま」の木彫りを制作しながら、木彫りの基本をお話します。
単純な形なので、ていねいに木目と刃の入れ方についてくわしく説明しますよ！
きれいな断面を出しながら、カクカクしていてそれでいてころりんとしたかたちをつくっていきます。

残りの時間からは自由にお好きなものを製作していただけます。こちらは、どのような形・大きさにするかにもよりますが、初回だけでは完成まで至らない可能性が大きいので、その点はご了承ください。


予約の確認やキャンセルは、こちらのページで行えます！（私のお手製アプリです！）
[[きぼりのよやく・きろく](https://www.kibori-class.net/booking)]

次回以降の予約や会計記録や参加の記録もこちらからできますよ。
スマホのブラウザで「ホームに追加」や「ブックマーク」しておくと便利です！

下に教室に関して連絡事項をまとめました。1度目を通しておいてください。
他にも質問あれば、このメールに直接ご返信ください。

それではどうぞよろしくお願いいたします！

川崎誠二
09013755977
参加当日に場所がわからないなどあれば、こちらにお電話やSMSでご連絡ください。

 ----------------------------------------------------
*教室に関して連絡事項★*

注意事項：
・体調不良の場合、連絡は後日でも構わないので無理をせずお休みください（キャンセル料なし）
・その他、キャンセルの場合はなるべくお早めにご連絡ください
・刃物を使うため怪我の可能性はあります。なにかあった場合は自己責任でお願いいたします

その他の料金：
・彫刻刀レンタル１回 ¥500 （持ち込みや購入の場合は不要）
・材料代 ¥100 ~¥2,000 程度（材料の大きさ、樹種に応じて計算）
・道具類などを購入する場合は、その代金

お支払い：現金、オンラインバンキング送金、ことら送金 （すべて当日）
※ことら送金･･･電話番号やメールアドレス宛に、銀行のスマホアプリから、手数料なしで送金できるサービス。ゆうちょ銀行、三井住友銀行など。詳しくはこちら

もちもの：
・わくわくした気持ち
・作りたい物の見本や資料
・飲み物
※セーターなど木屑が付きやすい服は避ける
お持ちであれば
・よく切れる彫刻刀
・その他の木彫り道具類
必要であれば
・おやつ・昼食（外食も可）
・エプロン
・ブランケット（寒い時期）
・椅子に敷くクッション

会場：
【東京教室 浅草橋】
Parts Studio Tokyo パーツスタジオ2F
〒111-0053 東京都台東区浅草橋１丁目７−７（陶芸スタジオ2Fのギャラリースペース）
Googleマップで表示
・浅草橋駅より徒歩1,2分 
（浅草橋駅はJR中央・総武線、都営浅草線の駅。秋葉原から1駅）

【東京教室 東池袋】
総合不動産  店舗内（池袋サンシャインシティの近く）
〒170-0013 東京都豊島区東池袋３丁目２０－２０ 東池袋ハイツ壱番館 １Ｆ
（建物入り口正面から見て、右側の一段下がっているところにある不動産屋さんの店舗内）
Googleマップで表示
・池袋駅東口より 15分
・山手線 大塚駅より 15分
・有楽町線 東池袋駅より 10分
・都電荒川線 向原駅より 7分
（いずれも徒歩の場合） 

【つくば教室】
〒305-0861 茨城県つくば市谷田部 1051-7
駐車場など詳しい情報はこちらのリンク先
https://sites.google.com/view/kwskikbr/tukuba

【沼津教室】
〒410-0844 静岡県沼津市春日町67-5
駐車場など詳しい情報はこちらのリンク先
https://sites.google.com/view/kwskikbr/numazu


----------------------------------------------------
川崎 誠二 KAWASAKI Seiji
Email shiawasenahito3000@gmail.com
個人 https://shiawasenahito.wordpress.com/（更新停止中）
教室サイト https://www.kibori-class.net/
ONLINE SHOP https://seiji-kawasaki.stores.jp/
----------------------------------------------------
作品など
Instagram @seiji_kawasaki
X (Twitter) @sawsnht
Facebook @woodcarving.kawasaki
----------------------------------------------------
教室（生徒作品紹介）
Instagram @kibori_class
X (Twitter) @kibori_class
----------------------------------------------------
```

### Phase 5: エラーハンドリングとログ

#### 5.1 エラーパターンと対処

1. **初回者のメールアドレス未設定**
   - エラーログ記録（重要度: 高）
   - アクティビティログに記録
   - 管理者への通知検討（住所情報が送れない）

2. **初回者のメール送信失敗**
   - 詳細エラーログ記録
   - 予約処理への影響なし
   - 管理者への通知（住所案内のため重要）

3. **経験者のメールアドレス未設定**
   - ログ記録のみ、処理継続
   - 管理者への通知は不要（任意登録のため）

4. **経験者のメール連絡希望なし**
   - ログ記録のみ、処理継続

5. **経験者のメール送信失敗**
   - 詳細エラーログ記録
   - 予約処理への影響なし

#### 5.2 アクティビティログ連携

**ファイル**: `src/08_ErrorHandler.js` の活用

```javascript
// メール送信成功時
logActivity(studentId, 'メール送信', '予約確定メール送信完了');

// メール送信失敗時
logActivity(studentId, 'メール送信エラー', `失敗理由: ${error.message}`);
```

## 実装順序とマイルストーン

### Milestone 1: メール送信基盤（推定工数: 3-4時間）

1. `06_ExternalServices.js` にメール送信機能実装
2. 初回者向け住所情報を含むメールテンプレート作成
3. 初回/経験者別のエラーハンドリング

### Milestone 2: データ取得改善（推定工数: 1-2時間）

1. 生徒基本情報キャッシュにメールアドレス・連絡希望フラグ追加
2. キャッシュ再構築とテスト

### Milestone 3: プロフィール編集機能拡張（推定工数: 2-3時間）

1. `getUserFormView()` にメール設定項目追加
2. `saveProfile()` のメール情報保存処理拡張
3. プロフィール更新処理のテスト

### Milestone 4: 予約処理統合（推定工数: 2-3時間）

1. `makeReservation()` 関数へのメール送信処理統合
2. 初回者必須メール送信ロジック実装
3. 非同期処理の実装とテスト

### Milestone 5: フロントエンド対応（推定工数: 1-2時間）

1. 初回者向け完了画面メッセージ更新
2. 初回フラグ保持対策
3. エラー案内メッセージ

### Milestone 6: テスト・調整（推定工数: 2-3時間）

1. テスト環境での動作確認
2. メールテンプレートの調整
3. エラーハンドリングとログ確認
4. 初回者メール未設定時の対応確認

**総推定工数**: 11-17時間

## リスク要因と対策

### 技術的リスク

1. **GmailApp制限**
   - 日次送信制限: 100通/日（通常運用では十分）
   - 対策: 制限近接時の警告ログ実装

2. **メール送信遅延**
   - 予約処理全体の遅延可能性
   - 対策: 非同期処理による分離

3. **キャッシュサイズ増加**
   - メールアドレス追加による容量増加
   - 対策: 事前の容量試算（+10KB程度、問題なし）

### 運用リスク

1. **スパム判定**
   - 自動送信メールのスパム判定リスク
   - 対策: 適切な件名・署名・本文構成

2. **メールアドレス更新**
   - 生徒の連絡先変更への対応
   - 対策: プロフィール更新画面でのメール設定確認

## 設定・運用考慮事項

### PropertiesService設定

現在の `ADMIN_EMAIL` 設定を確認・活用：

```text
キー: ADMIN_EMAIL
値: [教室の公式メールアドレス]
```

### メール連絡希望の取り扱い

- 生徒名簿の「メール連絡希望」フラグを尊重
- 未設定者にはメール送信しない
- プロフィール更新での変更可能

### 今後の拡張性

1. **メール種別追加**
   - キャンセル確定メール
   - リマインダーメール
   - キャンペーン情報

2. **テンプレート管理**
   - 管理画面からのテンプレート編集
   - 季節メッセージの自動挿入

3. **送信履歴管理**
   - メール送信履歴の記録
   - 配信状況の確認機能

## 結論

本実装計画により、予約確定メール送信機能を既存システムに安全かつ効率的に統合できる。特に初回予約者への配慮と、既存の予約処理への影響を最小限に抑えた設計により、ユーザー体験の向上とシステムの安定性を両立している。

実装後は、メール送信状況の監視と、生徒からのフィードバックに基づいた継続的な改善を行う。
