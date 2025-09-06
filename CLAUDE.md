# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Apps Script (GAS) reservation management system "きぼりの よやく・きろく" for a wood carving classroom business. Uses Google Sheets as database with web application interface.

開発者は、木彫り教室の唯一の講師であり、経営者であり、このシステムの管理者である。

### ✅ Data Model Redesign Complete

Successfully migrated from classroom-specific distributed data structure to an integrated, normalized data model with significant performance improvements. Detailed design: **[DATA_MODEL.md](docs/DATA_MODEL.md)**

**Implementation Status**: Schedule Master・Available Slots API・Integrated Reservations Backend ✓ | Frontend Integration ✓ | System Optimization ✓ | **Data Access Layer Abstraction ✓**

### ✅ Modern Architecture Foundation

**Data Access Layer Abstraction**: Complete separation of business logic from data access through repository pattern and service layer architecture. Enables zero-risk migration to integrated reservation sheets in production environment.

### 🚀 JavaScript分離開発アーキテクチャ (2025年9月6日導入)

**HTML內JavaScript問題の根本解決**: 開発時は純粋なJavaScriptファイルで作業し、デプロイ時に自動的にHTML形式に変換するハイブリッドアーキテクチャを導入。

**詳細設計**: [JS_TO_HTML_ARCHITECTURE.md](docs/JS_TO_HTML_ARCHITECTURE.md)  
**移行手順**: [MIGRATION_TO_JS_DEV.md](docs/MIGRATION_TO_JS_DEV.md)

## Key Development Commands

### Local Development & Testing

- `npm run format` - Auto-formats all code using Prettier
- `npm run lint` / `npm run lint:fix` - ESLint static analysis and auto-fixing
- `npm run check` - Runs both format check and lint together

### JavaScript分離開発ワークフロー (新規導入)

- `npm run dev:build` - JavaScript → HTML自動変換ビルド
- `npm run dev:watch` - ファイル監視モード（開発中リアルタイム変換）
- `npm run dev:test` - ビルド → テスト環境プッシュ
- `npm run dev:prod` - ビルド → 本番環境プッシュ
- `npm run dev:open:test` - ビルド → テスト → ブラウザ起動
- `npm run dev:open:prod` - ビルド → 本番 → ブラウザ起動

### Environment Management & Deployment

- `npm run switch:env -- prod|test` - Switches between production and test environments
- `npm run push:prod` / `npm run push:test` - Pushes code to respective GAS environments
- `npm run deploy:prod` / `npm run deploy:test` - Deploys web app to respective environments
- `npm run open:dev:prod` / `npm run open:dev:test` - Opens development URL after pushing latest code

### Testing

- **GAS Test Environment**: Use `npm run push:test` to push code changes to test environment with head deployment ID for immediate testing
- **Web App Testing**: Test environment WebApp reflects changes immediately after `npm run push:test`
- ~~Local HTML testing (currently not functional)~~

## Architecture Overview

### File Organization

The project uses a numbered file naming convention in `src/`:

**Core System Files:**

- `00_Constants.js` - Global constants and configuration definitions
- `00_SpreadsheetManager.js` - Spreadsheet object caching and management for performance optimization
- `01_Code.js` - Entry point with global constants, UI definitions, and trigger functions
- `02-1_BusinessLogic_Batch.js` - Batch processing and data import functions
- `02-4_BusinessLogic_ScheduleMaster.js` - Schedule master management
- `02-5_BusinessLogic_ReservationService.js` - **NEW**: Pure business logic service layer
- `03_DataAccess.js` - **NEW**: Data access layer abstraction (Repository pattern)
- `04_Backend_User.js` - User authentication and management
- `05-2_Backend_Write.js` - Data writing API endpoints
- `05-3_Backend_AvailableSlots.js` - Available slots calculation API
- `06_ExternalServices.js` - External service integration placeholders
- `07_CacheManager.js` - Cache management for performance
- `08_ErrorHandler.js` - Centralized error handling and logging
- `08_Utilities.js` - Common utility functions
- `09_Backend_Endpoints.js` - Unified API endpoints

