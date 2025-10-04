/**
 * =================================================================
 * 【ファイル名】: types/view/index.d.ts
 * 【役割】: View層型定義の統合エクスポート
 * 【バージョン】: 1.0
 * =================================================================
 */

/// <reference path="./state.d.ts" />
/// <reference path="./window.d.ts" />
/// <reference path="./components.d.ts" />
/// <reference path="./dom.d.ts" />
/// <reference path="./handlers.d.ts" />

/**
 * View層型定義の統合エクスポート
 *
 * 使用方法:
 * /// <reference path="../../types/view/index.d.ts" />
 *
 * これにより以下の型が利用可能:
 *
 * 【状態管理】(state.d.ts)
 * - UIState
 * - StateManager (SimpleStateManager)
 * - StateAction, StateActionPayload
 * - ViewType
 *
 * 【Window拡張】(window.d.ts)
 * - Window (拡張されたグローバル変数)
 * - TempPaymentData
 * - EmbedConfig
 *
 * 【Component Props】(components.d.ts)
 * - ButtonConfig, InputConfig, SelectConfig
 * - ModalConfig, CardContainerConfig
 * - ComponentsObject (グローバル)
 *
 * 【DOM型拡張】(dom.d.ts)
 * - HTMLElementWithId
 * - TypedDocument, SafeDOMElementAccess
 * - TypedHTMLFormElement, TypedHTMLInputElement
 *
 * 【EventHandler】(handlers.d.ts)
 * - ActionHandler, ActionHandlerData
 * - EventHandler, ClickEventHandler
 * - FrontendErrorHandlerClass
 *
 * 【フォームデータ】(state.d.ts)
 * - RegistrationFormData
 * - ReservationFormContext
 *
 * 【ナビゲーション】(state.d.ts)
 * - StateNavigationHistoryEntry
 * - NavigationContext
 */
