/**
 * Environment detection and configuration
 * Determines whether to use mock or real Google Apps Script backend
 */

/**
 * Detect if running in development mode
 * @returns {boolean}
 */
export function isDevMode() {
  // Check for Vite development mode
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return true;
  }

  // Check for dev mode flag
  if (typeof window !== 'undefined' && window.__DEV_MODE__) {
    return true;
  }

  // Check for localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }
  }

  // Check if google.script is available (GAS environment)
  if (
    typeof google === 'undefined' ||
    typeof google.script === 'undefined' ||
    typeof google.script.run === 'undefined'
  ) {
    // Not in GAS environment, might be dev mode
    return true;
  }

  return false;
}

/**
 * Check if mocks are enabled
 * @returns {boolean}
 */
export function isMockEnabled() {
  if (typeof window !== 'undefined' && window.__MOCK_ENABLED__) {
    return true;
  }

  return isDevMode();
}

/**
 * Get environment name
 * @returns {'development' | 'production'}
 */
export function getEnvironment() {
  return isDevMode() ? 'development' : 'production';
}

/**
 * Log environment info
 */
export function logEnvironmentInfo() {
  const env = getEnvironment();
  const mockEnabled = isMockEnabled();

  console.log(`
╔════════════════════════════════════════════════╗
║ Environment: ${env.padEnd(32)} ║
║ Mock Backend: ${mockEnabled ? 'Enabled '.padEnd(31) : 'Disabled'.padEnd(31)} ║
╚════════════════════════════════════════════════╝
  `);
}

/**
 * Get google.script.run instance
 * Returns mock in dev mode, real in production
 * @returns {typeof google.script.run}
 */
export function getGoogleScriptRun() {
  if (isMockEnabled()) {
    // Return mock if available
    if (
      typeof google !== 'undefined' &&
      typeof google.script !== 'undefined' &&
      typeof google.script.run !== 'undefined'
    ) {
      return google.script.run;
    }

    // If mock not set up, warn
    console.warn(
      '[Environment] Mock mode enabled but google.script.run not found. Did you forget to call setupGoogleScriptMock()?'
    );
    return null;
  }

  // Production mode - return real google.script.run
  if (
    typeof google !== 'undefined' &&
    typeof google.script !== 'undefined' &&
    typeof google.script.run !== 'undefined'
  ) {
    return google.script.run;
  }

  console.error(
    '[Environment] google.script.run not available in production mode!'
  );
  return null;
}

/**
 * Configuration object
 */
export const ENV_CONFIG = {
  isDev: isDevMode(),
  isMock: isMockEnabled(),
  environment: getEnvironment(),

  // API settings
  api: {
    timeout: isDevMode() ? 30000 : 120000, // 30s dev, 120s prod
    retries: isDevMode() ? 1 : 3,
  },

  // Cache settings
  cache: {
    enabled: !isDevMode(), // Disable cache in dev mode
    ttl: 5 * 60 * 1000, // 5 minutes
  },

  // Debug settings
  debug: {
    enabled: isDevMode(),
    verboseLogs: isDevMode(),
  },
};

// Log on load (only in development)
if (isDevMode()) {
  logEnvironmentInfo();
}
