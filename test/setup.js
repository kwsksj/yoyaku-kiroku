/**
 * Vitest setup file
 * Runs before all tests
 */

import { setupGoogleScriptMock } from './mocks/google-script-mock.js';
import { resetMockStorage } from './mocks/backend-handlers.js';
import { beforeEach } from 'vitest';

// Setup google.script mock globally
setupGoogleScriptMock();

// Reset mock storage before each test
beforeEach(() => {
  resetMockStorage();
});

// Setup global test utilities
global.testUtils = {
  /**
   * Wait for async operations
   * @param {number} ms
   */
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Simulate user input
   * @param {HTMLElement} element
   * @param {string} value
   */
  setInputValue: (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  },

  /**
   * Simulate button click
   * @param {HTMLElement} button
   */
  clickButton: (button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  },

  /**
   * Get element by test ID
   * @param {string} testId
   * @returns {HTMLElement}
   */
  getByTestId: (testId) => {
    return document.querySelector(`[data-testid="${testId}"]`);
  },

  /**
   * Get all elements by test ID
   * @param {string} testId
   * @returns {NodeList}
   */
  getAllByTestId: (testId) => {
    return document.querySelectorAll(`[data-testid="${testId}"]`);
  },
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // Keep error for debugging
  error: console.error,
};
