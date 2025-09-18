// @ts-check
/// <reference path="../../types/dev-environment.d.ts" />
/// <reference path="../../types/html-environment.d.ts" />
/// <reference path="../../types/api-types.d.ts" />

/**
 * =================================================================
 * 【ファイル名】: 14_WebApp_Handlers_Accounting.js
 * 【バージョン】: 1.0
 * 【役割】: WebAppのフロントエンドにおける、会計処理関連の
 * アクションハンドラーを集約します。
 * 【構成】: 14ファイル構成から分割された会計管理ファイル
 * 【機能範囲】:
 * - 会計画面遷移・表示制御
 * - 会計詳細表示・編集
 * - 会計確認・支払い処理
 * - 会計UI操作（項目追加・コピー等）
 * =================================================================
 */

// =================================================================
// --- Accounting Management Action Handlers ---
// -----------------------------------------------------------------
// 会計処理関連のアクションハンドラー群
// =================================================================

/** 会計管理関連のアクションハンドラー群 */
const accountingActionHandlers = {
  /** 会計画面に遷移します（予約データはキャッシュから取得済み）
   * @param {ActionHandlerData} d */
  goToAccounting: d => {
    showLoading('accounting');
    const reservationId = d.reservationId;

    // 【修正】統一検索関数を使用してよやく・きろく両方から検索
    const reservationResult = findReservationById(reservationId);
    /** @type {ReservationData | null} */
    const reservationData = reservationResult
      ? {
          ...reservationResult,
          date:
            typeof reservationResult.date === 'object' &&
            reservationResult.date instanceof Date
              ? reservationResult.date.toISOString().split('T')[0]
              : String(reservationResult.date),
        }
      : null;

    if (reservationData) {
      // 予約が有効な場合のみキャッシュを読み込み
      const cachedData = loadAccountingCache(reservationId);
      const baseDetails = {
        firstLecture: reservationData.firstLecture || false,
        chiselRental: reservationData.chiselRental || false,
        [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']:
          reservationData[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
          reservationData.startTime ||
          null,
        [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']:
          reservationData[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] ||
          reservationData.endTime ||
          null,
      };

      // 予約固有情報（個人の予約詳細）
      const reservationDetails = { ...baseDetails, ...cachedData };

      // 講座固有情報を取得完了後に画面を表示
      getScheduleInfoFromCache(
        typeof reservationData.date === 'object' &&
          reservationData.date instanceof Date
          ? reservationData.date.toISOString().split('T')[0]
          : String(reservationData.date),
        reservationData.classroom,
      ).then(scheduleInfo => {
        // スケジュール情報取得完了後にビューを表示
        window.stateManager.dispatch({
          type: 'SET_STATE',
          payload: {
            view: /** @type {ViewType} */ ('accounting'),
            accountingReservation: d,
            accountingReservationDetails: reservationDetails,
            accountingScheduleInfo: scheduleInfo,
          },
        });

        // ビュー遷移後に初期計算を実行（DOM構築完了を確実に待つ）
        setTimeout(() => {
          // 会計フォームのDOM構築完了を確認してから計算実行
          const form = document.getElementById('accounting-form');
          if (form) {
            calculateAccountingDetails(); // UI更新も含む統一関数を使用
          } else {
            // DOMがまだ構築されていない場合はもう少し待つ
            setTimeout(() => {
              calculateAccountingDetails(); // UI更新も含む統一関数を使用
            }, 100);
          }
        }, 300);
        hideLoading();
      });
    } else {
      hideLoading();
      showInfo('予約・記録情報が見つかりませんでした。');
    }
  },

  /** 履歴から会計詳細をモーダルで表示します（データはキャッシュから取得済み）
   * @param {ActionHandlerData} d */
  showHistoryAccounting: d => {
    const reservationId = d.reservationId;

    if (!reservationId) {
      showInfo('予約IDが見つかりません');
      return;
    }

    showLoading('booking');

    // バックエンドから会計詳細を取得
    google.script.run['withSuccessHandler'](
      (/** @type {ServerResponse<AccountingDetails>} */ response) => {
        hideLoading();

        if (!response.success || !response.data) {
          showInfo(response.message || '会計データの取得に失敗しました');
          return;
        }

        const details = response.data;

        // 授業料項目のHTML生成
        const tuitionItemsHtml = (details.tuition?.items || [])
          .map(
            (/** @type {any} */ i) =>
              `<li>${i.name}: ${i.price.toLocaleString()}円</li>`,
          )
          .join('');

        // 販売項目のHTML生成
        const salesItemsHtml = (details.sales?.items || [])
          .map(
            (/** @type {any} */ i) =>
              `<li>${i.name}: ${i.price.toLocaleString()}円</li>`,
          )
          .join('');

        const message = `
          <div class="p-4 bg-brand-light rounded-lg text-left space-y-4 text-base">
            ${tuitionItemsHtml ? `<b>授業料</b><ul class="list-disc list-inside">${tuitionItemsHtml}</ul>` : ''}
            ${salesItemsHtml ? `<b class="mt-1 inline-block">販売</b><ul class="list-disc list-inside">${salesItemsHtml}</ul>` : ''}
            <div class="font-bold mt-1 pt-1 border-t">合計: ${details.grandTotal.toLocaleString()}円</div>
            <div class="text-right text-sm pt-1">支払方法: ${details.paymentMethod}</div>
          </div>`;

        showInfo(message, '会計記録');
      },
    )
      ['withFailureHandler']((/** @type {Error} */ error) => {
        hideLoading();
        console.error('会計詳細取得エラー:', error);
        if (window.FrontendErrorHandler) {
          window.FrontendErrorHandler.handle(error, 'showHistoryAccounting', {
            reservationId,
          });
        }
        showInfo('会計データの取得中にエラーが発生しました');
      })
      .getAccountingDetailsFromSheet(reservationId);
  },

  /** きろくカードから会計済み内容を修正します
   * @param {ActionHandlerData} d */
  editAccountingRecord: d => {
    const reservationId = d.reservationId;

    // きろくから対象の予約データを取得
    const reservationResult = findReservationById(reservationId);
    /** @type {ReservationData | null} */
    const reservationData = reservationResult
      ? {
          ...reservationResult,
          date:
            typeof reservationResult.date === 'object' &&
            reservationResult.date instanceof Date
              ? reservationResult.date.toISOString().split('T')[0]
              : String(reservationResult.date),
        }
      : null;

    if (!reservationData) {
      showInfo('予約・記録情報が見つかりませんでした。');
      return;
    }

    // 既存の会計データを初期値として設定
    const existingAccountingDetails = reservationData.accountingDetails || {};

    // 予約固有情報（個人の予約詳細）
    const reservationDetails = {
      firstLecture: reservationData.firstLecture || false,
      chiselRental: reservationData.chiselRental || false,
      [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']:
        reservationData[CONSTANTS.HEADERS.RESERVATIONS?.START_TIME] ||
        reservationData.startTime ||
        null,
      [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']:
        reservationData[CONSTANTS.HEADERS.RESERVATIONS?.END_TIME] ||
        reservationData.endTime ||
        null,
      // 既存の会計データをすべて反映
      ...existingAccountingDetails,
    };

    showConfirm({
      title: '会計内容の修正',
      message:
        'この操作により、現在の会計記録は削除され、新しい内容で再登録されます。よろしいですか？',
      onConfirm: () => {
        // 講座固有情報を取得完了後に画面を表示
        getScheduleInfoFromCache(
          typeof reservationData.date === 'object' &&
            reservationData.date instanceof Date
            ? reservationData.date.toISOString().split('T')[0]
            : String(reservationData.date),
          reservationData.classroom,
        ).then(scheduleInfo => {
          // スケジュール情報取得完了後にビューを表示
          window.stateManager.dispatch({
            type: 'SET_STATE',
            payload: {
              view: /** @type {ViewType} */ ('accounting'),
              accountingReservation: d,
              accountingReservationDetails: reservationDetails,
              accountingScheduleInfo: scheduleInfo,
              isEditingAccountingRecord: true,
            },
          });

          // ビュー遷移後に初期計算を実行（DOM構築完了を確実に待つ）
          setTimeout(() => {
            // 会計フォームのDOM構築完了を確認してから計算実行
            const form = document.getElementById('accounting-form');
            if (form) {
              calculateAccountingDetails(); // UI更新も含む統一関数を使用
            } else {
              // DOMがまだ構築されていない場合はもう少し待つ
              setTimeout(() => {
                calculateAccountingDetails(); // UI更新も含む統一関数を使用
              }, 100);
            }
          }, 300);
        });
      },
    });
  },

  /** 会計画面で材料入力行を追加します */
  addMaterialRow: () => {
    const container = document.getElementById('materials-container');
    const newIndex = container.querySelectorAll(
      'div[data-material-row-index]',
    ).length;
    const newRow = document.createElement('div');
    newRow.className = 'mt-4 pt-4 border-t border-ui-border-light';
    newRow.dataset['materialRowIndex'] = String(newIndex);
    newRow.innerHTML = Components.materialRow({ index: newIndex });
    container.appendChild(newRow);
  },

  /** 会計画面でその他販売品入力行を追加します */
  addOtherSalesRow: () => {
    const container = document.getElementById('other-sales-container');
    const newIndex = container.querySelectorAll(
      'div[data-other-sales-row]',
    ).length;
    // Components.otherSalesRowが返すHTML文字列を、ラッパーを介さず直接コンテナの末尾に追加する
    container.insertAdjacentHTML(
      'beforeend',
      Components.otherSalesRow({ index: newIndex }),
    );
  },

  /** 会計画面で合計金額をクリップボードにコピーします
   * @param {ActionHandlerData} d */
  copyGrandTotal: d => {
    const totalText =
      document.getElementById('grand-total-amount')?.textContent || '';
    const numericTotal = totalText.replace(/[^0-9-]/g, '');
    accountingActionHandlers.copyToClipboard({ ...d, copyText: numericTotal });
  },

  /** 指定されたテキストをクリップボードにコピーします
   * @param {ActionHandlerData} d */
  copyToClipboard: d => {
    const button = d.targetElement;
    const text = d.copyText;
    const textToCopy = text || (button && button.dataset['copyText']) || '';
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.value = textToCopy.replace(/,/g, '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful && button) {
        const originalText = button.textContent;
        button.textContent = 'コピーしました!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      } else {
        showInfo('コピーに失敗しました。');
      }
    } catch (/** @type {any} */ err) {
      showInfo('コピーに失敗しました。');
      // エラーログは開発環境でのみ出力
      if (typeof console !== 'undefined' && console.error) {
        console.error('Clipboard copy failed:', err);
      }
    }
    document.body.removeChild(textArea);
  },

  /** 会計の確認モーダルを表示 */
  showAccountingConfirmation: () => {
    const accountingDetails = calculateAccountingDetails();
    if (
      !accountingDetails ||
      /** @type {any} */ (accountingDetails).grandTotal <= 0
    ) {
      showInfo('合計金額が0円です。項目を選択してください。');
      return;
    }

    const message = `
        <div class="p-4 bg-brand-light rounded-lg text-left space-y-4 text-base" id="modal-accounting-form">
            <div>
                <span class="font-bold">合計金額:</span> ${/** @type {any} */ (accountingDetails).grandTotal.toLocaleString()}円
                <button data-action="copyGrandTotal" class="ml-2 text-sm bg-action-secondary-bg active:bg-action-secondary-hover text-action-secondary-text font-bold px-2 py-1 rounded">コピー</button>
            </div>
            <div>
                <span class="font-bold">支払い方法:</span>
                <div class="mt-2 space-y-3">
                    ${getPaymentOptionsHtml(undefined)}
                </div>
            </div>
            <div class="mt-4">
                <button id="confirm-payment-button" data-action="confirmAndPay" class="w-full bg-action-primary-bg text-action-primary-text font-bold py-2 rounded disabled:bg-brand-muted" disabled>この内容で支払いました</button>
            </div>
            <p class="text-red-700 font-bold mt-2 text-center">必ずボタンを押してね</p>
        </div>
    `;
    if (window.showModal) {
      window.showModal({
        title: 'お会計',
        message: message,
        onConfirm: () => {},
      });
    }
  },

  /** 「この内容で支払いました」ボタン押下時の処理 */
  confirmAndPay: () => {
    const reservationId =
      stateManager.getState().accountingReservation.reservationId;
    // モーダル内の支払い方法を取得
    const modalForm = document.getElementById('modal-accounting-form');
    let paymentMethod = CONSTANTS.PAYMENT_DISPLAY.CASH;
    if (modalForm) {
      const selected = modalForm.querySelector(
        'input[name="payment-method"]:checked',
      );
      if (selected) paymentMethod = /** @type {any} */ (selected).value;
    }

    // --- バックエンドに送信する「ユーザー入力」オブジェクトを構築 ---
    const form = document.getElementById('accounting-form');
    /** @type {any} */
    const userInput = {
      paymentMethod: paymentMethod,
      tuitionItems: /** @type {any[]} */ ([]),
      salesItems: /** @type {any[]} */ ([]),
      timeBased: /** @type {any} */ (null),
    };

    // 授業料項目（チェックボックス）
    form
      .querySelectorAll(
        `input[type="checkbox"][data-item-type="${CONSTANTS.ITEM_TYPES.TUITION}"]:checked`,
      )
      .forEach(
        /** @param {any} cb */ cb => {
          userInput.tuitionItems.push(
            /** @type {any} */ (cb).dataset['itemName'],
          );
        },
      );

    // 時間制授業料
    if (document.getElementById('start-time')) {
      const accountingReservation = stateManager.getState().accountingReservation;
      const safeAccountingReservation = accountingReservation
        ? convertToReservationData(accountingReservation)
        : null;
      const startTime = getTimeValue(
        'start-time',
        safeAccountingReservation,
        'startTime',
      );
      const endTime = getTimeValue(
        'end-time',
        safeAccountingReservation,
        'endTime',
      );

      userInput.timeBased = {
        startTime: startTime,
        endTime: endTime,
        // バックエンドとの互換性のため、ヘッダー形式も併記
        [CONSTANTS.HEADERS.RESERVATIONS?.START_TIME || 'startTime']: startTime,
        [CONSTANTS.HEADERS.RESERVATIONS?.END_TIME || 'endTime']: endTime,
        breakMinutes: parseInt(
          document.getElementById('break-time')?.value || '0',
          10,
        ),
        discountApplied:
          document.getElementById('discount-checkbox')?.checked || false,
      };
    }

    // 物販・材料費項目
    const materialContainer = document.getElementById('materials-container');
    if (materialContainer) {
      materialContainer
        .querySelectorAll('div[data-material-row-index]')
        .forEach((row, index) => {
          const name = document.getElementById(`material-type-${index}`)?.value;
          const priceText =
            document.getElementById(`material-price-${index}`)?.textContent ||
            '0';
          const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
          if (name && price > 0)
            userInput.salesItems.push({ name: name, price: price });
        });
    }

    // 物販項目（チェックボックス）
    form
      .querySelectorAll(
        `input[type="checkbox"][data-item-type="${CONSTANTS.ITEM_TYPES.SALES}"]:checked`,
      )
      .forEach(
        /** @param {any} cb */ cb => {
          userInput.salesItems.push({
            name: /** @type {any} */ (cb).dataset['itemName'],
          });
        },
      );

    form.querySelectorAll('div[data-other-sales-row]').forEach(
      /** @param {any} row @param {any} index */ (row, index) => {
        const name = document
          .getElementById(`other-sales-name-${index}`)
          ?.value.trim();
        const price = document.getElementById(
          `other-sales-price-${index}`,
        )?.value;
        if (name && price)
          userInput.salesItems.push({ name: name, price: Number(price) });
      },
    );
    // --- ここまで ---

    const payload = {
      reservationId: stateManager.getState().accountingReservation.reservationId,
      classroom: stateManager.getState().accountingReservation.classroom,
      studentId: stateManager.getState().currentUser.studentId,
      userInput: userInput,
    };

    showLoading('accounting');
    google.script.run['withSuccessHandler'](
      /** @param {any} r */ r => {
        if (r.success) {
          clearAccountingCache(reservationId); // <-- キャッシュ削除
          hideModal(); // モーダルを閉じる
          hideLoading();

          // 会計完了後は完了画面に遷移
          if (r.data) {
            // バックエンドから最新データが返された場合
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                ...r.data.initialData,
                myReservations: r.data.myReservations || [],
                lessons: r.data.lessons || [],
                view: 'complete',
                completionMessage: '会計情報を記録しました。',
                isDataFresh: true, // 最新データ受信済み
              },
            });
          } else {
            // 最新データが返されなかった場合でも完了画面に遷移
            const currentState = window.stateManager.getState();
            window.stateManager.dispatch({
              type: 'SET_STATE',
              payload: {
                view: 'complete',
                completionMessage: '会計情報を記録しました。',
                myReservations: currentState.myReservations || [],
                isDataFresh: false, // データ再読み込み必要
              },
            });
          }
        } else {
          hideLoading();
          showInfo(r.message || '会計情報の記録に失敗しました。');
        }
      },
    )
      .withFailureHandler(handleServerError)
      .saveAccountingDetailsAndGetLatestData(payload);
  },
};