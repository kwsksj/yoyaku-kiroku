# 作業計画書: 完了画面レイアウトの再改修とUI視認性向上

## 1. 目的 (Objective)

前回の改修で実装した会計完了画面のレイアウトを、ユーザーからのフィードバックに基づき、さらに洗練されたものに更新する。また、予約一覧画面の主要な操作ボタンの文字サイズを大きくし、視認性と操作性を向上させる。

## 2. 変更対象ファイル (Files to Modify)

- `src/13_WebApp_Views.html`

---

## 3. 詳細な作業手順 (Step-by-Step Instructions)

### **ステップ1: 完了画面レイアウトの最終調整**

`getCompleteView` 関数を、指示された新しいレイアウト（完了メッセージ → 次回予約セクション → ダッシュボードボタン）に修正します。

**ファイル:** `src/13_WebApp_Views.html`

**指示:**
`getCompleteView` 関数を、以下のコードで**完全に置き換えてください**。

**置き換えるコード:**

```javascript
  /**
   * 完了画面のUIを生成します。
   * @param {string} msg - 表示するメッセージ
   * @returns {string} HTML文字列
   */
  const getCompleteView = (msg) => {
    const classroom = appState.accountingReservation?.classroom;
    let nextBookingHtml = '';

    if (classroom && appState.slots) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const relevantSlots = appState.slots.filter(s => {
        const slotDate = new Date(s.date);
        slotDate.setMinutes(slotDate.getMinutes() + slotDate.getTimezoneOffset());
        return s.classroom === classroom && slotDate >= today && !s.isFull;
      });

      if (relevantSlots.length > 0) {
        const slotsByMonth = relevantSlots.reduce((acc, slot) => {
          const month = new Date(slot.date).getMonth() + 1;
          if (!acc[month]) acc[month] = [];
          acc[month].push(slot);
          return acc;
        }, {});

        nextBookingHtml = `
          <div class="mt-10 pt-6 border-t border-gray-200">
              <h3 class="text-xl font-bold text-brand-text text-center mb-4">次の予約</h3>
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

        ${nextBookingHtml}

        <div class="max-w-xs mx-auto mt-8">
             ${Components.createButton({
               text: 'ダッシュボードへ戻る',
               action: 'goToDashboard',
               colorClass: DesignConfig.colors.secondary,
               widthClass: DesignConfig.buttons.full,
             })}
        </div>
    </div>`;
  };
```

### **ステップ2: 主要ボタンの文字サイズ拡大**

予約一覧画面（ダッシュボード）の「会計」「取消」「編集」ボタンのクラス指定を修正し、文字サイズを大きくします。

**ファイル:** `src/13_WebApp_Views.html`

**指示:**
`getClassroomSelectView` 関数内で、`accountingBtn` と `cancelBtn`、そして「編集」ボタンを生成している `Components.createButton` の呼び出し箇所を探し、`colorClass` に指定されている `text-sm` を `text-base` に変更してください。

**変更前の例:**

```javascript
// ...
const accountingBtn = isPastOrToday
  ? b.accountingDone
    ? Components.createButton({
        //...
        colorClass: `${DesignConfig.colors.paid} text-sm font-bold px-3 py-1.5 rounded`,
      })
    : Components.createButton({
        //...
        colorClass:
          'text-sm bg-yellow-100 text-yellow-800 font-bold px-3 py-1.5 rounded',
      })
  : '';

const cancelBtn = !b.accountingDone
  ? Components.createButton({
      //...
      colorClass:
        'text-sm bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded',
    })
  : '';

//...
// 編集ボタンの箇所
${!isPastOrToday && !b.accountingDone ? Components.createButton({ action: 'goToEditReservation', classroom: b.classroom, reservationId: b.reservationId, text: '編集', colorClass: 'text-sm bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded' }) : ''}
//...
```

**変更後の例:**

```javascript
// ...
const accountingBtn = isPastOrToday
  ? b.accountingDone
    ? Components.createButton({
        //...
        colorClass: `${DesignConfig.colors.paid} text-base font-bold px-3 py-1.5 rounded`,
      })
    : Components.createButton({
        //...
        colorClass:
          'text-base bg-yellow-100 text-yellow-800 font-bold px-3 py-1.5 rounded',
      })
  : '';

const cancelBtn = !b.accountingDone
  ? Components.createButton({
      //...
      colorClass:
        'text-base bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded',
    })
  : '';
//...
// 編集ボタンの箇所
${!isPastOrToday && !b.accountingDone ? Components.createButton({ action: 'goToEditReservation', classroom: b.classroom, reservationId: b.reservationId, text: '編集', colorClass: 'text-base bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded' }) : ''}
//...
```
