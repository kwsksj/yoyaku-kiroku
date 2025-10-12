export namespace Components {
    /**
     * 右上固定配置のもどるボタンを生成します
     * @param {string} action - アクション名（デフォルト: 'smartGoBack'）
     * @param {string} text - ボタンテキスト（デフォルト: 'もどる'）
     * @returns {string} HTML文字列
     */
    function createBackButton(action?: string, text?: string): string;
    /**
     * 現在のビューに応じて適切なもどるボタンを生成します
     * @param {string} currentView - 現在のビュー名
     * @returns {string} HTML文字列
     */
    function createSmartBackButton(currentView: string): string;
}
