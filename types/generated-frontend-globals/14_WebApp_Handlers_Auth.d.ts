export namespace authActionHandlers {
    function login(): any;
    function processLoginWithValidatedPhone(normalizedPhone: string): void;
    function goToStep2(): any;
    function backToStep1(): void;
    function goToStep3(): void;
    function backToStep2(): void;
    function proceedToStep4(): void;
    function backToStep3(): void;
    function submitRegistration(): void;
    function showEditProfile(): void;
    function saveProfile(): any;
    function goBackToLogin(): void;
    function requestAccountDeletion(): void;
    function showPrivacyPolicy(): void;
    function closePrivacyPolicy(): void;
}
