# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Apps Script (GAS) reservation management system "きぼりの よやく・きろく" for a wood carving classroom business. Uses Google Sheets as database with web application interface.

開発者は、木彫り教室の唯一の講師であり、経営者であり、このシステムの管理者である。

### ✅ Data Model Redesign Complete

Successfully migrated from classroom-specific distributed data structure to an integrated, normalized data model with significant performance improvements. Detailed design: **[DATA_MODEL.md](docs/DATA_MODEL.md)**

**Implementation Status**: Schedule Master・Available Slots API・Integrated Reservations Backend ✓ | Frontend Integration ✓ | System Optimization ✓

### ✅ Modern Architecture Foundation

**High-Performance Sheet Access Pattern**: Direct sheet access with comprehensive caching system (`SS_MANAGER`, `CacheService`) and unified utility functions (`getSheetData`, `getSheetDataWithSearch`). Optimized for Google Apps Script constraints with robust error handling.

### 🚀 JavaScript分離開発アーキテクチャ (2025年9月6日導入)

**HTML內JavaScript問題の根本解決**: 開発時は純粋なJavaScriptファイルで作業し、デプロイ時に自動的にHTML形式に変換するハイブリッドアーキテクチャを導入。

**詳細設計**: [JS_TO_HTML_ARCHITECTURE.md](docs/JS_TO_HTML_ARCHITECTURE.md)  
**移行手順**: [MIGRATION_TO_JS_DEV.md](docs/MIGRATION_TO_JS_DEV.md)

### ⚠️ 重要：JavaScript分離開発の絶対ルール

**🚨 NEVER EDIT `build-output/` FILES DIRECTLY 🚨**

- **開発作業は必ず `src/` ディレクトリで実施**
- **`build-output/` ディレクトリのファイルは絶対に直接編集禁止**（ビルド時に上書きされる）
- **修正後は必ず `npm run dev:build` でbuild-outputに反映**

**正しいワークフロー:**

1. `src/backend/` または `src/frontend/` でコード編集
2. `npm run dev:build` で変更を `build-output/` に反映
3. `npm run dev:test` でテスト環境に自動プッシュ＆確認
4. テストOKなら `npm run dev:prod` で本番デプロイ

**環境判定機能:**

- ビルド時に `PRODUCTION_MODE` が自動設定される（prod環境=true, test環境=false）
- テスト環境では管理者通知メールに `[テスト]` プレフィックスが追加される

## Key Development Commands

### Local Development & Testing

- `npm run format` - Auto-formats all code using Prettier
- `npm run lint` / `npm run lint:fix` - ESLint static analysis and auto-fixing
- `npm run lint:md` / `npm run lint:md:fix` - Markdown linting
- `npm run check-types` - TypeScript type checking
- `npm run check` - Runs format check, ESLint, Markdown lint, and type check together

### JavaScript分離開発ワークフロー（推奨）

- `npm run dev:build` - JavaScript → HTML統合ビルド（環境自動判定）
- `npm run dev:watch` - ファイル監視モード（開発中リアルタイム変換）
- `npm run dev:test` - ビルド → テスト環境プッシュ（`PRODUCTION_MODE=false`）
- `npm run dev:prod` - ビルド → 本番環境プッシュ（`PRODUCTION_MODE=true`）
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

The project uses a numbered file naming convention in `build-output/`:

**Core System Files:**

- `00_Constants.js` - Global constants and configuration definitions
- `00_SpreadsheetManager.js` - Spreadsheet object caching and management for performance optimization
- `01_Code.js` - Entry point with global constants, UI definitions, and trigger functions
- `02-1_BusinessLogic_Batch.js` - Batch processing and data import functions
- `02-4_BusinessLogic_ScheduleMaster.js` - Schedule master management
- `04_Backend_User.js` - User authentication and management
- `05-2_Backend_Write.js` - Data writing API endpoints
- `05-3_Backend_AvailableSlots.js` - Available slots calculation API
- `06_ExternalServices.js` - External service integration placeholders
- `07_CacheManager.js` - Cache management for performance
- `08_ErrorHandler.js` - Centralized error handling and logging
- `08_Utilities.js` - Common utility functions
- `09_Backend_Endpoints.js` - Unified API endpoints

**Web Application Files (HTML統合ビルド前のソース):**

