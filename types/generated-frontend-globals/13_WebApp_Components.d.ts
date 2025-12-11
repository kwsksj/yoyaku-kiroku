export function escapeHTML(str: string | number | boolean): string;
export namespace Components {
    function modal(config: ModalConfig): string;
    function showModal(modalId: string): void;
    function closeModal(modalId: string): void;
    function closeModalOnBackdrop(event: Event, modalId: string): void;
    function handleModalContentClick(event: Event): void;
    function button({ action, text, style, size, disabled, customClass, dataAttributes, id, disabledStyle, }: ButtonConfig): string;
    function input({ id, label, type, value, placeholder, required, description, caption, }: InputConfig): string;
    function select({ id, label, options, selectedValue, description, caption, }: SelectConfig): string;
    function textarea({ id, label, value, placeholder, rows, description, caption, }: TextareaConfig): string;
    function checkbox({ id, label, checked, disabled, dynamicStyle, dataAttributes, description, caption, onChange, customLabelClass, required, size, }: CheckboxConfig): string;
    function toggleSwitch({ id, label, checked, onchange, statusText, helpAction, helpText, className, }: {
        id: string;
        label: string;
        checked?: boolean;
        onchange?: string;
        statusText?: string;
        helpAction?: string;
        helpText?: string;
        className?: string;
    }): string;
    function buttonGroup({ buttons, selectedValue, className }: {
        buttons: Array<{
            value: string;
            label: string;
            onclick: string;
        }>;
        selectedValue: string;
        className?: string;
    }): string;
    function radioGroup({ name, label, options, selectedValue, layout, description, caption, }: {
        name: string;
        label: string;
        options: Array<{
            value: string;
            label: string;
        }>;
        selectedValue?: string;
        layout?: string;
        description?: string;
        caption?: string;
    }): string;
    function pageContainer({ content, maxWidth }: PageContainerConfig): string;
    function cardContainer({ content, variant, padding, touchFriendly, customClass, dataAttributes, }: CardContainerConfig): string;
    function statusBadge({ type, text }: StatusBadgeConfig): string;
    function table({ columns, rows, striped, bordered, hoverable, compact, responsive, emptyMessage, minWidth, }: TableConfig): string;
    function priceDisplay({ amount, label, size, style, showCurrency, align, }: PriceDisplayConfig): string;
    function actionButtonSection({ primaryButton, secondaryButton, dangerButton, layout, spacing, }: ActionButtonSectionConfig): string;
    function pageHeader({ title, backAction, showBackButton, actionButton, }: {
        title: string;
        backAction?: string;
        showBackButton?: boolean;
        actionButton?: {
            text: string;
            action: string;
            style?: string;
            size?: string;
        } | null;
    }): string;
    function accountingRow({ name, itemType, price, checked, disabled, }: AccountingRowConfig): string;
    function materialRow({ index, values }: MaterialRowConfig): string;
    function otherSalesRow({ index, values }: OtherSalesRowConfig): string;
    function unifiedTuitionSection({ type, master, reservation, reservationDetails, scheduleInfo, }: {
        type: string;
        master: AccountingMasterItemCore[];
        reservation: ReservationCore;
        reservationDetails: ReservationCore;
        scheduleInfo: ScheduleInfo;
    }): string;
    function sectionHeader({ title, symbol, asSummary }: {
        title: string;
        symbol?: string;
        asSummary?: boolean;
    }): string;
    function subtotalSection({ title, amount, id }: {
        title: string;
        amount: number;
        id?: string;
    }): string;
    function timeOptions({ startTime, endTime, interval, selectedValue, }: {
        startTime?: string;
        endTime?: string;
        interval?: number;
        selectedValue?: string;
    }): string;
    function dashboardSection({ title, items, showNewButton, newAction, showMoreButton, moreAction, }: DashboardSectionConfig): string;
    function newReservationCard({ action }: ComponentConfig & {
        action: string;
    }): string;
    function listCard({ item, badges, editButtons, accountingButtons, type, isEditMode, showMemoSaveButton, }: ListCardConfig): string;
    function memoSection({ reservationId, workInProgress, isEditMode, showSaveButton, }: MemoSectionConfig): string;
    function salesSection({ master, reservationDetails }: {
        master: AccountingMasterItemCore[];
        reservationDetails: ReservationCore;
    }): string;
    function createBackButton(action?: string, text?: string): string;
    function createSmartBackButton(currentView: string, _appState?: UIState | null): string;
    function badge({ text, color, size, border }: {
        /**
         * - バッジテキスト
         */
        text: string;
        /**
         * - 色
         */
        color?: "gray" | "blue" | "green" | "red" | "orange" | "purple" | "yellow";
        /**
         * - サイズ
         */
        size?: "xs" | "sm" | "md";
        /**
         * - 枠線を表示するか
         */
        border?: boolean;
    }): string;
    function tabGroup({ tabs }: {
        tabs: Array<{
            label: string;
            count: number;
            isActive: boolean;
            onclick: string;
        }>;
    }): string;
    function filterChips({ options, selectedValue, onClickHandler }: {
        options: Array<{
            value: string;
            label: string;
        }>;
        selectedValue: string;
        onClickHandler: string;
    }): string;
    function emptyState({ message, icon, actionButton }: {
        message: string;
        icon?: string;
        actionButton?: {
            text: string;
            onClick: string;
            style?: string;
        };
    }): string;
    function accordionItem({ id, headerContent, bodyContent, toggleHandler, borderColor, bgColor, isExpanded, }: {
        id: string;
        headerContent: string;
        bodyContent: string;
        toggleHandler: string;
        borderColor?: string;
        bgColor?: string;
        isExpanded?: boolean;
    }): string;
    function stickyTableHeader({ headerId, columns, gridTemplate }: {
        headerId: string;
        columns: Array<{
            label: string;
            width?: string;
            align?: string;
        }>;
        gridTemplate: string;
    }): string;
    function gridRow({ columns, gridTemplate, rowClassName, onClick, rowHeight, }: {
        columns: Array<{
            content: string;
            width?: string;
            align?: string;
            className?: string;
        }>;
        gridTemplate: string;
        rowClassName?: string;
        onClick?: string;
        rowHeight?: string;
    }): string;
    function detailRow({ label, value, className }: {
        label: string;
        value: string;
        className?: string;
    }): string;
    function historyItem({ date, title, subtitle, content }: {
        date: string;
        title: string;
        subtitle?: string;
        content?: string;
    }): string;
}