**Web Application Files:**

- `10_WebApp.html` - Main HTML template
- `11_WebApp_Config.html` - Frontend configuration and design constants
- `12_WebApp_Core.html` - Core frontend utilities and component generation
- `12_WebApp_StateManager.html` - Centralized state management with automatic UI updates
- `13_WebApp_Components.html` - Reusable UI components (Atomic → Molecular → Organisms)
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

- `tools/switch-env.js` - Manages environment switching via `.clasp.json` updates
- ~~`tools/build-unified.js` - Local test HTML generation (currently not functional)~~
- ~~`tools/frontend-test.js` - Frontend testing framework (currently not functional)~~

**Config Files**: `.clasp.json`, `.clasp.config.json`, `jsconfig.json`, `.prettierrc.json`

**Testing Strategy**: Direct GAS environment testing via head deployment ID, no local HTML generation required

## Development Guidelines

### Workflow

1. **Development**: Edit `src/` files directly
2. **Quality**: Run `npm run check` before committing
3. **Testing**: `npm run push:test` to push changes to test environment
4. **Production**: `npm run push:prod` only after thorough testing in test environment

### Code Standards

- Always edit source files in `src/` directory
- Use `SS_MANAGER` global instance for all spreadsheet operations
- Follow numbered file naming convention for new files
- Maintain integration with multi-layer caching system
- **New Development**: Use data access abstraction layer (`repositories.*`) and service layer (`*Service`) for business logic

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

### Markdown Quality Guidelines

- **Heading Usage**: Use proper heading levels (## heading) instead of emphasis (**bold**) for section titles
- **Duplicate Headings**: Avoid duplicate heading content (e.g., multiple "## まとめ" sections)

### Development Environment

- **VSCode Configuration**: The project includes comprehensive VSCode settings optimized for GAS development
- **Recommended Extensions**: Use `.vscode/extensions.json` recommendations for best development experience
- **Task Integration**: Use `Cmd+Shift+P` → "Tasks: Run Task" for common operations (format, lint, build, deploy)
- **Live Server**: HTML files can be opened with Live Server for immediate testing (port 5500)
- **Auto-formatting**: Code is automatically formatted on save using Prettier

### Claude Code Development Guidelines

- **Development Workflow**:
  - **Quality First**: Always run `npm run check` before committing changes
  - **For Testing**: Use `npm run push:test` to push code to test environment with head deployment ID
  - **For Production**: Use `npm run push:prod` only after thorough testing in test environment
  - **Testing Strategy**: Direct GAS environment testing - no local HTML build required
  - Test environment WebApp reflects changes immediately after `npm run push:test`
- **After Code Changes**: Always run `npm run push:test` when testing is needed and prompt user to test
- **Data Access Pattern**: Use new abstraction layers (`repositories.*`, `*Service`) for new features
- **Commit Management**:
  - **Proactive Commits**: Commit at appropriate milestones (feature completion, bug fixes, architectural changes, etc.)
  - **User Confirmation**: Always ask user for confirmation before committing: "適切な節目でコミットしますか？" or similar
  - **Commit Quality**: Write comprehensive Japanese commit messages with clear descriptions of changes and impact
- **Frontend Architecture**: Implements unidirectional data flow with StateManager for automatic UI updates and separation of concerns
- **VSCode Integration**: Utilize tasks (Cmd+Shift+P → Tasks) for efficient development workflow
- **Code Quality**: Use ESLint and Prettier configurations consistently throughout development
- **Markdown Standards**: Follow markdownlint rules and proper heading hierarchy in all documentation
- **Code Block Language**: Always specify language for code blocks (javascript, text, json, bash, html, etc.)
- **Table Formatting**: Ensure column byte width alignment when creating tables containing mixed character sets (Japanese/English). Multi-byte characters (CJK) should be counted as double-width for proper visual alignment.

### Code Quality Standards

- Follow the established numbered file naming convention in `src/`
- Maintain consistency with existing code style and patterns
- Ensure all changes integrate properly with the multi-layer caching system
- Validate that modifications don't break the spreadsheet-based data model
