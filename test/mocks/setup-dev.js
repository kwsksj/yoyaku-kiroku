/**
 * Development environment setup
 * Automatically sets up mocks when running in Vite dev server
 */

import { setupGoogleScriptMock } from './google-script-mock.js';

// Initialize google.script mock
setupGoogleScriptMock();

// Log to console for debugging
console.log(
  '%c[Dev Mode] Google Apps Script mock initialized',
  'color: #00aa00; font-weight: bold;'
);
console.log(
  '%cℹ All google.script.run calls will use mock backend handlers',
  'color: #0066cc;'
);

// Add a global flag to detect dev mode
window.__DEV_MODE__ = true;
window.__MOCK_ENABLED__ = true;

// Expose mock utilities for debugging
window.__mockUtils__ = {
  resetStorage: async () => {
    const { resetMockStorage } = await import('./backend-handlers.js');
    resetMockStorage();
    console.log('%c[Dev Mode] Mock storage reset', 'color: #00aa00;');
  },
  getStorage: async () => {
    const { getMockStorage } = await import('./backend-handlers.js');
    const storage = getMockStorage();
    console.log('%c[Dev Mode] Current storage:', 'color: #00aa00;', storage);
    return storage;
  },
  getMockData: async () => {
    const mockData = await import('../fixtures/mock-data.js');
    console.log('%c[Dev Mode] Mock data:', 'color: #00aa00;', mockData);
    return mockData;
  },
};

// Show dev mode banner
const banner = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Development Mode Active                             ║
║                                                           ║
║   Google Apps Script API is mocked                       ║
║   Open DevTools Console for mock utilities:              ║
║                                                           ║
║   • __mockUtils__.resetStorage()  - Reset mock data      ║
║   • __mockUtils__.getStorage()    - View current data    ║
║   • __mockUtils__.getMockData()   - View mock fixtures   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

console.log('%c' + banner, 'color: #00aa00; font-family: monospace;');