- `11_WebApp_Config.js` - Frontend configuration and design constants
- `12_WebApp_Core.js` - Core frontend utilities and component generation
- `12_WebApp_Core_*.js` - Core utility modules (Data, Search, Accounting, ErrorHandler)
- `12_WebApp_StateManager.js` - Centralized state management with automatic UI updates
- `13_WebApp_Components.js` - Reusable UI components (Atomic → Molecular → Organisms)
- `13_WebApp_Views_*.js` - UI view generation modules (Auth, Dashboard, Booking, Utils)
- `14_WebApp_Handlers*.js` - Event handlers and business logic coordination (Auth, Reservation, History, Utils)
- `10_WebApp.html` - Main HTML template (統合ビルド時にJavaScriptを統合)

### Data Model & Caching

Google Sheets-based integrated data model. Details: [DATA_MODEL.md](docs/DATA_MODEL.md)

**Core Sheets**: Schedule Master, Integrated Reservations, Student Roster, Pricing Master, Activity Log

**Multi-layer Cache**:

- **CacheService**: Schedule master, all reservations, student info, pricing (6-24 hours)
  - **Incremental Update System (v5.0)**: Reservation cache updates use differential updates instead of full sheet reload
    - `addReservationToCache()` - Add new reservation without full reload
    - `updateReservationInCache()` - Update existing reservation in-place
    - `deleteReservationFromCache()` - Remove reservation from cache
    - Performance: 2-3 seconds → 50-200ms (95%+ improvement)
    - Auto-fallback to full rebuild on error
- **SpreadsheetManager**: Spreadsheet object cache (session-scoped)

### Build & Configuration

**Build Tools**:

- `tools/unified-build.js` - JavaScript → HTML統合ビルドシステム（開発環境判定機能付き）
- `tools/switch-env.js` - Manages environment switching via `.clasp.json` updates
- `tools/open-dev-url.js` - Opens development URL in browser

**Config Files**:

- `.clasp.json`, `.clasp.config.json` - GAS deployment configuration
- `jsconfig.json` - Root JavaScript/TypeScript configuration
- `src/jsconfig.json` - Source directory TypeScript configuration
- `.prettierrc.json` - Code formatting rules
- `eslint.config.js`, `eslint.common.js` - ESLint configuration

**Testing Strategy**: Direct GAS environment testing via head deployment ID with automatic build

## Development Guidelines

### Workflow

1. **Development**: Edit `src/backend/` or `src/frontend/` files directly
2. **Build**: Run `npm run dev:build` to compile changes to `build-output/`
3. **Quality**: Run `npm run check` before committing
4. **Testing**: `npm run dev:test` to build and push changes to test environment
5. **Production**: `npm run dev:prod` only after thorough testing in test environment

### Code Standards

- Always edit source files in `src/` directory
- Use `SS_MANAGER` global instance for all spreadsheet operations
- Follow numbered file naming convention for new files
- Maintain integration with multi-layer caching system
- **Sheet Access Pattern**: Use `SS_MANAGER` instance and cache-first data access with unified utility functions

### Performance & Data

- Google Sheets = database → validate data operations carefully
- Prioritize batch processing, avoid single-cell operations in loops
- Monitor 6-minute execution limits and API quotas
- **Cache strategy**:
  - **Incremental updates**: Reservation operations use differential cache updates (95%+ faster)
  - **Version management**: Numeric increment for efficient change detection
  - **Time-driven rebuilds**: Automatic full cache rebuild every 6 hours
  - **Real-time polling**: Frontend version checking for instant updates
  - **Unified API**: `getCachedData()` with CACHE_KEYS constants for type-safe access
- Emergency procedures: `rebuildNewCaches_entryPoint()`, `trigger_rebuildAllCaches()`

Detailed architecture: `docs/DATA_MODEL.md`

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

- **🚨 JavaScript分離開発絶対ルール**:
  - **NEVER EDIT `build-output/` FILES**: All development work must be done in `src/` directory
  - **BUILD REQUIRED**: After editing `src/` files, always run `npm run dev:build` to sync to `build-output/`
  - **Workflow**: Edit in `src/` → `npm run dev:build` → `npm run dev:test` → test
- **Development Workflow**:
  - **Quality First**: Always run `npm run check` before committing changes
  - **For Testing**: Use `npm run dev:test` (includes build + push to test environment)
  - **For Production**: Use `npm run dev:prod` (includes build + push to production)
  - **Testing Strategy**: Direct GAS environment testing - no local HTML build required
  - Test environment WebApp reflects changes immediately after `npm run dev:test`
- **After Code Changes**: Always run `npm run dev:test` when testing is needed and prompt user to test
- **Data Access Pattern**: Use `SS_MANAGER` instance and cache-first approach with unified error handling
- **Frontend UI Development**:
  - **ALWAYS use existing Components**: Check `Components` object in `13_WebApp_Components.js` before creating new UI
  - **Use DesignConfig**: Reference `DesignConfig` in `11_WebApp_Config.js` for colors, spacing, and styles
  - **Follow Atomic Design**: Build complex UI from existing atomic components
  - **Never duplicate UI code**: Reuse `Components.modal()`, `Components.button()`, `Components.cardContainer()`, etc.
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

