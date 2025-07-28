# 作業計画書: 会計完了画面のUX改善

## 1. 目的 (Objective)

現在のWebアプリケーションでは、ユーザーが会計を完了すると、「ありがとうございました」というメッセージとダッシュボードへ戻るボタンが表示されるのみです。

このタスクの目的は、この**会計完了画面を改修**し、ユーザーがその流れで**シームレスに次回の予約を行えるようにする**ことで、ユーザー体験（UX）を向上させることです。

具体的には、完了画面に以下の要素を指定の順序で表示します。

1. 完了メッセージ（「ありがとうございました」など）
2. 「ダッシュボードへ戻る」ボタン
3. 「次回の予約」という見出し
4. 会計を行った教室の、予約可能な未来の日付の一覧（カード形式）

## 2. 作業概要 (Overview)

この目的を達成するため、以下の3つのステップで作業を進めます。

1. **バックエンドの改修**: 会計処理の完了時に、フロントエンドへ**最新の空き枠情報**を返すようにします。
2. **フロントエンド（ハンドラ）の改修**: バックエンドから受け取った最新の空き枠情報を、アプリケーションの状態(`appState`)に保存します。
3. **フロントエンド（ビュー）の改修**: アプリケーションの状態を元に、会計完了画面のHTMLを新しいレイアウトで生成します。

## 3. 変更対象ファイル (Files to Modify)

- `src/05-2_Backend_Write.js`
- `src/14_WebApp_Handlers.html`
- `src/13_WebApp_Views.html`

---

## 4. 詳細な作業手順 (Step-by-Step Instructions)

### **ステップ1: バックエンドの改修 (`saveAccountingDetails`に関数を追加)**

まず、会計処理が成功した際に、フロントエンドへ渡すデータに「最新の空き枠情報」を追加します。

**ファイル:** `src/05-2_Backend_Write.js`

**指示:**
`saveAccountingDetails` 関数の `return` 文の直前に、**特定の教室の空き枠情報を取得するロジックを追加**し、その結果を戻り値に含めてください。

**参考コード:**
以下のコードを参考に、`saveAccountingDetails` 関数を修正してください。

```javascript
function saveAccountingDetails(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_TIME_MS);
  try {
    // ... 関数前半のロジックは変更なし ...

    // [変更箇所ここから]
    // --- 既存の処理の最後に追加 ---

    // 8. 最新の参加履歴を取得して返す
    const historyResult = getParticipationHistory(actualStudentId, null, null);
    if (!historyResult.success) {
      // 履歴取得に失敗しても、メインの会計処理は成功として扱う
      Logger.log(`会計処理後の履歴取得に失敗: ${historyResult.message}`);
    }

    // [追加] 9. 更新されたサマリーから、最新の空き枠情報を取得する
    const updatedSlotsResult = getSlotsAndMyBookings(actualStudentId);
    const updatedSlotsForClassroom = updatedSlotsResult.success ? updatedSlotsResult.availableSlots : [];


    // 9. 【NEW】会計済みの予約をアーカイブし、元の行を削除する
    _archiveSingleReservation(sheet, targetRowIndex, reservationDataRow);

    // ログと通知
    const logDetails = `Classroom: ${classroom}, ReservationID: ${reservationId}, Total: ${finalAccountingDetails.grandTotal}`;
        logActivity(studentId, '会計記録保存', '成功', logDetails);

    const subject = `会計記録 (${classroom})`;
    const body =
      `会計が記録されました。\n\n` +
      `教室: ${classroom}\n` +
      `予約ID: ${reservationId}\n` +
      `生徒ID: ${studentId}\n` +
      `合計金額: ${finalAccountingDetails.grandTotal.toLocaleString()} 円\n\n` +
      `詳細はスプレッドシートを確認してください。`;
    sendAdminNotification(subject, body);

    // [変更] 戻り値に updatedSlots を追加
    return {
      success: true,
      newBookingsCache: newBookingsCache,
      newHistory: historyResult.history,
      newHistoryTotal: historyResult.total,
      updatedSlots: updatedSlotsForClassroom, // <--- これを追加
      message: '会計処理と関連データの更新がすべて完了しました。',
    };
    // [変更箇所ここまで]

  } catch (err) {
    logActivity(payload.studentId, '会計記録保存', 'エラー', `Error: ${err.message}`);
    Logger.log(`saveAccountingDetails Error: ${err.message}\n${err.stack}`);
    return { success: false, message: `会計情報の保存中にエラーが発生しました。\n${err.message}` };
  } finally {
    lock.releaseLock();
  }
}
```

### **ステップ2: フロントエンド（ハンドラ）の改修**

次に、バックエンドから返された最新の空き枠情報を、フロントエンドのアプリケーション状態(`appState`)に反映させます。

**ファイル:** `src/14_WebApp_Handlers.html`

