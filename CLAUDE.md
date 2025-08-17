# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Apps Script (GAS) reservation management system "きぼりの よやく・きろく" for a wood carving classroom business. The system uses Google Sheets as the database and provides a web application interface for reservations and management.

## Key Development Commands

### Local Development & Testing

- `npm run build` - Builds unified test HTML from source files in `src/` directory
- `npm run watch` - Watches for file changes and auto-rebuilds test environment
- `npm run format` - Auto-formats all code using Prettier
- `npm run lint` / `npm run lint:fix` - ESLint static analysis and auto-fixing
- `npm run check` - Runs both format check and lint together

### Environment Management & Deployment

- `npm run switch:env -- prod|test` - Switches between production and test environments
- `npm run push:prod` / `npm run push:test` - Pushes code to respective GAS environments
- `npm run deploy:prod` / `npm run deploy:test` - Deploys web app to respective environments
- `npm run open:dev:prod` / `npm run open:dev:test` - Opens development URL after pushing latest code

### Testing

- Frontend testing: Open `test/10_WebApp_Unified_Test.html` with Live Server
- The test file includes automated UI tests that display results at the bottom of the page
- Always run `npm run build` before testing to ensure latest changes are included

## Architecture Overview

### File Organization

The project uses a numbered file naming convention in `src/`:

**Core System Files:**

- `00_SpreadsheetManager.js` - Spreadsheet object caching and management for performance optimization
- `01_Code.js` - Entry point with global constants, UI definitions, and trigger functions
- `02-*_BusinessLogic_*.js` - Core business logic (batch processing, event handlers, sheet utilities)
- `03_BusinessLogic_Summary.js` - Summary sheet management
- `04_Backend_User.js` - User authentication and management
- `05-*_Backend_*.js` - API endpoints for read/write operations
- `06_ExternalServices.js` - Google Forms/Calendar integration
- `07_CacheManager.js` - Cache management for performance
- `08_Utilities.js` - Common utility functions
- `09_Backend_Endpoints.js` - Unified API endpoints

**Web Application Files:**

- `10_WebApp.html` - Main HTML template
- `11_WebApp_Config.html` - Frontend configuration
- `12_WebApp_Core.html` - Core frontend logic and state management
- `13_WebApp_Views.html` - UI view generation functions
- `14_WebApp_Handlers.html` - Event handlers and app flow control

### Data Model

The system uses Google Sheets with these main sheets:

- **Reservation sheets** (per classroom): Main reservation data with student info, dates, attendance, accounting details
- **生徒名簿 (Student Roster)**: Comprehensive 36-column student master data including:
  - Basic info (ID, name, phone, email)
  - Participation counts per classroom
  - Profile information (age, gender, address, tools rental)
  - Wood carving experience and preferences
  - Communication notes and cache data (bookings cache, yearly participation records)
- **料金・商品マスタ (Pricing Master)**: Complete fee structures with time-based billing, materials, sales items
- **予約サマリー (Reservation Summary)**: Real-time aggregated availability data for form integration
- **アクティビティログ (Activity Log)**: Comprehensive user action tracking and system audit trail

### Build System

- `tools/build-unified.js` - Merges all HTML/JS files into single test file
- `tools/switch-env.js` - Manages environment switching via `.clasp.json` updates
- `tools/frontend-test.js` - Automated frontend testing framework
- Test environment uses mock data to avoid affecting production sheets

### Configuration Files

- `.clasp.json` - GAS deployment configuration (switched by environment)
- `.clasp.config.json` - Contains prod/test environment settings
- `jsconfig.json` - JavaScript/TypeScript IDE configuration
- `.prettierrc.json` - Code formatting rules

## Development Workflow

1. **Local Development**: Edit files in `src/`, run `npm run watch` for auto-rebuild
2. **Testing**: Open unified test file with Live Server, check automated test results
3. **Code Quality**: Run `npm run check` before committing
4. **Deployment**: Use `npm run deploy:test` for testing, `npm run deploy:prod` for production
5. **Environment Setup**: Ensure `.clasp.config.json` has correct `scriptId` and `deploymentId` values

## Important Notes

### Development Practices
- Never edit the unified test HTML directly - always edit source files in `src/`
- Run `npm run check` before committing to ensure code quality
- Use `SS_MANAGER` global instance for all spreadsheet operations to benefit from caching
- Helper functions `getActiveSpreadsheet()`, `getSheetByName()`, `getSpreadsheetTimezone()` provide backward compatibility

### Data & Performance
- The system uses Google Sheets as database - be careful with data operations and always validate input
- **Multi-layer caching is critical**: Spreadsheet object cache, student roster cache, and summary cache
- Understand cache update mechanisms and when to trigger manual cache rebuilds
- Batch operations when possible - avoid single-cell operations in loops
- Monitor performance as system scales - current limits are 6min execution time, API quotas

### System Operations
- All user actions are logged to activity log sheet for auditing and troubleshooting
- The web app supports both time-based (30min units) and session-based billing models
- Data integrity is managed through real-time triggers and batch processing
- Emergency procedures: cache rebuild (`updateRosterCache()`), summary rebuild (`rebuildSummarySheet()`)
- For detailed architecture, error handling, and performance guidelines, see `docs/ARCHITECTURE.md`
