# Oracle: Comprehensive Function Reference & Implementation Guide

This document provides a comprehensive reference of all functions, components, and implementation patterns organized by project directory structure. See `PRD.md` for product requirements, `Blueprint.md` for technical architecture, and `technical_architecture.md` for high-level overview.


### API Key Handling Improvement
**Important Change**: LLM tests now **fail clearly** when API keys are missing instead of silently skipping:

- **Before**: Tests would skip with `⏩ Skipping OpenAI test - no API key available`  
- **After**: Tests fail with clear instructions: `❌ OPENAI_API_KEY environment variable is required for OpenAI integration tests. Please set this environment variable to run the test.`

- Keys are now used exactly as entered. No automatic extraction/cleanup is performed (no multiline parsing and no `OPENAI_API_KEY=` prefix stripping). If a key is misformatted, the request will fail with a clear error so you can correct the saved key.

### 🔗 LangChain Standardization
**LangChain Foundation**: All LLM providers use standardized LangChain integration with a curated model registry and explicit modelId selection.

- **Provider selection**: UI shows provider only (OpenAI, Gemini, Perplexity, DeepSeek, Anthropic). Model is selected separately from a curated allowlist.
- **Explicit modelId**: Every prompt must include a `modelId`; no provider defaults. Validation rejects unknown IDs.
- **OpenAI**: `ChatOpenAI` from `@langchain/openai` (e.g., `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`).
- **Gemini**: `ChatGoogleGenerativeAI` from `@langchain/google-genai` (e.g., `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`).
- **Perplexity**: `ChatPerplexity` from `@langchain/community/chat_models/perplexity` (e.g., `sonar`, `sonar-pro`, `sonar-reasoning`, `sonar-reasoning-pro`).
- **DeepSeek (New)**: OpenAI-compatible via `ChatOpenAI` with `baseURL: https://api.deepseek.com` (models: `deepseek-chat` and `deepseek-reasoner`). See [DeepSeek API Docs](http://api-docs.deepseek.com/).
- **Anthropic (New)**: `ChatAnthropic` from `@langchain/anthropic` (e.g., `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`, `claude-3-opus-20240229`).

#### Curated Model Allowlist

| Provider    | Model ID               | Display name             | Reasoning-capable |
|-------------|------------------------|--------------------------|-------------------|
| OpenAI      | gpt-5                 | GPT-5                   | Yes               |
| OpenAI      | gpt-5-mini            | GPT-5-mini              | Yes               |
| OpenAI      | gpt-4o                 | GPT-4o                   | Yes               |
| OpenAI      | gpt-4o-mini            | GPT-4o-mini              | No                |
| OpenAI      | gpt-4.1                | GPT-4.1                  | Yes               |
| OpenAI      | gpt-4.1-mini           | GPT-4.1-mini             | Yes               |
| Gemini      | gemini-2.5-pro         | Gemini 2.5 Pro           | Yes               |
| Gemini      | gemini-2.5-flash       | Gemini 2.5 Flash         | Yes               |
| Gemini      | gemini-2.5-flash-lite  | Gemini 2.5 Flash-Lite    | No                |
| Gemini      | gemini-2.0-flash       | Gemini 2.0 Flash (legacy)| No                |
| Perplexity  | sonar                  | Sonar                    | No                |
| Perplexity  | sonar-pro              | Sonar Pro                | No                |
| Perplexity  | sonar-reasoning        | Sonar Reasoning          | Yes               |
| Perplexity  | sonar-reasoning-pro    | Sonar Reasoning Pro      | Yes               |
| DeepSeek    | deepseek-chat          | DeepSeek Chat (V3.1)     | No                |
| DeepSeek    | deepseek-reasoner      | DeepSeek Reasoner (V3.1) | Yes               |
| Anthropic   | claude-sonnet-4-5-20250929 | Claude Sonnet 4.5        | Yes            |
| Anthropic   | claude-3-5-sonnet-latest | Claude 3.5 Sonnet (Latest) | Yes            |
| Anthropic   | claude-3-5-haiku-latest  | Claude 3.5 Haiku (Latest)  | Yes            |
| Anthropic   | claude-3-opus-20240229   | Claude 3 Opus              | Yes            |
| Anthropic   | claude-3-sonnet-20240229 | Claude 3 Sonnet            | Yes            |
| Anthropic   | claude-3-haiku-20240307  | Claude 3 Haiku             | No             |

**Benefits**: Consistent response handling, unified error patterns, predictable test structure across all providers.

### 💬 System + User Messages (New)
- Prompts now support two fields: `systemText` (optional) and `promptText` (user message). Both support `{{variable}}` substitution.
- Client `PromptManager` exposes a System Message textarea by default and per-row Save/Load System Template actions.
- Server and worker invoke LangChain chat models with `[SystemMessage?, HumanMessage]` via `LLMService.processMessages`.
- Validator checks variables referenced in both `systemText` and `promptText` with the same exact semantics used for substitution.

### 🧭 Perplexity Deterministic Defaults (New)
- All Perplexity models (`sonar`, `sonar-pro`, `sonar-reasoning`, `sonar-reasoning-pro`) use deterministic enrichment defaults: temperature=0, safe token caps, and capability-aware sanitization.
- Logs include requested vs effective parameters and sanitized fields; cache keys reflect temperature buckets.

### 🌟 Gemini Deterministic Defaults (New)
- Gemini models (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`) use deterministic enrichment defaults: temperature=0 and safe `maxOutputTokens`.
- Logs include requested vs effective parameters and sanitized fields; cache keys reflect temperature buckets.
- Safety: Provider safety blocking is disabled for enrichment, per requirement. A lightweight system instruction ("plain text only; no tools") is added to reduce formatting/tool-call drift.

### 🧩 Skip Existing Values (New)
- The "Skip if output exists" toggle now lives inside the Prompt Manager action card (beneath Preview/Start) and uses the same tooltip pattern as other inline help. When enabled, Preview and processing skip generating values for cells that already contain a value, including when the output column name collides with an input header that already has a value.
- Values treated as empty (eligible to overwrite): `LLM_ERROR`, `ROW_ERROR`, `NA`, `N/A` (case-insensitive) and empty/whitespace.
- Mid-run toggles are applied by pausing the job, updating options via an endpoint, and resuming. The worker re-reads options on resume.

#### Control File & Endpoints
- Control file path: `controls/<userId>/<jobId>.json` with `{ skipIfExistingValue: boolean, updatedAt, updatedBy }`. Absence implies defaults (skip=false).
- API:
  - `POST /api/jobs` and `POST /api/jobs/preview` accept optional `options` in the body: `{ skipIfExistingValue?: boolean }`.
  - `PATCH /api/jobs/:jobId/options` updates the control file (used during pause → resume).
  - `GET /api/jobs/:jobId/options` returns the current option value.

#### Worker Behavior
- On start, the worker reads the control file (with a short retry) and logs the effective value; after `pause → resume`, it re-reads options.
- Per-row/per-prompt, if enabled and the composed row view shows the target output cell as filled, the worker logs a skip and does not call the LLM.

### 🧠 Capability-Aware OpenAI Defaults
- Reasoning-capable models (e.g., `gpt-5`, `gpt-5-mini`) are invoked via a Responses-style configuration path. Classic sampling knobs (temperature/top_p/penalties) are omitted; we set `reasoning.effort=medium` by default and apply safe max token limits.
- Non-reasoning models (e.g., `gpt-4o`, `gpt-4.1`, minis) use Chat semantics with deterministic defaults for enrichment (temperature=0, top_p=1, penalties=0) and conservative `max_tokens`.
- A one-time sanitize-and-retry is applied on OpenAI "unsupported parameter" errors to auto-correct misapplied knobs.
- Prompt-length token heuristics: removed globally. We rely on explicit/requested `max_tokens` or model defaults. Timeout scaling with prompt length remains.
- Structured JSON mode is not enforced; responses remain flexible to maximize versatility.

Implementation:
- `shared/llm.capabilities.ts`: OpenAI capability map + `computeOpenAIEffectiveParams(modelId, requested)` sanitizer.
- `shared/llm.ts`: Uses capability-aware params, passes Responses-mode `reasoning.effort` via `modelKwargs` for reasoning models, logs requested vs effective params and token planning.

**Required Environment Variables for Full Test Coverage**:
- `OPENAI_API_KEY` - For OpenAI integration tests (15 tests)
- `GEMINI_API_KEY` - For Gemini integration tests (15 tests)  
- `PERPLEXITY_API_KEY` - For Perplexity integration tests (15 tests)
- `ANTHROPIC_API_KEY` - For Anthropic integration tests (when enabled)
- At least 1 API key - For basic orchestration tests (most tests)
- At least 2 API keys - For multi-provider orchestration tests (some tests)
  
**Worker Dedupe Flags (New)**:
- `DQ_PROMPT_DEDUPE` (optional): `on|off` to enable per-job, per-prompt dedupe (default: on).
- `DQ_DEDUPE_SECRET` (optional): secret used to derive per-user HMAC salts (falls back to `ENCRYPTION_KEY`).

**Documentation**: See `__tests__/TESTING_GUIDE.md` for complete testing guide and `tests_implementation_plan.md` for roadmap.

### 📚 System Templates (New)
- New database table `system_templates` for reusable System Message snippets.
- Endpoints:
  - `GET /api/system-templates` – list user templates
  - `POST /api/system-templates` – create
  - `PUT /api/system-templates/:systemTemplateId` – update
  - `DELETE /api/system-templates/:systemTemplateId` – delete
- Client: Templates page adds a sub-tab "System Templates" with CRUD; `PromptManager` has per-row Save/Load System actions.

- Per-user default templates (New): On new user creation, a curated set of templates is seeded into the user's account.
  - Source: `shared/defaultTemplates.ts`
  - Trigger: `UsersService.createUserAndSeed` (invoked by `AuthService.syncUser` only when creating a new user)
  - Idempotency: name-based existence checks via repository helpers prevent duplicates
  - Backfill: `server/scripts/seed-defaults-for-existing-users.ts` seeds existing users; safe to re-run


## Repository Layout

```
oracle3/
  client/            # React SPA (Vite)
  server/            # Express API
  worker/            # Background job processor
  shared/            # Shared types/schemas
  migrations/        # Database migrations
  scripts/           # Development and production scripts
  uploads/           # File upload storage
  attached_assets/   # Project documentation and assets
```

## Account Management

### DELETE /api/account (New)
- Purpose: Hard-delete the authenticated user's account and all associated data
- Auth: Required
- Response 200: `{ success: true, userRowDeleted: boolean, authUserDeleted: boolean }`
- Response 409: `{ success: false, code: "ACCOUNT_DELETE_PARTIAL", userRowDeleted, authUserDeleted, requestId }`
- Behavior:
  - Stops active jobs, deletes job/file metadata, cleans storage prefixes (`uploads/`, `enriched/`, `logs/`)
  - Deletes `users` row; hard-deletes Supabase auth user via Admin API (`deleteUser(userId, false)`), verifies with `getUserById`
  - Emits audit telemetry (`account_delete_requested`, `account_deleted`) and structured logs with `requestId`
  - Applies a short retry on both DB and auth deletes; returns 409 if any flag remains false

## Root Configuration Files

### `package.json`
- **Purpose**: Project dependencies and scripts configuration
- **Scripts**:
  - `dev`: Development environment startup
  - `build`: Production build process
  - `start`: Production startup
  - `check`: TypeScript compilation check
  - `db:push`: Database schema push
  - `make_lint`: Linting and formatting check
  - `lint:fix`: Auto-fix linting issues
  - `test:auth`: Authentication middleware test
  - `test:crypto`: Crypto utilities test
  - `test:csv`: CSV processing test
  - `test:resume`: Job resume logic test
  - `test:cascade`: Database cascade test
  - `integration:flow`: End-to-end integration test
  - `migrate:rekey`: API key re-encryption
  - `test:substitution`: Variable substitution test
  - `test:error-pause`: Run all error pause tests (shared, repository, service, worker, realtime, ui, e2e)
  - `test:error-pause:shared`: Error categorization and validation tests
  - `test:error-pause:repository`: Repository atomic updates tests
  - `test:error-pause:service`: Service layer cleanup tests
  - `test:error-pause:worker`: Worker auto-pause logic tests
  - `test:error-pause:realtime`: Real-time integration tests
  - `test:error-pause:ui`: UI component validation tests
  - `test:error-pause:e2e`: E2E tests with real API errors
- **Dependencies**: React, Express, Supabase, Drizzle ORM, Tailwind CSS, Shadcn/UI components
- **Implementation Pattern**: Node.js package with TypeScript and modern tooling

### `vite.config.ts`
- **Purpose**: Vite build configuration for React client
- **Features**: React plugin, path aliases, Replit integration
- **Path Aliases**:
  - `@/*`: `client/src/*`
  - `@shared/*`: `shared/*`
  - `@assets/*`: `Media/*`
- **Implementation Pattern**: Vite configuration with custom plugins and path resolution

### `tailwind.config.ts`
- **Purpose**: Tailwind CSS configuration with custom design system
- **Features**: Dark mode support, custom color variables, component variants
- **Custom Colors**: Background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart, sidebar
- **Animations**: Accordion animations
- **Plugins**: Tailwind animate, typography
- **Implementation Pattern**: Tailwind configuration with CSS custom properties

### `drizzle.config.ts`
- **Purpose**: Database ORM configuration
- **Features**: PostgreSQL dialect, migration output, schema location
- **Implementation Pattern**: Drizzle Kit configuration for database management

### `tsconfig.json`
- **Purpose**: TypeScript configuration
- **Features**: Strict mode, ES modules, JSX preservation, path mapping
- **Path Mapping**: `@/*` to `client/src/*`, `@shared/*` to `shared/*`
- **Implementation Pattern**: TypeScript configuration with module resolution

### `eslint.config.js`
- **Purpose**: ESLint flat configuration
- **Features**: TypeScript support, React rules, Prettier integration
- **Rules**: React hooks, TypeScript best practices, import validation
- **Implementation Pattern**: Modern ESLint flat config with plugins

### `components.json`
- **Purpose**: Shadcn/UI component configuration
- **Features**: New York style, TypeScript support, Tailwind integration
- **Aliases**: Component path mapping for development
- **Implementation Pattern**: Shadcn/UI configuration schema

### `.prettierrc.json`
- **Purpose**: Code formatting configuration
- **Features**: Double quotes, semicolons, 2-space tabs, 100 character line width
- **Implementation Pattern**: Prettier configuration for consistent formatting

### `.eslintrc.cjs`
- **Purpose**: Legacy ESLint configuration (fallback)
- **Features**: React, TypeScript, import plugin support
- **Implementation Pattern**: Traditional ESLint configuration file

## Scripts Directory (`/scripts`)

### `dev.js`
- **Purpose**: Development environment startup script
- **Functions**:
  - `cleanup()`: Process cleanup and termination
  - **Features**: Concurrent API server and worker startup, process management
  - **Processes**: API server (tsx server/index.ts), Worker (tsx worker/index.ts)
  - **Implementation Pattern**: Node.js process spawning with cleanup handlers

### `start-production.js`
- **Purpose**: Production environment startup script
- **Functions**:
  - `cleanup()`: Production process cleanup
  - **Features**: Production API server and worker startup, error handling
  - **Processes**: Production API server (node dist/index.js), Worker (node dist/worker/index.js)
  - **Implementation Pattern**: Production process management with error handling

### `check-env.js`
- **Purpose**: Environment variable validation script
- **Functions**:
  - Environment validation for required variables
  - **Required Variables**: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, ENCRYPTION_KEY
  - **Optional Variables**: OPENAI_API_KEY, PERPLEXITY_API_KEY
  - **Features**: Encryption key validation, base64 encoding check
  - **Implementation Pattern**: Environment validation utility with detailed error reporting

## Client Directory (`/client`)

### `/client/index.html`
- **Purpose**: Main HTML entry point
- **Features**: React app mounting, meta tags, title, Google Analytics integration
- **Google Analytics**: User behavior tracking (Tracking ID: G-MGJTE79PH3)
- **Implementation Pattern**: Single page application entry point

### `/client/src/components/auth/`

#### `AuthButton.tsx`
- **Purpose**: Single authentication button component with dynamic state
- **Functions**:
  - `AuthButton()`: Main component that renders login/logout button
  - **State Management**: Uses `useAuthContext` for authentication state
  - **Features**: Google OAuth integration, dynamic button text
  - **Implementation Pattern**: Context-based state management with Supabase

### `/client/src/components/core/`

#### `ApiKeysManager.tsx`
- **Purpose**: Secure API key management for LLM providers
- **Location**: Only rendered on the `Settings` page. The `Dashboard` no longer contains the keys manager; instead it shows a conditional CTA linking to Settings when no keys are configured.
- **Functions**:
  - `ApiKeysManager()`: Main component for API key management
  - **State Management**: Uses `useAuthContext` for user data
- **Features**: Encrypted storage, provider selection (OpenAI, Gemini, Perplexity, DeepSeek)
  - **Server-side merge semantics (Updated)**: Only non-empty inputs are sent when saving; unspecified providers are left unchanged on the server; sending `null` for a provider explicitly deletes that key.
  - **Configured status + delete (Updated)**: Each provider row shows a "Configured"/"Not configured" badge and an icon-only Delete action (Trash2). Delete sends `{ provider: null }` to remove just that key.
  - **No prefill of secrets**: Inputs remain empty; the UI never reads or displays real keys. After save/delete, the session is refetched to update configured badges.
  - **Implementation Pattern**: Form-based input with secure submission
  - **Responsive Provider Grid (Updated)**: Provider status cards render in a responsive grid — 1 column on extra narrow, 2 on small/mobile (`sm:`), 3 on tablet (`md:`), and 4 on desktop (`lg:`) — so all four providers fit on one row on desktop.

#### `CsvUploader.tsx`
- **Purpose**: CSV file upload with validation and processing
- **Functions**:
  - `CsvUploader({ onFileUploaded, onUploadError })`: Main upload component
  - `handleFileSelect(event)`: File selection handler
  - `handleUpload()`: File upload processing
  - **State Management**: Local state for upload progress and validation
  - **Features**: File validation, progress tracking, telemetry, server-backed CSV preview rendering (first rows shown under detected headers)
- **Display**: CSV preview cells truncate overflowing text to a single line using Tailwind `truncate` with `max-w-xs`, with full values available via the `title` attribute on hover.
- **Section Layout (Updated)**: Page section "1. Upload & Preview" contains two child cards: "UPLOAD CSV FILE" and "CSV PREVIEW". Section-level help is provided by the page `SectionHeader` tooltip; child cards no longer render their own header HelpTip icons to avoid duplication.
  - **Implementation Pattern**: Controlled component with error boundaries

#### `FileDetailsDisplay.tsx`
- **Purpose**: Display uploaded file metadata and structure
- **Functions**:
  - `FileDetailsDisplay({ fileDetails })`: File information display
  - **Features**: Row count, column headers, file name display
  - **Implementation Pattern**: Presentational component with props

#### `PreviewModal.tsx`
- **Purpose**: Modal for previewing LLM processing results
- **Functions**:
  - `PreviewModal({ isOpen, onClose, previewData })`: Preview modal component
  - **Features (Updated)**:
    - Tabs for the first two rows (“Row 1”, “Row 2”)
    - Original Data renders as a simple table with columns: Name, Origin, Value. The list is the union of all variables used across prompts for that row; when a variable comes from a prior prompt’s output, its Origin is labeled “AI Response Column”.
    - Per‑prompt accordion sections (opened by default) show:
      - Expert Role (filled `systemText`)
      - Task Instructions (filled `promptText`)
      - AI Response Field labeled by the prompt’s `outputColumnName`
    - Typography uses relaxed sizing and spacing for readability (`text-[15px]` blocks with `leading-relaxed`, roomier paddings).
  - **Data (Updated)**: Prefers `previewData.detailed` from the server (per-row, per-prompt details). Falls back client‑side to derive the same structure using shared utilities when `detailed` is absent.
  - **Implementation Pattern**: Modal component with controlled visibility

#### `ProcessMonitor.tsx`
- **Purpose**: Real-time job monitoring and control
- **Functions**:
  - `ProcessMonitor({ jobData, isLoading, jobId })`: Main monitoring component
  - `handleJobControl(command)`: Job control operations (pause/resume/stop)
  - `handleDownload()`: Download enriched results
- **State Management (Updated)**: Reads job + logs from the React Query cache. The page (`Dashboard.tsx`) owns the single realtime subscription via `useRealtimeJob(currentJobId)` and hydrates the cache; `ProcessMonitor` does not subscribe directly to avoid duplicate channels.
  - **Features**: Progress tracking, log display, job controls, download
- **Implementation Pattern**: Real-time subscription with job state management
- **Error Modal Integration (New)**:
  - Detects paused job with error details via real-time subscription
  - Auto-opens error modal when error detected
  - Prevents duplicate modal opens with state flag
  - Auto-closes modal when job resumes/stops/completes
  - Error modal handlers integrated with existing job control logic

#### `JobErrorModal.tsx` (New)
- **Purpose**: Display error details when job is auto-paused due to critical LLM error
- **Functions**:
  - `JobErrorModal({ isOpen, onClose, errorDetails, onResume, onStop, isLoading })`: Error modal component
  - `getCategoryBadge(category)`: Get badge variant and label for error category
  - `getCategoryHelp(category)`: Get help text for error category
- **Features**:
  - Displays error category with color-coded badge
  - User-friendly error message with actionable guidance
  - Context display: Row, Prompt, Output Column, Provider, Model
  - Collapsible technical details section
  - Actions: Resume Job, Stop Job, Dismiss
  - Handles invalid/malformed error details gracefully with fallback UI
  - Renders markdown-style links in error messages (e.g., `[Settings](/settings)` and external provider links) using a safe, inline link renderer
- **Implementation Pattern**: AlertDialog-based modal with error details validation
- **Section Layout (Updated)**: Page section "3. View Progress" renders the Process Monitor. The "Sync Jobs" button is always visible (left‑aligned) with descriptive text directly to its right, and can be used to manually refresh job state if realtime is temporarily unavailable. Section-level help is shown on the page `SectionHeader`.
  - **Job Summary (New)**: After completion, parses the `DEDUPE_SUMMARY` job log and surfaces:
  - **Current Row Indicator (New)**: While status is `processing`, the monitor displays "Now processing row X/Y" derived from the new `currentRow` column streamed over realtime. This is independent of the completion bar (`rowsProcessed/totalRows`), so the iterator position remains stable even when dedupe backfills earlier rows.
    - Total Requests Planned, Actual LLM Calls, LLM Calls Avoided, Savings %.
    - Null-safe rendering prevents transient runtime errors when `job` is momentarily unavailable.

#### `PromptManager.tsx`
- **Purpose**: Prompt configuration and management
- **Functions**:
  - `PromptManager({ prompts, onPromptsChange, onPreview })`: Main prompt manager
  - `addPrompt()`: Add new prompt configuration
  - `removePrompt(index)`: Remove prompt at index
  - `updatePrompt(index, field, value)`: Update specific prompt field
  - `handlePreview()`: Trigger preview processing
  - **State Management**: Local state with parent callback updates
  - **Features**: Dynamic prompt addition/removal, model selection, autocomplete
  - **Implementation Pattern**: Controlled component with dynamic form generation
  - **Template Save/Load (per-prompt)**: Each prompt row has its own Load/Save Template actions. The template selector is scoped to the row that triggers it and templates are lazy-loaded once. Selecting a template updates only that prompt's `promptText`, `outputColumnName`, and `model` without affecting other prompts or changing the order.
  - **Stable Keys via `localId`**: Uses a UI-only `localId` per prompt as the React list key. This identifier is client-only and is never sent to the server.
- **Diagnostics**: Emits concise logs when opening/closing the selector, choosing a template for a row, and adding/removing prompts.
- **Prompt Factory (Updated)**: New prompts are created via `createEmptyUiPrompt()` from `client/src/lib/uiPrompts.ts` to avoid duplication and keep defaults consistent with `Dashboard`.
  - **Add Variable Popover**: The "Add Variable" button now opens a per-prompt popover listing available variables (union of CSV column headers and current output columns), reusing the same suggestions source; selecting an item inserts a `{{variable}}` token at the current cursor position using the existing insertion logic.
  - **Load Template Popover**: The "Load Template" button opens a per-prompt popover that lazy-loads and lists saved templates, reusing the same templates data source; selecting a template applies it only to that prompt and closes the popover.
- **Preflight Validation (Updated)**: Before Preview or Start, a shared validator checks that every `{{variable}}` maps to a CSV header or a prior prompt's output, flags references to outputs from future prompts, prevents duplicate `outputColumnName`, detects `outputColumnName` collisions with CSV headers, self‑references, and ensures required fields are present. Matching is exact and case-sensitive; whitespace inside `{{ }}` is treated literally. 
  - Preview: collisions are treated as warnings — preview proceeds (we show a warning), while other issues still block.
  - Start: collisions are treated as warnings — the user sees a confirmation dialog listing the collisions and can choose to proceed, in which case those input columns will be overwritten in the enriched output.
- **System Message Field (New)**: Adds `systemText` per prompt, with its own variable popover. Per-row Save/Load System actions use a lazy-loaded list; selection updates only `systemText`.
- **Device-Aware Pickers (Updated)**: Uses `useDevicePicker` to centralize how pickers open depending on viewport. Desktop uses Radix Popovers anchored to the header buttons; mobile uses a centered modal. Desktop actions are not rendered on mobile, eliminating duplicate buttons and preventing double-open states.
- **Button Placement (Updated)**:
  - Desktop & Mobile: System/User action rows render as a 3‑column grid: Add Variable, Load, Save. Buttons use consistent sizing (`h-10`) and wrap/stack on narrow viewports via `stackOnNarrow`. Micro‑explanations render below each button and do not affect alignment.
- **Skip Toggle Location (Updated)**: The global Skip toggle is integrated below the Preview/Start buttons within the same card for a single action surface.
- **Top‑Aligned Provider Row (Updated)**: Provider/Model/Output selectors use a fixed header height so all three dropdowns align at the top regardless of description length.

#### `client/src/lib/microcopy.ts` (New)
- **Purpose**: Centralized registry for UI microcopy (subheaders, guides, tooltips, micro‑explanations) used across the Dashboard, Homepage, and How It Works pages.
- **Usage**: Pages/components import keys from `MC.*` to render copy. This enables future i18n and consistent wording across sections.
- **Namespaces**:
  - `MC.dashboard.*` – Dashboard section copy (Upload & Preview, Create Your Expert AI, View Progress, etc.)
  - `MC.dashboard.errorModal.*` (New) – Error modal copy (title, description, category labels, context labels, action labels, help text for each error category)
  - `MC.homepage.*` – Homepage hero, problem, one‑row explainer, use cases, features, 5‑step mini guide, CTA
  - `MC.howItWorksPage.*` – Full `/how-it-works` page: sidebar nav items, hero, steps, benefits, prompts guide, putting it together, API keys, FAQ, support CTA, a11y labels
  - `MC.templatesPage.*` – Templates page header copy (title, subheader, guide)

#### `client/src/components/ui/help-tip.tsx` (New)
- **Purpose**: Unified hover + click help affordance.
- **Behavior**: Hover shows a Tooltip; click toggles a Popover; outside click closes. The Tooltip and Popover share standardized surface styles for identical size/placement. Both surfaces preserve newline characters (whitespace-pre-line) so multi-line microcopy renders line breaks without `<br>` tags.
- **Usage**: Used on section headers and form labels (System/User, Provider/Model/Output, Skip toggle).
  
#### `client/src/components/ui/SectionHeader.tsx` (New)
- **Purpose**: Standard page-owned section heading with optional icon, tooltip, subheader, guide, and actions.
- **Behavior**: Renders semantic heading levels (h2–h6) and supports `aria-labelledby` via provided `id`.
- **Usage**: Dashboard sections (1. Upload & Preview; 2. Configure Prompts; 3. View Progress), Settings subsections, and the Templates page header use this for SEO/a11y consistency.

#### `client/src/components/ui/SectionCard.tsx` (New)
- **Purpose**: Composes a bordered card container with `SectionHeader` and a padded content area.
- **Usage**: Settings subsections like "API Keys" and "Account". Prefer this wrapper for new Settings sections.
 - **Hardened Loading (New)**: The loader detects and logs non-JSON responses (e.g., proxy fallback HTML) with a short preview; toasts surface `code`/`requestId` when present.
  

### `/client/src/components/history/`

#### `HistoryTable.tsx`
- **Purpose**: Display job history with real-time updates
- **Functions**:
  - `HistoryTable()`: Main history display component
  - **State Management**: Uses `useRealtimeJobs` for real-time updates
  - **Features**: Job status tracking, download links (Original, Enriched, Logs), deletion
  - **Implementation Pattern**: Table component with real-time data subscription

### `/client/src/components/layout/`

#### `Header.tsx`
- **Purpose**: Application header with navigation
- **Functions**:
  - `Header()`: Main header component
  - **Features**: Navigation links, authentication status
  - **Implementation Pattern**: Layout component with navigation

#### `MainLayout.tsx`
- **Purpose**: Main layout wrapper for authenticated pages
- **Functions**:
  - `MainLayout({ children })`: Layout wrapper component
  - **Features**: Header + Footer integration, authentication check; uses a flex column layout (`flex flex-col`, `flex-1` on `main`) so the footer sits at the bottom on tall screens
  - **Implementation Pattern**: Layout component with authentication guard

#### `Footer.tsx` (New)
- **Purpose**: Global footer with feedback and support CTAs
- **Functions**:
  - `Footer()`: Renders a single responsive row (wraps on mobile) containing: suggestion text, a mail icon linked to `mailto:d@dessentialist.com`, and a first-party "Buy me a coffee" button linking to `https://www.buymeacoffee.com/darpanshah`.
- **Design**: Matches design tokens (`oracle-muted`, `border-oracle-border`, brand accent). Uses `lucide-react` `Mail` and `Coffee` icons; no third-party widget scripts.
- **Rationale**: Replaces the external Buy Me A Coffee script which depends on `document.write` and fails when injected asynchronously in a SPA. The native button is ad-blocker friendly and predictable.

### `/client/src/components/templates/`

#### `TemplateManager.tsx`
- **Purpose**: Prompt template CRUD operations
- **Functions**:
  - `TemplateManager()`: Main template management component
  - `handleCreateTemplate(templateData)`: Create new template
  - `handleUpdateTemplate(id, templateData)`: Update existing template
  - `handleDeleteTemplate(id)`: Delete template
  - **State Management**: Uses React Query for server state
  - **Features**: Template CRUD, form validation, error handling
  - **Implementation Pattern**: CRUD operations with React Query mutations
 - **Headerless (Updated)**: Does not render a page-level header; the `Templates.tsx` page owns the heading per the Page-level Section Headers pattern.

### `/client/src/ui/`
*Note: Contains 50+ Shadcn/UI components - comprehensive list below*

#### Custom UI Components

##### `info-blocks.tsx` (New)
- **Purpose**: Reusable styled information blocks for the How It Works page
- **Components**:
  - `ExampleBlock({ label?, children })`: Displays examples with warm gradient background
    - Features: Amber/orange gradient background, optional label, consistent padding
    - Usage: Showcasing example prompts, use cases, or sample data
  - `TipBlock({ children })`: Speech bubble-style tips and quick notes
    - Features: Mint green accent, speech bubble design with pointer, lightbulb icon
    - Usage: Quick tips, helpful hints, or best practices
  - `CalloutBlock({ children })`: Minimal callout with left accent border
    - Features: Blue left border accent, light background, simple text styling
    - Usage: General callouts, analogies, or additional context
- **Design**: Consistent spacing, responsive layout, accessible color contrast
- **Implementation Pattern**: Presentational components with Tailwind CSS styling
- **Usage**: Used throughout HowItWorks page for structured information display

#### Core UI Components
- **Accordion**: Collapsible content sections
- **Alert**: Status and error message display
- **Alert Dialog**: Confirmation dialogs
- **Aspect Ratio**: Responsive aspect ratio container
- **Avatar**: User profile image display
- **Badge**: Status and label indicators
- **Breadcrumb**: Navigation breadcrumbs
- **Button**: Interactive button components
  - **Global Wrapping (Updated)**: Base buttons now support wrapping & auto height. Defaults include `h-auto`, `min-h-9`, `whitespace-normal`, `break-words`, and centered text so long labels don't overflow.
  - **Variants (New)**:
    - `stackOnNarrow` (boolean): When true, the button stacks icon above label on narrow screens (≤420px) and tightens gaps for compact layouts.
    - `size="compact"` (New): Reduced horizontal/vertical padding for dense toolbars and small devices.
- **Calendar**: Date picker component
- **Card**: Content container with header, content, footer
- **Carousel**: Image/content carousel
- **Chart**: Data visualization components
- **Checkbox**: Form checkbox input
- **Collapsible**: Expandable content sections
- **Command**: Command palette interface
- **Context Menu**: Right-click context menus
- **Dialog**: Modal dialog components
- **Drawer**: Slide-out drawer panels
- **Dropdown Menu**: Dropdown navigation menus
- **Form**: Form input components with validation
- **Hover Card**: Hover-triggered information cards
- **Input**: Text input components
- **Input OTP**: One-time password input
- **Label**: Form field labels
- **Menubar**: Horizontal menu navigation
- **Navigation Menu**: Navigation menu components
- **Pagination**: Page navigation controls
- **Popover**: Popover information display
- **Progress**: Progress bar indicators
- **Radio Group**: Radio button groups
- **Resizable**: Resizable panel components
- **Scroll Area**: Custom scrollable areas
- **Select**: Dropdown selection components
- **Separator**: Visual separators
- **Sheet**: Slide-out sheet panels
- **Sidebar**: Application sidebar navigation
- **Skeleton**: Loading state placeholders
- **Slider**: Range slider inputs
- **Switch**: Toggle switch components
- **Table**: Data table components
- **Tabs**: Tabbed content interface
- **Textarea**: Multi-line text input
- **Toast**: Notification system
- **Toaster**: Toast notification container
- **Toggle**: Toggle button components
- **Toggle Group**: Grouped toggle buttons
- **Tooltip**: Hover information display. Preserves newline characters (whitespace-pre-line); prefer multi-line strings in microcopy over manual `<br>`.

### `/client/src/context/`

#### `AuthProvider.tsx`
- **Purpose**: Authentication context provider
- **Functions**:
  - `AuthProvider({ children })`: Context provider component
  - `useAuthContext()`: Hook for accessing auth context
  - **State Management**: Provides authentication state to entire app
  - **Features**: User session, authentication methods, API key management
  - **Implementation Pattern**: React Context with custom hook

### `/client/src/hooks/`

#### `useAuth.ts`
- **Purpose**: Authentication state management hook
- **Functions**:
  - `useAuth()`: Main authentication hook
  - `syncUserWithBackend()`: Sync user data with backend
  - `loginWithGoogle()`: Google OAuth login
  - `logout()`: User logout
  - **State Management**: Manages authentication state and user data
  - **Features**: Supabase integration, session management, backend sync
  - **Session refresh after key changes (New)**: On successful `saveApiKeys`, invalidates the React Query cache for `"/api/auth/session"` to refetch masked key status so configured badges update correctly.
  - **Implementation Pattern**: Custom hook with Supabase client

#### `useRealtimeJob.ts`
- **Purpose**: Real-time job updates subscription
- **Functions**:
  - `useRealtimeJob(jobId)`: Real-time job subscription hook
  - `setupSubscription(jobId)`: Setup real-time subscription
  - `cleanupSubscription()`: Cleanup subscription
  - **State Management**: Manages real-time job data updates
  - **Features**: Supabase real-time, job progress, log updates
- **Implementation Pattern**: Custom hook with real-time subscriptions
  - **Updated Mapping (New)**: Maps DB `current_row` → `currentRow` so the UI can show the iterator position distinctly from completion.
  - **ErrorDetails Mapping (New)**: Maps DB `error_details` (snake_case) → `errorDetails` (camelCase) so real-time subscriptions receive error details updates for error modal display.
  - **Idempotent Subscription Guard (New)**: Prevents parallel subscription setup for the same jobId (Strict Mode safe) to avoid binding mismatches; the guard is released on SUBSCRIBED/ERROR/CLOSED so retries are possible.
  - **Single-source Ownership (New)**: A single page-level owner (the `Dashboard`) should invoke this hook and hydrate the React Query cache. Child components (e.g., `ProcessMonitor`) consume cached data and should not create their own channels, preventing “mismatch between server and client bindings” errors.

#### `useRealtimeJobs.ts`
- **Purpose**: Real-time jobs list updates
- **Functions**:
  - `useRealtimeJobs()`: Real-time jobs subscription hook
  - **State Management**: Manages real-time jobs list updates
  - **Features**: History updates, job status changes
  - **Implementation Pattern**: Custom hook with real-time subscriptions

#### `use-toast.ts`
- **Purpose**: Toast notification system
- **Functions**:
  - `useToast()`: Toast hook
  - `toast(options)`: Display toast notification
  - **Implementation Pattern**: Custom hook with toast state management

#### `use-mobile.tsx`
#### `useDevicePicker.ts` (New)
- **Purpose**: Centralizes device-aware disclosure for UI pickers so components don't branch on viewport.
- **API**:
  - `open(index)` / `close()` – single trigger interface used by buttons.
  - `desktop.openIndex` and `desktop.onOpenChange(index, isOpen)` – bind to Radix Popovers.
  - `mobile.openIndex` – bind to centered mobile modal.
  - `shouldRenderDesktopActions` / `shouldRenderMobileActions` – convenience flags for conditional rendering.
- **Usage**: `PromptManager` creates `templatePicker` and `systemPicker` instances; desktop header actions use the desktop slice, while mobile uses the existing centered modal. Prevents duplicates and double-open when switching viewports.

#### `useScrollSpy.ts` (New)
- **Purpose**: Tracks active section while scrolling for sticky navigation
- **Interface**: `Section { id: string; label: string; subsections?: { id: string; label: string }[] }`
- **Functions**:
  - `useScrollSpy(sections: Section[], offset: number = 100)`: Main hook
  - `scrollToSection(sectionId: string)`: Smooth scroll to section with offset
- **State Management**:
  - Uses IntersectionObserver to detect sections in viewport
  - Tracks `activeSection` state (section or subsection ID)
  - Handles both main sections and nested subsections
- **Features**:
  - Automatic active section detection based on scroll position
  - Smooth scrolling with configurable offset
  - Support for nested subsections
  - Fallback to closest section above viewport when no intersection
- **Implementation Pattern**: Custom hook with IntersectionObserver API and scroll event handling
- **Usage**: Used in HowItWorks page for sidebar navigation scroll spy

#### `use-mobile.tsx`
- **Purpose**: Mobile device detection
- **Functions**:
  - `useIsMobile()`: Mobile detection hook
  - **Features**: Responsive design support
  - **Implementation Pattern**: Custom hook with window size detection

### `/client/src/lib/`

#### `api.ts`
- **Purpose**: API client functions
- **Functions**:
  - `uploadFile(file)`: File upload API call
  - `files.preview(fileId)`: File preview API call (GET `/api/files/:fileId/preview`) returning `{ previewData, requestId }`
  - `previewJob(data)`: Job preview API call
  - `createJob(data)`: Job creation API call
  - `getJob(jobId)`: Job retrieval API call
  - `controlJob(jobId, command)`: Job control API call
  - `downloadJob(jobId)`: Job download API call
  - `getTemplates()`: Templates retrieval API call
  - `createTemplate(data)`: Template creation API call
  - `updateTemplate(id, data)`: Template update API call
  - `deleteTemplate(id)`: Template deletion API call
  - `getHistory(params)`: History retrieval API call
  - `deleteJob(jobId)`: Job deletion API call
  - **Implementation Pattern**: Centralized API client with error handling
 - **Response Shapes (Updated)**:
   - `POST /api/jobs/preview` returns:
     ```
     {
       previewData: Record<string, any>[];
       detailed?: Array<{
         original: Record<string, any>;
         enriched: Record<string, any>;
         prompts: Array<{
           index: number;
           model: string;
           modelId?: string;
           outputColumnName: string;
           usedVariables: string[];
           systemProcessed?: string;
           userProcessed?: string;
           response: string;
           skipped?: boolean;
         }>;
       }>;
       meta?: { models?: string[]; timestamp?: string; requestId?: string };
     }
     ```

#### `queryClient.ts`
- **Purpose**: React Query client configuration
- **Functions**:
  - `apiRequest(method, url, data)`: Generic JSON API request (injects auth, JSON body, ok-check)
  - `apiRequestMultipart(method, url, formData, options)`: Multipart request helper for uploads
    - **Options**: `raw?: boolean` (default false), `timeoutMs?: number` (default 30000)
    - **Behavior**: Injects Supabase auth, omits `Content-Type` for FormData, enforces timeout via AbortController, normalizes timeout/network errors, runs ok-check and returns parsed JSON when `raw` is false
  - `queryClient`: React Query client instance
  - **Features**: Centralized auth headers, error shaping, timeout for uploads, standardized multipart handling
  - **Implementation Pattern**: Shared fetch helpers with consistent behavior across JSON and multipart requests

#### `supabase.ts`
- **Purpose**: Supabase client configuration
- **Functions**:
  - `supabase`: Supabase client instance
  - **Features**: Authentication, real-time subscriptions
  - **Implementation Pattern**: Supabase client configuration

#### `telemetry.ts`
- **Purpose**: Client-side telemetry tracking
- **Functions**:
  - `track(event, properties)`: Track telemetry events
  - **Events**: upload_start, upload_success, upload_error, preview_success, preview_error, job_start_success, job_control, download_success
  - **Implementation Pattern**: Event tracking with structured logging

#### `utils.ts`
- **Purpose**: Utility functions
- **Functions**:
  - `formatBytes(bytes)`: Format file size display
  - **Implementation Pattern**: Pure utility functions

#### `uiPrompts.ts` (New)
- **Purpose**: Shared UI prompt factory and ID generator
- **Types**:
  - `UiPrompt`: `PromptConfig & { localId: string }` used as a stable React key; `localId` is client-only and never sent to the server
- **Functions**:
  - `generateLocalId()`: Uses `crypto.randomUUID()` when available; otherwise falls back to a cute, human-friendly prefix + timestamp. Emits concise logs for observability.
  - `createEmptyUiPrompt()`: Returns a standardized empty prompt `{ promptText:"", outputColumnName:"", model:"openai", modelId:"" }` with a generated `localId`. The empty `modelId` intentionally forces explicit model selection.
- **Usage**:
  - `Dashboard.tsx` seeds and resets prompt state with `[createEmptyUiPrompt()]`
  - `PromptManager.tsx` uses `createEmptyUiPrompt()` in `addPrompt()`

### `/client/src/pages/`

#### `Homepage.tsx` (Updated)
- **Purpose**: Marketing/overview landing page
- **Sections**:
  - Hero, problem statement, use cases, features
  - **How It Works (New)**: A responsive 5-step guide rendered as a `grid grid-cols-1 lg:grid-cols-5` with each step showing a centered icon, then a left-aligned number + title row, and a short description below. Icons: Upload, Braces, Workflow, PlayCircle, Table. On mobile, steps stack; on desktop, they align to top for consistent baselines.
 - **Copy Source**: Uses `MC.homepage.*` for all visible strings (hero, problem, one‑row explainer, use cases, features, steps, CTA).
 - **Implementation Pattern**: Pure presentational React + Tailwind, no data dependencies; uses `lucide-react` icons and project utility classes.

#### `HowItWorks.tsx` (Updated)
- **Purpose**: Comprehensive How It Works guide page with video demonstrations
- **Route**: `/how-it-works`
- **Components**:
  - `StepCard({ number, title, description, example, tip, screenshot, reverse, id })`: Reusable step component with:
    - Flex layout with horizontally centered media-text alignment (`flex items-center`)
    - Text section on one side, video/media on the other (reversible via `reverse` prop)
    - Support for ExampleBlock and TipBlock components
    - HTML5 `<video>` elements with `autoPlay`, `loop`, `muted`, `playsInline` attributes
    - Full video visibility using `object-contain` scaling without cropping
  - `SidebarNav({ sections, activeSection, onSectionClick })`: Sticky sidebar navigation with:
    - Fixed positioning at `left-4 top-1/2 -translate-y-1/2`
    - Collapsible subsections that expand when parent section is active
    - Active section highlighting with visual indicators (CheckCircle icons)
    - Smooth scroll-to-section functionality
- **State Management**: Uses `useScrollSpy` hook for active section tracking
- **Features**:
  - "DataQuilt vs LLMs" intro section before Steps
  - Dynamic Steps list (currently 6 items, including a step 3.5 for chaining); steps may optionally have a video
  - Sticky sidebar with scroll spy functionality and nested subsections (API Keys 4.1–4.5)
  - Reusable information blocks (ExampleBlock, TipBlock, CalloutBlock). ExampleBlock preserves newlines (`whitespace-pre-line`) for multi-line examples. ExampleBlock and TipBlock use darker text (`text-gray-800`) and slightly smaller size (`text-sm`) for lower visual glare
  - Help tips on steps: Each step title can show a shared `HelpTip` (hover tooltip + click popover) when `info` copy is provided
  - API keys quick links rendered as a compact table (Provider, Primary, Guide) instead of cards
  - Pricing (Usage & costs) rendered as a compact table (Model, Estimate, Pricing, Ref)
  - Additional sections: Why DataQuilt (renamed from Benefits), Crafting Prompts, Putting It Together, API Keys & Billing (with subsections), FAQ
  - Section headers use the shared `SectionHeader` accent band; spacing compacted for a tighter vertical rhythm. The “DataQuilt vs LLMs” section uses slightly increased spacing between header, subheader, and body paragraphs for readability
  - Single‑column paragraphs in this page span full width (no `max-w` constraint)
  - Page‑scoped readability: `.howitworks-page .oracle-muted` uses `--oracle-muted-strong` to darken body copy for this page only
  - Back-to-top button that appears on scroll
- **Media Assets**: Videos imported from `@assets` (attached_assets folder)
  - `upload-file.mp4`, `add-prompts.mp4`, `preview-job.mp4`, `start-job.mp4`, `download.mp4`
- **Copy Source**: All labels and text (sidebar nav, hero, section headings, step titles/descriptions, benefits, prompts guide, API keys, FAQ, support CTA, a11y) come from `MC.howItWorksPage.*`. The sections array is derived from `MC.howItWorksPage.nav.sections`.
- **Implementation Pattern**: Presentational component with custom scroll spy hook, MainLayout wrapper

#### `Dashboard.tsx`
- **Purpose**: Main application dashboard
- **Functions**:
  - `Dashboard()`: Main dashboard component
  - `handleFileUploaded(fileDetails)`: File upload handler
  - `handlePromptsChange(prompts)`: Prompt configuration handler
  - `handlePreview()`: Preview trigger handler
  - `handleStartJob()`: Job start handler
  - `handleJobCompleted()`: Job completion handler
  - **State Management**: Manages file state, prompt configuration, and job state
  - **Features**: File upload, prompt management, job processing, real-time monitoring
  - **Implementation Pattern**: Container component with state management
- **UI Prompt Type**: Maintains prompts as shared `UiPrompt` from `client/src/lib/uiPrompts.ts` for stable React keys. The `localId` is stripped before invoking preview and create job API calls. Initial seeding and reset use `createEmptyUiPrompt()`.
  - **Prompt Validation Modal (New)**: Before Preview/Start, runs a shared validator using `uploadedFile.columnHeaders`. If invalid, opens an AlertDialog listing issues grouped by prompt and blocks the action until fixed.
  - **API Keys CTA (Updated)**: The dashboard no longer embeds `ApiKeysManager`. If no keys are configured, it renders a small informational banner with a "Manage API Keys" button that links to `/settings`.

#### `History.tsx`
- **Purpose**: Job history page
- **Functions**:
  - `History()`: History page component
  - **Features**: Job history display, real-time updates
  - **Implementation Pattern**: Page component with history table

#### `Settings.tsx`
- **Purpose**: Application settings page
- **Functions**:
  - `Settings()`: Settings page component
  - **Features**: API key management (sole location for configuring OpenAI, Perplexity, Gemini, and DeepSeek API keys)
  - **Account Deletion (New)**: Destructive-confirm button to permanently delete account and data. Calls `DELETE /api/account`; on success, logs out and redirects to `/`.
  - **Implementation Pattern**: Page component with settings

#### `Templates.tsx`
- **Purpose**: Template management page
- **Functions**:
  - `Templates()`: Templates page component
  - **Features**: Template CRUD operations
 - **Implementation Pattern**: Page component with template manager
 - **Page-owned Header (Updated)**: Uses shared `SectionHeader` with `MC.templatesPage.header` (title, subheader, guide). Child manager (`TemplateManager`) is headerless to avoid duplicated top-level headings.

#### `not-found.tsx`
- **Purpose**: 404 error page
- **Functions**:
  - `NotFound()`: 404 page component
  - **Features**: Error display, navigation
  - **Implementation Pattern**: Error page component

### `/client/src/`
#### `App.tsx`
- **Purpose**: Main application component
- **Functions**:
  - `App()`: Main app component
  - `Router()`: Application routing
  - `ErrorFallback()`: Error boundary fallback
  - **Features**: Routing, error boundaries, providers
  - **Implementation Pattern**: App root with providers and routing

#### `main.tsx`
- **Purpose**: Application entry point
- **Functions**:
  - `main()`: Application initialization
  - **Features**: React app mounting
  - **Implementation Pattern**: Entry point with React rendering

#### `index.css`
- **Purpose**: Global CSS styles and Tailwind imports
- **Features**: CSS custom properties, Tailwind directives, global styles
- **Spacing Utilities (New)**: Introduces a small vertical rhythm system:
  - Tokens: `--space-xxs (4px)`, `--space-xs (8px)`, `--space-sm (12px)`, `--space-md (16px)`, `--space-lg (24px)`
  - Utilities: `oracle-mt-subheader` (headline → subheader), `oracle-mt-guide` (subheader → guide), `oracle-mt-micro` (microcopy spacing), `oracle-mt-controls` (text → control row), `oracle-gap-actions` (inline control gaps)
- **Implementation Pattern**: CSS variables + small utility classes to keep spacing consistent across sections.

## Server Directory (`/server`)

### `/server/config/`

#### `database.ts`
- **Purpose**: Database connection configuration
- **Functions**:
  - `createClient()`: Create Drizzle database client
- **Features**: PostgreSQL connection, connection pooling
- **Implementation Pattern**: Database client factory

### `/server/controllers/`

#### `auth.controller.ts`
- **Purpose**: Authentication controller (HTTP-only)
- **Functions**:
  - `syncUser(req, res)`: Delegates to `AuthService.syncUser`; maps errors via `mapErrorToHttp`
  - `getSession(req, res)`: Delegates to `AuthService.getSession`; maps errors via `mapErrorToHttp`
  - `saveApiKeys(req, res)`: Delegates to `AuthService.saveApiKeys`; maps Zod errors via `mapErrorToHttp({ invalidCode: "AUTH_INVALID_INPUT" })`
- **Features**: No Drizzle in controller; relies on middleware for token verification; passes `requestId` for logging
- **Implementation Pattern**: Controller → Service → Repository

#### `auth.service.ts`
- **Purpose**: Auth use-cases (sync user, session retrieval, API key management)
- **Functions**:
  - `syncUser({ userId, email, requestId })`: Idempotent create-if-missing; on creation calls `UsersService.createUserAndSeed` to seed per-user defaults; logs start/exists/created
  - `getSession({ userId, requestId })`: Returns user with masked `llmApiKeys`; throws `AUTH_USER_NOT_FOUND` when absent
  - `saveApiKeys({ userId, input, requestId })` (Updated): Validates input, decrypts current keys, applies merge semantics (undefined=no change; non-empty string=set/replace; null=delete), re-encrypts and stores via `UsersRepository.updateApiKeys`. Preserves unspecified providers.
- **Features**: Structured logging, strict error codes, encryption via shared crypto
- **Implementation Pattern**: Coordinates `UsersRepository` and shared crypto; controller remains HTTP-only

#### `files.controller.ts`
- **Purpose**: File management controller (HTTP-only)
- **Functions**:
  - `uploadMiddleware`: Multer middleware for file uploads
  - `uploadFile(req, res)`: Delegates to `FilesService.upload`; maps errors with `mapErrorToHttp({ invalidCode: "FILES_INVALID_INPUT" })`
  - `downloadFile(req, res)`: Legacy path-based; returns JSON `{ url }` via `FilesService.getDownloadUrlForPath`
  - `downloadById(req, res)`: Preferred id-based; returns JSON `{ url }` via `FilesService.getDownloadUrlById`
  - `previewFile(req, res)`: Delegates to `FilesService.previewFirstRows` (default 5 rows). Returns `{ previewData, requestId }`. Uses streaming with graceful early termination (unpipe + destroy) and normalized headers for consistent preview keys
- **Features**: No Drizzle/Supabase calls in controller; ownership and workflow in service; all logs carry `requestId`
- **Implementation Pattern**: Controller → Service → Repository; controllers keep HTTP concerns only

#### `history.controller.ts`
- **Purpose**: Job history controller
- **Functions**:
  - `listHistory(req, res)`: Delegates to `HistoryService.listHistory`; maps errors via `mapErrorToHttp({ invalidCode: "HISTORY_INVALID_INPUT" })`
  - `deleteJob(req, res)`: Delegates to `HistoryService.deleteJob`; service handles storage + DB cleanup
- **Features**: Ownership enforced in service; requestId passed to service; structured error mapping
- **Implementation Pattern**: Controller → Service → Repository

#### `history.service.ts`
- **Purpose**: History use-cases (list, delete) composed from repositories and storage
- **Functions**:
  - `listHistory({ userId, input, requestId })`: Validates filters, fetches jobs joined with original file name via repository, logs with requestId
  - `deleteJob({ userId, jobId, requestId })`: Ownership check, best-effort storage deletes (original/enriched/partial), DB deletes via repository; returns `{ success: true }`
- **Features**: Structured logging, strict error codes, single orchestration point for cleanup
- **Implementation Pattern**: Coordinates `JobsRepository`, `supabaseService`, and direct `files` metadata delete

#### `jobs.controller.ts`
- **Purpose**: Job processing controller
- **Functions**:
  - `createJob(req, res)`: Create new enrichment job
  - `previewJob(req, res)`: Preview job processing (reads first 2 rows with graceful early termination) using normalized headers to ensure prompt variable substitution matches metadata
  - `getJob(req, res)`: Get job details
  - `controlJob(req, res)`: Control job (pause/resume/stop)
  - `getDownloadUrl(req, res)`: Get job download URL
  - `getLogsDownloadUrl(req, res)` (New): Returns signed URL to the job logs TXT artifact; lazily generates it if missing for terminal jobs
  - `getActiveJobs(req, res)`: Get user's active jobs
- **Features**: Job creation, preview, control, download
- **Implementation Pattern**: Express controller with job state management

#### `templates.controller.ts`
- **Purpose**: Template management controller
- **Functions**:
  - `listTemplates(req, res)`: List user templates
  - `createTemplate(req, res)`: Create new template
  - `updateTemplate(req, res)`: Update existing template
  - `deleteTemplate(req, res)`: Delete template
- **Features**: Template CRUD operations
- **Implementation Pattern**: Express controller with template operations

### `/server/middleware/`

#### `auth.ts`
- **Purpose**: Authentication middleware
- **Functions**:
  - `authenticateSupabaseUser(req, res, next)`: Full user authentication
  - `verifySupabaseTokenOnly(req, res, next)`: Token-only verification
- **Features**: JWT validation, user authentication
- **Implementation Pattern**: Express middleware with Supabase validation

#### `requestId.ts`
- **Purpose**: Request ID middleware
- **Functions**:
  - `requestIdMiddleware(req, res, next)`: Add request ID to requests
- **Features**: Request correlation, logging support
- **Implementation Pattern**: Express middleware for request tracking

### `/server/scripts/`

#### `integration.flow.ts`
- **Purpose**: Integration testing script
- **Functions**:
  - `main()`: Main integration test runner
- **Features**: End-to-end testing, API validation
- **Implementation Pattern**: Test script with async operations

#### `rekey-encrypted-keys.ts`
- **Purpose**: API key re-encryption script
- **Functions**:
  - `main()`: Main re-encryption runner
- **Features**: Legacy key migration, encryption updates
- **Implementation Pattern**: Migration script with database operations

#### `seed-defaults-for-existing-users.ts` (New)
- **Purpose**: Backfill per-user default templates for all existing users
- **Usage**: `node --import tsx server/scripts/seed-defaults-for-existing-users.ts`
- **Behavior**: Iterates users in batches, calls `DefaultsSeedingService.seedDefaultsForUser` for each; idempotent and safe to re-run

### `/server/services/`

#### `csv.service.ts`
- **Purpose**: CSV processing service
- **Functions**:
  - `parseCsvHeaders(buffer)`: Parse CSV headers
  - `validateCsvContent(buffer)`: Validate CSV content
- **Features**: CSV validation, header parsing
- **Implementation Pattern**: Service class with CSV utilities

<!-- Removed: server/services/encryption.service.ts (deprecated). Use `@shared/crypto`. -->

#### `supabase.service.ts`
- **Purpose**: Supabase storage service
- **Functions**:
  - `ensureBucketExists()`: Ensure storage bucket exists
  - `uploadFile(path, buffer, contentType)`: Upload file to storage
  - `downloadFile(path)`: Download file from storage
  - `deleteFile(path)`: Delete file from storage
  - `getSignedUrl(path, expiresIn)`: Get signed download URL
- **Features**: File storage operations, signed URLs
 - **Implementation Pattern**: Service class with Supabase storage
  - **Admin (New)**: Uses Service Role key to perform hard delete of auth user: `auth.admin.deleteUser(userId, false)` and verifies via `auth.admin.getUserById(userId)`.

#### `files.service.ts`
#### `jobs.service.ts`
- **Purpose**: Jobs domain use-cases (create, preview, get, control, download, list active/recent)
- **Notable Behavior (Updated)**:
  - If an enriched file path is not yet available and the job is `processing`, `paused`, or `stopped`, a signed URL for the partial CSV is returned when present.
  - If the job is `failed` but a partial CSV exists, a signed URL for the partial is also returned (New), enabling users to retrieve partial results even when the job encountered errors.
  - Completion events are atomic at the DB level: the worker writes `status=completed`, `rowsProcessed=totalRows`, and clears `currentRow` in a single update to avoid UI races.
  - `getLogsDownloadUrl` (New): Returns a signed URL for `enriched/<userId>/<jobId>_logs.txt`; if missing and the job is terminal, assembles logs from DB, uploads TXT to storage, and returns a signed URL.
- **Prompt Validation Enforcement (Updated)**: On `createJob` and `previewJob`, the service loads the file's `columnHeaders` and runs the shared validator against `promptsConfig`.
  - Preview: any validation issues, including header collisions, result in `JOBS_INVALID_INPUT`.
  - Start: only non-collision issues block with `JOBS_INVALID_INPUT`. Header collisions are allowed and recorded as WARN logs indicating that existing input columns will be overwritten.
 - **Preview Response (New)**: `previewJob` returns both `previewData` (row objects) and `detailed` (per-row, per-prompt details with `usedVariables`, filled `systemText`/`promptText`, `response`, and `skipped` flags) to enable the structured preview modal.
- **controlJob Error Details Cleanup (New)**:
  - **Resume**: Clears `errorDetails` when resuming (error resolved or user wants to continue)
  - **Stop**: Clears `errorDetails` when stopping (cleanup)
  - **Pause**: Preserves `errorDetails` if it exists (may have been set by auto-pause)

#### `users.service.ts` (New)
- **Purpose**: Centralized user creation + default template seeding
- **Methods**: `createUserAndSeed({ userId, email, requestId })`
- **Behavior**: Persists the user, then calls `DefaultsSeedingService.seedDefaultsForUser`. Seeding is non-blocking (errors logged) and idempotent (name-based checks).

#### `defaults.seeding.service.ts` (New)
- **Purpose**: Seed per-user default Prompt and System templates
- **Methods**: `seedDefaultsForUser({ userId, requestId? })`
- **Defaults Source**: `shared/defaultTemplates.ts`
- **Backfill**: See `server/scripts/seed-defaults-for-existing-users.ts`

-- **Purpose**: Files domain use-cases (validation, ownership, compensation)
-- **Functions**:
  - `upload({ userId, file, requestId })` (Updated): Stream-parses the uploaded CSV, drops rows where all cells are whitespace/empty, serializes a cleaned CSV with BOM and original headers, uploads the cleaned buffer to storage, and writes DB metadata with the cleaned row count. Compensates storage on DB failure.
  - `getDownloadUrlById({ userId, fileId, requestId })`: Ownership check via repository, returns signed URL JSON
  - `getDownloadUrlForPath({ userId, filePath, requestId })`: Legacy path-based validation + ownership check, returns signed URL JSON
  - `previewFirstRows({ userId, fileId, limit, requestId })`: Streams and returns the first N rows (default 5) with graceful early termination (unpipe + destroy) after N rows; enforces ownership and logs with `requestId`. Uses normalized CSV headers (trim + UTF-8 BOM strip on first header) to align row keys with detected `columnHeaders`.
-- **Features**: Structured logging with `requestId`, strict error codes, upload-time empty-row removal, no controller-side data access
-- **Implementation Pattern**: Orchestrates `supabaseService` and `FilesRepository`

#### `health.service.ts`
- **Purpose**: System health checks encapsulation
- **Functions**:
  - `checkDatabase()`: Database connectivity and pool info
  - `checkStorage()`: Supabase storage upload/delete probe
  - `checkLLMProviders()`: Providers health via `LLMService`
  - `checkWorkerProcesses()`: Job stats via Drizzle (no raw SQL)
  - `checkRealtime()`: DB probe as realtime proxy
  - `determineOverall(components)`: Overall status aggregation
- **Features**: Concurrent-safe checks, Drizzle-based queries, consistent result shape
- **Implementation Pattern**: Service layer consumed by controller

### `/server/`
#### `index.ts`
- **Purpose**: Express server entry point
- **Functions**:
  - `main()`: Server initialization
  - `startServer()`: Start HTTP server
- **Features**: Server setup, middleware registration, error handling
- **Implementation Pattern**: Express server with middleware stack

#### `routes.ts`
- **Purpose**: API route registration
- **Functions**:
  - `registerRoutes(app)`: Register all API routes
- **Features**: Route registration, middleware application
- **Implementation Pattern**: Route registration with middleware

#### `storage.ts`
- **Purpose**: In-memory storage interface
- **Functions**:
  - `StorageInterface`: Storage interface definition
- **Features**: Storage abstraction layer
- **Implementation Pattern**: Interface definition for storage operations

## Worker Directory (`/worker`)

### `/worker/lib/`

#### `supabase.ts`
- **Purpose**: Worker Supabase client
- **Functions**:
  - `supabase`: Supabase client instance
  - `storage`: Storage service instance
  - **Features**: Database access, storage operations
  - **Implementation Pattern**: Supabase client configuration

### `/worker/services/`

#### `job.processor.ts`
- **Purpose**: Background job processing
- **Functions**:
  - `main()`: Main worker loop
  - `processJob(job)`: Process individual job
  - `processRow(job, rowIndex, promptsConfig)`: Process individual row
  - `updateProgress(job, rowsProcessed)`: Update job progress
  - `writePartialOutput(job, data, rowsProcessed)`: Write partial results
  - `claimJob(jobId)`: Claim job for processing
  - `refreshLease(jobId)`: Refresh job lease
  - **Features**: Job processing, row-by-row processing, progress tracking
  - **Implementation Pattern**: Background worker with job queue processing
- **Auto-Pause on Critical Errors (New)**:
  - After LLM call fails, checks `response.categorizedError`
  - If error category requires pause (`shouldPauseOnError()`), attempts to pause job
  - Race condition guard: Pauses when the current DB status is "processing" or "queued" (handles races during claim/first row)
  - Atomic update: Sets status to "paused" and stores error details together
  - Graceful degradation: If pause fails, logs error and continues with `LLM_ERROR` marker (does not fail entire job)
  - Stores first critical error encountered (does not overwrite if error already exists)
  - Error context captured: Row number (1-based), prompt index (0-based), output column name, provider/model, timestamp, full error metadata
  - Completion cleanup: Clears `errorDetails` on successful job completion
- **Row-level error resilience (New)**:
    - Per-row failures no longer fail the entire job. Cells for failed prompts are set to `LLM_ERROR`; unexpected row exceptions mark configured output cells as `ROW_ERROR` and continue.
    - Output columns are pre-initialized for all rows to ensure stable CSV headers in partial files and final output.
    - Partial CSV writes are wrapped in try/catch; failures are logged as WARN and do not change job status.
    - Progress updates and partial writes still occur after row-level exceptions to preserve continuity.
    - Job status remains `processing` during row-level issues; it becomes `stopped` only on explicit user command and `failed` only on unrecoverable job-level exceptions.
- **Per-job, per-prompt deduplication (New)**:
    - For each prompt, identical substituted prompt texts for the same user reuse a single LLM response within the job.
    - Keys are HMAC-SHA256 derived per-user from a stable payload: `{ promptId, provider, modelId, effectiveOptions, normalizedPrompt }`.
    - Dedupe avoids duplicate calls via an in-memory results cache and in-flight suppression for concurrent identical requests.
    - Normalization: trims, converts CR/LF to LF, collapses whitespace around newlines.
    - Observability: emits `DedupeKeyComputed`, `cacheHit`, `inflightHit`, `llmCallStart`, `llmCallEnd`, and a final `DEDUPE_SUMMARY total_planned=… llm_calls_made=… avoided_llm_calls=… unique_keys=… savings_pct=…`.
    - Feature flags: `DQ_PROMPT_DEDUPE=on|off` (default on); `DQ_DEDUPE_SECRET` for HMAC (falls back to `ENCRYPTION_KEY`).
- **CSV encoding & compatibility (New)**:
  - **Iterator Position (New)**: The worker sets `currentRow = rowIndex + 1` at the start of each row and clears it on stop/completion. This provides a stable "now processing" signal distinct from completion. Debug logs include `position_set`, `position_set_out_of_order`, and `position_cleared` markers for observability.
    - Partial and final CSVs are prefixed with a UTF-8 BOM so Excel/Numbers consistently detect UTF-8.
    - If needed, CRLF newlines and an optional Excel separator hint (`sep=,`) can be introduced behind a flag.
  - **Logs Artifact (New)**: On job completion, the worker fetches DB logs for the job, serializes as one line per entry `[ISO] LEVEL message`, and uploads `logs/<userId>/<jobId>.txt` with content-type `text/plain`. The API endpoint returns a signed URL that forces download with filename `<jobId>-logs.txt`. Lazy back-compat: if a legacy `enriched/<userId>/<jobId>_logs.txt` exists, the service migrates it to `logs/` on first request.

#### `llm.service.ts`
- **Purpose**: LLM service integration
- **Functions**:
  - `processPrompt(prompt, rowData, model)`: Process prompt with LLM
  - **Features**: LLM integration, prompt processing
  - **Implementation Pattern**: Service class with LLM providers

### `/worker/`
#### `index.ts`
- **Purpose**: Worker entry point
- **Functions**:
  - `main()`: Worker initialization
  - **Features**: Worker startup, error handling
  - **Implementation Pattern**: Worker process entry point

## Shared Directory (`/shared`)

### `accessibility-validator.ts`
- **Purpose**: Accessibility validation utilities
- **Functions**:
  - `validateAccessibility(component, props)`: Validate component accessibility
  - **Features**: WCAG compliance checking
  - **Implementation Pattern**: Utility functions for accessibility

### `crypto.ts`
- **Purpose**: Encryption utilities
- **Functions**:
  - `encrypt(text, key, context)`: Encrypt text with context
  - `decrypt(encryptedText, key, context)`: Decrypt text with context
  - `generateKey()`: Generate encryption key
  - **Features**: AES-256-GCM encryption, context-aware encryption
  - **Implementation Pattern**: Encryption utility with secure defaults

### `env-validation.ts`
- **Purpose**: Environment variable validation
- **Functions**:
  - `validateEnv()`: Validate environment variables
  - **Features**: Environment validation, startup checks
  - **Implementation Pattern**: Validation utility for environment setup

### `errors.ts`
- **Purpose**: Error taxonomy and handling
- **Functions**:
  - `createError(code, message, statusCode)`: Create structured error
  - **Features**: Error codes, HTTP status mapping
  - **Implementation Pattern**: Error factory with taxonomy

### `llm.ts`
- **Purpose**: Unified LLM service
- **Functions**:
  - `processPrompt(prompt, model, apiKey)`: Process prompt with LLM
  - `createProvider(model, apiKey)`: Create LLM provider
  - **Features**: Multi-provider support, retry logic, error handling
  - **Implementation Pattern**: Service class with provider abstraction

### `llm.errors.ts`
- **Purpose**: LLM error categorization and job error handling
- **Functions**:
  - `categorizeLLMError(error, provider)`: Categorize LLM errors into structured format
  - `shouldPauseOnError(error)`: Determine if error should trigger automatic job pause
  - `buildJobErrorDetails(error, context)`: Build structured error details for job storage
  - `validateJobErrorDetails(details)`: Validate error details structure from database
  - `getLLMErrorCode(error)`: Get short error code for telemetry
  - `shouldRetryWithBackoff(error)`: Determine if error should use exponential backoff
  - `getRetryDelayMs(error, attempt)`: Calculate retry delay in milliseconds
- **Error Categories**: TIMEOUT, RATE_LIMIT, AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED, TOKEN_LIMIT, UNSUPPORTED_PARAMETER, NETWORK_ERROR, SERVER_ERROR, API_ERROR, UNKNOWN
- **Auto-Pause Triggers**: AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED (critical errors requiring user intervention)
- **JobErrorDetails Interface**: Structured error information including category, user/technical messages, row/prompt context, provider/model, timestamp, and metadata
- **Features**: Error categorization, retryability determination, pause detection, error details building and validation
- **Implementation Pattern**: Centralized error handling service with structured error types

### `logger.ts`
- **Purpose**: Structured logging utilities
- **Functions**:
  - `logInfo(message, context)`: Log info message
  - `logWarn(message, context)`: Log warning message
  - `logError(message, context)`: Log error message
  - **Features**: Structured logging, context support
  - **Implementation Pattern**: Logging utility with structured output

### `schema.ts`
- **Purpose**: Database schema definitions
- **Functions**:
  - Database table definitions (users, files, enrichment_jobs, prompt_templates, job_logs)
  - Insert schemas for validation
  - Type definitions for TypeScript
  - **Features**: Drizzle ORM schema, Zod validation
  - **Implementation Pattern**: Schema definition with validation
- **Error Details (New)**: `enrichment_jobs` table includes `errorDetails: jsonb("error_details")` field for storing structured error information when jobs are auto-paused due to critical LLM errors. Nullable for backward compatibility.

### `supabaseStorage.ts`
- **Purpose**: Shared Supabase storage client
- **Functions**:
  - `ensureBucketExists()`: Ensure storage bucket exists
  - `uploadFile(path, buffer, contentType)`: Upload file
  - `downloadFile(path)`: Download file
  - `deleteFile(path)`: Delete file
  - `getSignedUrl(path, expiresIn)`: Get signed URL
  - **Features**: Storage operations, bucket management
 - **Implementation Pattern**: Service class with storage operations
  - **CSV Content-Type (Updated)**: CSV uploads use `text/csv` (no charset parameter). Supabase rejects `text/csv; charset=utf-8` with `invalid_mime_type (415)`. UTF-8 detection is ensured by the worker's BOM prefix on generated CSVs.
  - **Prefix Deletion (New)**: `list(prefix)` and `deleteByPrefix(prefix)` support batch deletion under `uploads/<userId>/`, `enriched/<userId>/`, and `logs/<userId>/`.
  - **Auth Admin (New)**: `deleteAuthUser(userId)` and `authUserExists(userId)` with verbose logs for auditing.

### `utils.ts`
### `csv.ts`
-- **Purpose**: CSV utilities: header normalization, parser factory, and serialization
-- **Functions**:
  - `normalizeHeaderValue(header, isFirstHeader)`: Trim header and remove UTF-8 BOM from first header, preserving case
  - `createNormalizedCsvParser()`: Returns `csv-parser` instance configured to normalize headers
  - `serializeRowsToCsv(rows, headers?, includeBom=true)` (New): Serializes rows to CSV with stable header order, escaping, and optional BOM. Used by upload-time cleaning and worker partial/final writes.
-- **Features**: Ensures preview/worker keys match metadata and enables stable, standards-compliant CSV output
-- **Implementation Pattern**: Shared utility consumed by server services and worker
- **Purpose**: Utility functions
- **Functions**:
  - `substituteVariables(text, row)`: Substitute variables in text
  - `extractVariables(text)`: Extract `{{variable}}` tokens using the same semantics as substitution
  - `composeAutocompleteSuggestions(headers, outputColumns)`: Compose autocomplete suggestions
  - **Features**: Variable extraction/substitution, autocomplete support
  - **Implementation Pattern**: Pure utility functions

### `promptValidation.ts` (New)
- **Purpose**: Shared prompt configuration validator used by both client (preflight) and server (enforcement)
- **Functions**:
  - `validatePrompts(prompts, inputHeaders)`: Returns `{ ok, issues[] }` where each issue has `type`, `promptIndex`, `message`, and structured `details`.
 - **Checks**: Unknown variables, future references (order), duplicate outputs, output/header collisions, self-references (a prompt referencing its own `outputColumnName`), and missing required fields.
- **Semantics**: Exact, case-sensitive `{{variable}}` parsing, mirroring `substituteVariables` behavior.

### `errors.ts` / `server/utils/http-error-map.ts` (Updated)
- **Behavior**: Known error codes return cataloged HTTP status/messages; when errors include `details`, the mapper passes them through so clients can show structured validation issues.
## Migrations Directory (`/migrations`)

### `0000_breezy_starhawk.sql`
- **Purpose**: Initial database schema setup
- **Features**: Core tables creation, initial structure
- **Implementation Pattern**: Database migration with table definitions

### `0001_phase5_lease_and_partial.sql`
- **Purpose**: Job leasing and partial results support
- **Features**: Job leasing mechanism, partial output handling
- **Implementation Pattern**: Database migration for job processing features

### `0002_phase6_realtime_rls.sql`
- **Purpose**: Real-time support and row-level security
- **Features**: Real-time subscriptions, RLS policies
- **Implementation Pattern**: Database migration for real-time features

### `0003_phase7_history_delete.sql`
- **Purpose**: History deletion and storage cleanup
- **Features**: Cascade deletion, foreign key constraints
- **Implementation Pattern**: Database migration for cleanup operations

### `0006_job_error_details.sql` (New)
- **Purpose**: Add error_details JSONB column for auto-pause error storage
- **Features**: Nullable column for backward compatibility, stores structured error information when jobs are auto-paused due to critical LLM errors
- **Implementation Pattern**: Idempotent migration using `IF NOT EXISTS` pattern

## Uploads Directory (`/uploads`)

### `/uploads/uploads/`
- **Purpose**: File upload storage directory
- **Features**: User-specific upload folders, file organization
- **Implementation Pattern**: File system storage with UUID-based organization

## Attached Assets Directory (`/attached_assets`)

### Purpose
- **Documentation**: Project documentation and design guides
- **Logs**: Application logs and debug information
- **Images**: Screenshots and visual assets not directly imported by the front-end
- **CSV Files**: Sample data and test files
- **Implementation Pattern**: Asset storage for project documentation and testing (frontend imports use the `Media` directory via the `@assets` alias)

## Implementation Patterns

### State Management
- **React Query**: Server state management for API calls
- **React Context**: Global state (authentication, notifications)
- **Local State**: Component-specific state with useState
- **Real-time State**: Supabase real-time subscriptions

### Error Handling
- **Error Boundaries**: React error boundaries for component errors
- **Structured Errors**: Consistent error taxonomy with codes
- **Toast Notifications**: User-friendly error display
- **Logging**: Structured logging with context

### Authentication
- **Supabase JWT**: JWT-based authentication
- **Context Provider**: Authentication state management
- **Middleware**: Server-side authentication validation
- **Real-time**: Authenticated real-time subscriptions

### Data Flow
- **Upload → Process → Monitor → Download**: Main data enrichment flow
- **Real-time Updates**: Live progress and status updates
- **Optimistic Updates**: Immediate UI feedback
- **Error Recovery**: Graceful error handling and recovery

### API Design
- **RESTful Endpoints**: Standard HTTP methods and status codes
- **Request Validation**: Zod schema validation
- **Response Formatting**: Consistent JSON response structure
- **Error Handling**: Structured error responses with codes

### Database Operations
- **Drizzle ORM**: Type-safe database operations
- **Migrations**: Versioned database schema changes
- **Row Level Security**: User data isolation
- **Real-time**: Database change subscriptions

### File Processing
- **Streaming**: Efficient file processing
- **Validation**: Content and format validation
- **Storage**: Secure file storage with access control
- **Progress Tracking**: Real-time processing progress

### Security
- **API Key Encryption**: AES-256-GCM encryption
- **JWT Validation**: Secure token validation
- **Input Validation**: Comprehensive input sanitization
- **Access Control**: User data isolation and permissions

#### Database TLS (Supabase SSL-only) – verify-full
- **Requirement**: When Supabase enforces SSL-only, set `sslmode=verify-full` on `DATABASE_URL`.
  - Example: `postgresql://USER:PASSWORD@HOST:5432/db?sslmode=verify-full`
  - If your URL already has other params, append with `&sslmode=verify-full`.
- **CA handling (preferred via env, no files in git)**:
  - `DATABASE_CA_CERT_B64` (preferred): Base64-encoded contents of the Supabase CA PEM.
  - `DATABASE_CA_CERT_PATH` (optional): Filesystem path to the CA PEM (useful locally).
- **Runtime behavior**:
  - Server and Worker load the CA from `DATABASE_CA_CERT_PATH` (if present) else from `DATABASE_CA_CERT_B64`, else rely on the system trust store.
  - TLS is always enforced with `rejectUnauthorized: true`.
  - Startup logs (non-sensitive) indicate `sslMode` and CA source: `"path" | "env_b64" | "system_ca"`.
- **Drizzle CLI / migrations**:
  - Drizzle reads `DATABASE_URL` and will typically verify using the system trust store.
  - If verify-full fails in your environment, set `NODE_EXTRA_CA_CERTS=/path/to/supabase-ca.pem` when invoking CLI commands (materialize from `DATABASE_CA_CERT_B64` if needed).
- **Replit deployment**:
  - Add `DATABASE_URL` with `?sslmode=verify-full` to Replit Secrets.
  - Add `DATABASE_CA_CERT_B64` to Replit Secrets with the base64 of your Supabase CA PEM.
  - No certificates are committed to the repository. 

### Development Workflow
- **Scripts**: Automated development and production startup
- **Environment Validation**: Pre-flight environment checks
- **Linting**: Code quality and formatting enforcement
- **Type Safety**: Comprehensive TypeScript integration
- **Component Library**: Shadcn/UI component system
- **Styling**: Tailwind CSS with custom design system

### Testing Strategy
- **Integration Tests**: End-to-end API validation
- **Unit Tests**: Individual component and service testing
- **Crypto Tests**: Encryption/decryption validation
- **CSV Tests**: File processing validation
- **Resume Tests**: Job state management validation
- **Cascade Tests**: Database constraint validation
- **Error Pause Tests (New)**: Comprehensive test suite for auto-pause on critical LLM errors
  - `shared/llm.errors.test.ts`: Error categorization and validation (30+ test cases)
  - `server/repositories/jobs.repository.error-pause.test.ts`: Repository atomic updates (8+ test cases)
  - `server/services/jobs.service.error-pause.test.ts`: Service layer cleanup (5+ test cases)
  - `worker/services/job.processor.error-pause.test.ts`: Worker auto-pause logic (10+ test cases)
  - `client/src/hooks/useRealtimeJob.error-pause.test.ts`: Real-time integration (4+ test cases)
  - `client/src/components/core/JobErrorModal.error-pause.test.ts`: UI component validation (5+ test cases)
  - `tests/e2e/error-pause.e2e.test.ts`: E2E tests with real API errors (3 test scenarios)
  - Run all: `npm run test:error-pause`

### Controller → Service → Repository Separation (New)
- **Why**: Reduce coupling, improve testability, and limit blast radius of changes. Controllers only handle HTTP, services own use-cases and authorization, repositories encapsulate Drizzle queries.

- **Controller (HTTP)**
  - Parse/validate request, extract auth, pass `requestId` downstream
  - Call one service method
  - Map domain/validation errors via `server/utils/http-error-map.ts`
  - Return shaped HTTP response

- **Service (Use-case orchestration)**
  - Enforce ownership and domain rules
  - Coordinate repositories and side-effects
  - Own transactions/compensations where needed
  - Log with `requestId` for correlation

- **Repository (Data access)**
  - Isolate Drizzle queries against `shared/schema.ts`
  - No business logic

#### Templates Domain: Refactor Completed
- Files added:
  - `server/repositories/templates.repository.ts`: create/list/get/update/delete for `prompt_templates`
  - `server/services/templates.service.ts`: `createTemplate`, `listTemplates`, `updateTemplate`, `deleteTemplate`
  - `server/utils/http-error-map.ts`: domain-agnostic mapper; Zod → 400 with code, known codes → catalog
- Controller updated:
  - `server/controllers/templates.controller.ts` now calls `TemplatesService` and passes `requestId`
- Error catalog additions:
  - `TEMPLATES_INVALID_INPUT`, `TEMPLATES_NOT_FOUND`
- Logging:
  - Service logs include `requestId` so controller/service lines correlate per request

#### Jobs Domain: Refactor In-Progress
#### Jobs Domain: Refactor Complete
- **Files added/updated**:
  - `server/repositories/jobs.repository.ts`: active job lookup, file ownership check, create job, insert log, get job, get logs asc, update job status, get user, `updateJobStatusWithError` (atomic update of status and error details), `updateJobStatusAndClearError` (atomic update clearing error details)
  - `server/services/jobs.service.ts`: `createJob`, `previewJob`, `getJob`, `controlJob`, `getDownloadUrl` with validation and `requestId` logs
  - `server/controllers/jobs.controller.ts`: all endpoints call `JobsService` and map errors via `server/utils/http-error-map.ts`
- **Error catalog additions**: `JOBS_INVALID_INPUT` (400)
- **Realtime and UI hydration improvements**:
  - `client/src/hooks/useRealtimeJob.ts`: on SUBSCRIBED and on CLOSED, triggers a final refetch of `/api/jobs/:jobId` to hydrate any logs that may have been missed around channel lifecycle
  - `client/src/pages/Dashboard.tsx`: light polling (5s) only while job is not terminal; stops after completion/failed/stopped
  - `Sync Jobs` now uses `apiRequest` helper to include Authorization header (fixes 401 during debug sync)

### Controller Layer Finalization
- All controllers pass `requestId` into services for log correlation.
- Controllers keep HTTP-only responsibilities (parse, Zod validate, auth checks, error mapping) and no longer call Drizzle or Supabase directly.
- Files, History, Jobs, Templates, and Auth controllers now delegate to their respective services consistently.
- Legacy code removed: direct DB access in controllers, deprecated encryption service (use `@shared/crypto`).
