# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Apps Script (GAS) reservation management system "きぼりの よやく・きろく" for a wood carving classroom business. Uses Google Sheets as database with web application interface.

### ✅ Data Model Redesign Complete

Successfully migrated from classroom-specific distributed data structure to an integrated, normalized data model with significant performance improvements. Detailed design: **[DATA_MODEL.md](docs/DATA_MODEL.md)**

**Implementation Status**: Schedule Master・Available Slots API・Integrated Reservations Backend ✓ | Frontend Integration ✓ | System Optimization ✓

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

## Architecture Overview

### File Organization

The project uses a numbered file naming convention in `src/`:

**Core System Files:**

- `00_Constants.js` - Global constants and configuration definitions
- `00_SpreadsheetManager.js` - Spreadsheet object caching and management for performance optimization
- `01_Code.js` - Entry point with global constants, UI definitions, and trigger functions
- `02-1_BusinessLogic_Batch.js` - Batch processing and data import functions
- `02-3_BusinessLogic_SheetUtils.js` - Sheet utility functions and data manipulation
- `02-4_BusinessLogic_ScheduleMaster.js` - Schedule master management
- `04_Backend_User.js` - User authentication and management
- `05-1_Backend_Read.js` - Data reading API endpoints
- `05-2_Backend_Write.js` - Data writing API endpoints
- `05-3_Backend_AvailableSlots.js` - Available slots calculation API
- `06_ExternalServices.js` - Google Forms/Calendar integration
- `07_CacheManager.js` - Cache management for performance
- `08_ErrorHandler.js` - Centralized error handling and logging
- `08_Utilities.js` - Common utility functions
- `09_Backend_Endpoints.js` - Unified API endpoints

**Web Application Files:**

- `10_WebApp.html` - Main HTML template
- `11_WebApp_Config.html` - Frontend configuration and design constants
- `12_WebApp_Core.html` - Core frontend utilities and component generation
- `12_WebApp_StateManager.html` - Centralized state management with automatic UI updates
- `13_WebApp_Views.html` - UI view generation functions (pure presentation layer)
- `14_WebApp_Handlers.html` - Event handlers and business logic coordination

### Data Model & Caching

Google Sheets-based integrated data model. Details: [DATA_MODEL.md](docs/DATA_MODEL.md)

**Core Sheets**: Schedule Master, Integrated Reservations, Student Roster, Pricing Master, Activity Log

**Multi-layer Cache**:

- **CacheService**: Schedule master, all reservations, student info, pricing (6-24 hours)
- **SpreadsheetManager**: Spreadsheet object cache (session-scoped)

### Build & Configuration

**Build Tools**:

- `tools/build-unified.js` - Merges all HTML/JS files into single test file
- `tools/switch-env.js` - Manages environment switching via `.clasp.json` updates
- `tools/frontend-test.js` - Automated frontend testing framework
- Test environment uses mock data to avoid affecting production sheets

**Config Files**: `.clasp.json`, `.clasp.config.json`, `jsconfig.json`, `.prettierrc.json`

## Development Guidelines

### Workflow

1. **Development**: Edit `src/` files → `npm run watch` for auto-rebuild
2. **Quality**: Run `npm run check` before committing
3. **Testing**: Open unified test file with Live Server
4. **Deployment**: `npm run deploy:test` → `npm run deploy:prod`

### Code Standards

- Always edit source files in `src/`, never the unified test HTML directly
- Use `SS_MANAGER` global instance for all spreadsheet operations
- Follow numbered file naming convention
- Maintain integration with multi-layer caching system

### Performance & Data

- Google Sheets = database → validate data operations carefully
- Prioritize batch processing, avoid single-cell operations in loops
- Monitor 6-minute execution limits and API quotas
- Cache strategy: version-managed updates + time-driven rebuilds + real-time polling
- Emergency procedures: `rebuildNewCaches_entryPoint()`, `trigger_rebuildAllCaches()`

Detailed architecture: `docs/ARCHITECTURE.md`

## Instructions for Claude Code

### Communication and Language

- **Primary Language**: Respond in Japanese whenever possible
- **Code Comments**: Write code comments in Japanese when adding new comments
- **User Preference**: The user prefers Japanese communication for better understanding
- **Status Display**: When Claude displays processing status with unfamiliar English words (e.g., "Clauding...", "Booping...", "Noodling..."), include Japanese translation or meaning in parentheses for clarity (e.g., "Noodling...（思案中）", "Spelunking...（探索中）") when the overhead is minimal

### Claude Code Development Guidelines

- **Testing and Deployment**:
  - **For Testing**: Use `npm run push:test` to push code to test environment
  - **For Production**: Use `npm run push:prod` only after thorough testing
  - **DO NOT use** `npm run build` for deployment - it only creates local unified test HTML
  - The test environment has a head deployment ID configured in `.clasp.json`
- **After Code Changes**: Always run `npm run push:test` when testing is needed and prompt user to test
- **Frontend Architecture**: Implements unidirectional data flow with StateManager for automatic UI updates and separation of concerns

### Code Quality Standards

- Follow the established numbered file naming convention in `src/`
- Maintain consistency with existing code style and patterns
- Ensure all changes integrate properly with the multi-layer caching system
- Validate that modifications don't break the spreadsheet-based data model