**指示:**
`actionHandlers.confirmAndPay` アクションの `withSuccessHandler` 内にある `setState` の呼び出し箇所で、`slots` プロパティを新しいデータで更新するコードを追加してください。

**参考コード:**

```javascript
    // ... actionHandlers.confirmAndPay の内部 ...
    google.script.run
      .withSuccessHandler((r) => {
        if (r.success) {
          hideModal(); // モーダルを閉じる
          hideLoading();
          // [変更] setStateに slots: r.updatedSlots を追加
          setState({
            view: 'complete',
            completionMessage: '会計情報を記録しました。',
            myBookings: r.newBookingsCache,
            history: r.newHistory,
            historyTotal: r.newHistoryTotal,
            slots: r.updatedSlots, // <--- これを追加
            accountingReservation: appState.accountingReservation,
          });
        } else {
          hideLoading();
          showInfo(r.message || '会計情報の記録に失敗しました。');
        }
      })
      .withFailureHandler(handleServerError)
      .saveAccountingDetails(payload);
  };
```

### **ステップ3: フロントエンド（ビュー）の改修**

最後に、会計完了画面（`getCompleteView`）を、指示された新しいレイアウトで表示するように修正します。

**ファイル:** `src/13_WebApp_Views.html`

**指示:**
`getCompleteView` 関数を、以下のコードで**完全に置き換えてください**。このコードは、最新の空き枠情報を元に、次回の予約用カードリストを生成し、指定されたレイアウトで表示します。

**置き換えるコード:**

```javascript
  /**
   * 完了画面のUIを生成します。
   * @param {string} msg - 表示するメッセージ
   * @returns {string} HTML文字列
   */
  const getCompleteView = (msg) => {
    // 会計処理を行った教室の情報を取得
    const classroom = appState.accountingReservation?.classroom;
    let nextBookingHtml = '';

    // 該当教室の未来の予約枠が存在する場合
    if (classroom && appState.slots) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 該当教室の、未来かつ空きがある予約枠のみをフィルタリング
      const relevantSlots = appState.slots.filter(s => {
        const slotDate = new Date(s.date);
        slotDate.setMinutes(slotDate.getMinutes() + slotDate.getTimezoneOffset());
        return s.classroom === classroom && slotDate >= today && !s.isFull;
      });

      if (relevantSlots.length > 0) {
        // getBookingViewと同様のロジックで予約カードのHTMLを生成
        const slotsByMonth = relevantSlots.reduce((acc, slot) => {
          const month = new Date(slot.date).getMonth() + 1;
          if (!acc[month]) acc[month] = [];
          acc[month].push(slot);
          return acc;
        }, {});

        nextBookingHtml = `
          <div class="mt-10 pt-6 border-t border-gray-200">
              <h3 class="text-xl font-bold text-brand-text text-center mb-4">次回の予約</h3>
              <div class="${DesignConfig.cards.container}">
              ${Object.keys(slotsByMonth).sort((a,b) => a-b).map(month => {
                const monthHeader = `<h4 class="text-lg font-medium ${DesignConfig.colors.textSubtle} mt-4 mb-2 text-center">${month}月</h4>`;
                const slotsHtml = slotsByMonth[month].map(sl => {
                    let statusText = `空席 ${sl.availableSlots}`;
                    if (typeof sl.morningSlots !== 'undefined') {
                        statusText = `午前 ${sl.morningSlots} / 午後 ${sl.afternoonSlots}`;
                    }
                    const sB = `<span class="text-sm font-bold ${DesignConfig.cards.state.available.text}">${statusText}</span>`;
                    const venueDisplay = sl.venue ? ` ${sl.venue}` : '';
                    return Components.createButton({
                        action: 'bookSlot',
                        classroom: sl.classroom,
                        date: sl.date,
                        text: `<div class="flex justify-between items-center w-full"><span class="${DesignConfig.colors.text}">${formatDate(sl.date)}${venueDisplay}</span>${sB}</div>`,
                        colorClass: `${DesignConfig.cards.base} ${DesignConfig.cards.state.available.card}`
                    });
                }).join('');
                return monthHeader + slotsHtml;
              }).join('')}
              </div>
          </div>`;
      }
    }

    return `
    <div class="text-center py-8">
        <svg class="w-16 h-16 mx-auto text-state-available-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h1 class="text-2xl font-bold ${DesignConfig.colors.text} mt-4 mb-2">ありがとうございました</h1>
        <p class="${DesignConfig.colors.textSubtle} mb-6">${msg}</p>

        <div class="max-w-xs mx-auto">
             ${Components.createButton({
               text: 'ダッシュボードへ戻る',
               action: 'goToDashboard',
               colorClass: DesignConfig.colors.secondary,
               widthClass: DesignConfig.buttons.full,
             })}
        </div>

        ${nextBookingHtml}
    </div>`;
  };
```

---

以上の手順で、会計完了画面のUXが改善されます。
