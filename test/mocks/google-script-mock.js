/**
 * Google Apps Script API Mock
 * Emulates google.script.run and google.script.host for local development
 */

import { mockBackendHandlers } from './backend-handlers.js';

/**
 * Creates a chainable mock for google.script.run API
 */
class GoogleScriptRunMock {
  constructor() {
    this.successHandler = null;
    this.failureHandler = null;
  }

  /**
   * Set success callback handler
   * @param {Function} callback
   * @returns {GoogleScriptRunMock}
   */
  withSuccessHandler(callback) {
    this.successHandler = callback;
    return this;
  }

  /**
   * Set failure callback handler
   * @param {Function} callback
   * @returns {GoogleScriptRunMock}
   */
  withFailureHandler(callback) {
    this.failureHandler = callback;
    return this;
  }

  /**
   * Execute a backend function call
   * @param {string} functionName
   * @param {...any} args
   */
  async executeFunction(functionName, ...args) {
    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if handler exists
      if (!mockBackendHandlers[functionName]) {
        throw new Error(`Backend function '${functionName}' not found`);
      }

      // Execute the mock handler
      const result = await mockBackendHandlers[functionName](...args);

      // Call success handler
      if (this.successHandler) {
        this.successHandler(result);
      }

      return result;
    } catch (error) {
      // Call failure handler
      if (this.failureHandler) {
        this.failureHandler(error);
        // Don't rethrow if there's a failure handler
        return;
      } else {
        console.error('Unhandled error in google.script.run:', error);
        throw error;
      }
    }
  }
}

/**
 * Create a Proxy that intercepts method calls and routes them to the mock
 */
function createGoogleScriptRunProxy(existingInstance = null) {
  const instance = existingInstance || new GoogleScriptRunMock();

  return new Proxy(instance, {
    get(target, prop) {
      // If it's a known method, return a function that creates a new proxy with updated state
      if (prop === 'withSuccessHandler') {
        return (callback) => {
          target.successHandler = callback;
          return createGoogleScriptRunProxy(target);
        };
      }

      if (prop === 'withFailureHandler') {
        return (callback) => {
          target.failureHandler = callback;
          return createGoogleScriptRunProxy(target);
        };
      }

      // Otherwise, treat it as a backend function call
      return (...args) => {
        return target.executeFunction(prop, ...args);
      };
    },
  });
}

/**
 * Mock for google.script.host
 */
const googleScriptHostMock = {
  close: () => {
    console.log('[Mock] google.script.host.close() called');
  },
  setHeight: (height) => {
    console.log(`[Mock] google.script.host.setHeight(${height}) called`);
  },
  setWidth: (width) => {
    console.log(`[Mock] google.script.host.setWidth(${width}) called`);
  },
  editor: {
    focus: () => {
      console.log('[Mock] google.script.host.editor.focus() called');
    },
  },
};

/**
 * Initialize google.script mock in global scope
 */
export function setupGoogleScriptMock() {
  if (typeof window !== 'undefined') {
    window.google = window.google || {};
    window.google.script = {
      run: createGoogleScriptRunProxy(),
      host: googleScriptHostMock,
    };
  }

  if (typeof global !== 'undefined') {
    global.google = global.google || {};
    global.google.script = {
      run: createGoogleScriptRunProxy(),
      host: googleScriptHostMock,
    };
  }
}

/**
 * Create a new instance for testing
 */
export function createMockGoogleScript() {
  return {
    run: createGoogleScriptRunProxy(),
    host: googleScriptHostMock,
  };
}
