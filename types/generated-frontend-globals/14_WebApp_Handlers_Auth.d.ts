export namespace authActionHandlers {
    function login(): void;
    function processLoginWithValidatedPhone(normalizedPhone: string): void;
    function goToStep2(): void;
    function backToStep1(): void;
    function goToStep3(): void;
    function backToStep2(): void;
    function proceedToStep4(): void;
    function backToStep3(): void;
    function submitRegistration(): void;
    function showEditProfile(): void;
    function saveProfile(): void;
    function goBackToLogin(): void;
    function logout(): void;
    function requestAccountDeletion(): void;
    function showPrivacyPolicy(): void;
    function closePrivacyPolicy(): void;
}