- **🚨 DEVELOPMENT LOCATION**: Work exclusively in `src/` directory, never edit `build-output/` files directly
- Follow the established numbered file naming convention in `src/` (will be copied to `build-output/`)
- Maintain consistency with existing code style and patterns
- Ensure all changes integrate properly with the multi-layer caching system
- Validate that modifications don't break the spreadsheet-based data model
- **Always run `npm run dev:build` after making changes to sync `src/` to `build-output/`**

## Frontend Architecture

### UI Component System (Atomic Design)

**Location**: `src/frontend/13_WebApp_Components.js`

**Design Principles**:

- **3-Layer Structure**: Atomic → Molecular → Organisms
- **Single Responsibility**: One component, one clear purpose
- **Minimal Parameters**: Accept only essential data
- **Composability**: Build complex UI from small components

**Available Components** (Always use these before creating new UI):

**Atomic Components** (Basic Elements):

- `Components.button({ text, onClick, type, size, disabled })` - Styled buttons with consistent design
  - Types: `primary`, `secondary`, `danger`, `accounting`, `bookingCard`, `recordCard`
  - Sizes: `normal`, `full`, `small`, `xs`, `large`
- `Components.input({ id, label, type, value, placeholder })` - Form inputs
- `Components.select({ id, label, options })` - Dropdown selects
- `Components.textarea({ id, label, value, placeholder, rows })` - Text areas
- `Components.checkbox({ id, label, checked })` - Checkboxes

**Molecular Components** (Combined Elements):

- `Components.modal({ id, title, content, maxWidth, showCloseButton })` - Modal dialogs
  - `Components.showModal(modalId)` - Show modal with fade-in
  - `Components.closeModal(modalId)` - Close modal with fade-out
- `Components.cardContainer({ content, className, variant })` - Styled card containers
  - Variants: `default`, `highlight`, `success`, `warning`, `available`, `waitlist`, `booked`
- `Components.pageContainer({ content, maxWidth })` - Page layout wrapper

**Usage Example**:

```javascript
// ❌ BAD: Creating new button HTML from scratch
const html = `<button class="bg-blue-500 text-white px-4 py-2 rounded" onclick="doSomething()">Click</button>`;

// ✅ GOOD: Using existing Components
const html = Components.button({
  text: 'Click',
  onClick: 'doSomething()',
  type: 'primary',
  size: 'normal',
});
```

### Design System (DesignConfig)

**Location**: `src/frontend/11_WebApp_Config.js`

**Unified Design Constants** - Use these instead of hardcoded values:

**Colors** (`DesignConfig.colors`):

- `primary`: Primary brand color (blue)
- `secondary`: Secondary color (gray)
- `danger`: Error/delete actions (red)
- `accounting`: Accounting-related actions (yellow)
- `success`: Success states (green)
- `warning`: Warning states (orange)

**Buttons** (`DesignConfig.buttons`):

- `base`: Base button styles
- `primary`, `secondary`, `danger`, `accounting`: Button variants
- `bookingCard`, `recordCard`: Specialized card buttons
- `full`: Full-width button class

**Cards** (`DesignConfig.cards`):

- `base`: Base card styles
- `background`: Standard background
- `state.available`, `state.waitlist`, `state.booked`: State-specific styles

**Typography** (`DesignConfig.typography`):

- `heading`, `subheading`, `body`, `small`, `label`: Text styles

**Spacing** (`DesignConfig.spacing`):

- `section`, `card`, `cardInner`, `formGroup`: Consistent spacing

**Usage Example**:

```javascript
// ❌ BAD: Hardcoded colors and styles
const html = `<div class="bg-blue-500 text-white px-4 py-3 rounded">...</div>`;

// ✅ GOOD: Using DesignConfig
const html = `<div class="${DesignConfig.colors.primary} px-4 py-3 rounded">...</div>`;
```

### Frontend Development Guidelines

1. **Check Components First**: Before creating any UI, check if `Components` has what you need
2. **Use DesignConfig**: Never hardcode colors, spacing, or styles - use `DesignConfig` constants
3. **Compose, Don't Duplicate**: Combine existing components rather than creating new ones
4. **StateManager Integration**: Use `stateManager` for reactive UI updates
5. **Separation of Concerns**:
   - `Views`: Pure presentation functions (return HTML)
   - `Handlers`: Business logic and event handling
   - `Components`: Reusable UI building blocks
