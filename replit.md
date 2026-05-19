# DataQuilt

## Overview

DataQuilt is a web application that enables users to enrich CSV data using multiple LLM providers (OpenAI, Google Gemini, Perplexity, and DeepSeek). The platform provides secure Google OAuth authentication, real-time job processing with live progress tracking, and a template system for reusable prompts with variable substitution. Users can upload CSV files, configure AI prompts that reference column values, chain outputs from previous prompts, and download enriched results—all with AES-256-GCM encrypted API key storage and comprehensive error handling.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Three-Tier Architecture

**Presentation Layer (React SPA)**
- React 18 with TypeScript and Vite for fast development
- Tailwind CSS + Shadcn/UI (Radix UI primitives) for accessible, professional design
- Wouter for lightweight client-side routing
- TanStack Query for server state management
- Google Analytics for user behavior tracking

**Application Layer (Express.js API)**
- Express.js with TypeScript for type-safe API development
- Middleware-based request processing with authentication, request ID tracking, and structured logging
- Controller → Service → Repository architecture for clean separation of concerns
- Comprehensive error handling with categorized error taxonomy and HTTP mapping

**Data Layer (PostgreSQL + Supabase + Workers)**
- PostgreSQL with Drizzle ORM for type-safe database operations
- Supabase for authentication (Google OAuth), storage (CSV files), and real-time updates
- Background worker processes for asynchronous job processing with job leasing
- Neon Database for production PostgreSQL hosting

### Security Architecture

**API Key Encryption**
- User-provided LLM API keys encrypted at rest using AES-256-GCM
- Shared crypto module (`shared/crypto.ts`) with 32-byte encryption key from environment
- Keys encrypted with provider name as additional authenticated data (AAD)
- Format: `iv:tag:ciphertext` as base64 strings

**Authentication Flow**
- Google OAuth 2.0 via Supabase Auth (client-side)
- JWT token verification on server using Supabase JWT secret
- Middleware extracts userId from verified token for all authenticated routes
- No server-side login endpoint; authentication handled entirely by Supabase

**Authorization**
- Row-level security: all database queries filtered by authenticated userId
- File access control: storage paths include userId, downloads verified against ownership
- Job access control: users can only view/control their own enrichment jobs

### LLM Integration Architecture

**LangChain Foundation**
- All providers use LangChain chat models for standardized integration
- Curated model registry with explicit modelId validation (no provider defaults)
- Consistent message structure: SystemMessage (optional) + HumanMessage
- Unified error categorization across providers (11 categories: timeout, rate limit, auth error, quota exceeded, content filtered, etc.)

**Provider Implementations** (verified 2026-05-17; package versions in `package.json`)
- **OpenAI**: `ChatOpenAI` from `@langchain/openai` v1.x — models include `gpt-5.5`, `gpt-5.5-pro` (Responses API only), `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5`, `gpt-5-mini`, `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`.
- **Anthropic**: `ChatAnthropic` from `@langchain/anthropic` v1.x — models include `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`; older 4.5 and 3.5 IDs retained as `deprecated: true`; Claude 3 base IDs removed.
- **Google Gemini**: `ChatGoogleGenerativeAI` from `@langchain/google-genai` v2.x — primary lineup `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`; the Gemini 2.x family is retained as `deprecated: true` until users migrate.
- **Perplexity**: `ChatPerplexity` from `@langchain/community` v1.x — models `sonar`, `sonar-pro`, `sonar-reasoning-pro` (the non-pro `sonar-reasoning` was retired by Perplexity).
- **DeepSeek**: OpenAI-compatible via `ChatOpenAI` with `baseURL: https://api.deepseek.com` — models `deepseek-v4-flash`, `deepseek-v4-pro`. The legacy `deepseek-chat` / `deepseek-reasoner` aliases were dropped (they end-of-life on 2026-07-24).

The canonical allowlist lives in `shared/llm.models.ts`. A `deprecated: boolean` flag on `ModelEntry` marks models that remain selectable for backward compatibility but should not be the default for new prompts.

**Capability-Based Parameter Sanitization**
- Each model has capability metadata in `shared/llm.capabilities.ts` (supports temperature, top-p, reasoning effort, thinking, etc.). DeepSeek V4 gained its own capability map; OpenAI GPT-5.5-pro is correctly routed to the Responses API surface.
- Provider-specific sanitization functions strip unsupported parameters before API calls — prevents "unsupported parameter" errors and enables model-specific features (reasoning effort for GPT-5.x / GPT-5.5, extended thinking for Claude 4.x, thinking toggle for DeepSeek V4).

**Per-Prompt Thinking / Reasoning Controls**
- `promptTemplates` rows and per-prompt entries inside `enrichmentJobs.promptsConfig` carry optional `thinkingMode` (`auto` | `on` | `off`) and `thinkingEffort` (`low` | `medium` | `high`) fields.
- The PromptManager UI surfaces these controls when the selected model has `reasoningCapable: true`.
- `LLMService` translates the user's intent into provider-specific payloads (OpenAI `reasoning.effort`, Anthropic `thinking: { type: "enabled", budget_tokens }`, DeepSeek `thinking: true`).

### Job Processing Architecture

**Worker-Based Processing**
- Dedicated background worker process (`worker/index.ts`) runs independently from API server
- Job leasing system prevents concurrent processing and enables stuck job recovery
- Lease expiration time (default 30 minutes) allows reclaiming jobs if worker crashes
- Worker continuously polls for queued/paused jobs, acquires lease, processes rows, releases lease

**Real-Time Updates**
- Supabase Realtime subscriptions for live job status updates
- Client subscribes to job changes on dashboard, receives instant progress updates
- Database triggers (if configured) or manual updates push changes to connected clients

**Error Handling and Auto-Pause**
- Critical LLM errors (auth error, quota exceeded, content filtered) trigger automatic job pause
- Structured error details stored in database with row/prompt context
- Error modal displays user-friendly message with actionable guidance
- Transient errors (rate limit, timeout, network, server 5xx) handled with retry logic

### Data Flow Architecture

**CSV Upload → Processing → Download**
1. Client uploads CSV via multipart form data
2. Server validates format, normalizes headers (trim + BOM strip)
3. File stored in Supabase Storage at `{userId}/{timestamp}-{originalName}`
4. Metadata (row count, column headers) saved to `files` table
5. User configures prompts with variable substitution (`{{column_name}}`)
6. Job created with prompts config, status set to "queued"
7. Worker processes rows sequentially, substitutes variables, calls LLM
8. Enriched data written to new CSV file in storage
9. Job status updated to "completed" with enriched file path
10. User downloads enriched CSV via signed URL

**Prompt Chaining**
- Prompts executed in order; later prompts can reference earlier outputs
- Variable substitution includes both original CSV columns and prior output columns
- Validation ensures no forward references (prompt cannot use output from future prompt)
- "Skip if output exists" toggle allows resuming interrupted jobs without re-processing

### Database Schema

**Core Tables**
- `users`: userId (UUID), email, createdAt, llmApiKeys (encrypted JSONB)
- `files`: fileId (UUID), userId (FK), storagePath, originalName, rowCount, columnHeaders (JSONB), createdAt
- `enrichment_jobs`: jobId (UUID), userId (FK), fileId (FK), status (enum), promptsConfig (JSONB), totalRows, rowsProcessed, currentRow, enrichedFilePath, leaseExpiresAt, createdAt, finishedAt, errorMessage, errorDetails (JSONB)
- `prompt_templates`: templateId (UUID), userId (FK), name, systemText, promptText, provider, modelId, createdAt, updatedAt
- `system_templates`: templateId (UUID), userId (FK), name, systemText, createdAt, updatedAt

**Design Decisions**
- JSONB for flexible schema (prompts config, API keys, column headers, error details)
- UUID primary keys for security (non-enumerable)
- Foreign key constraints enforce referential integrity
- Timestamps with timezone for audit trails
- Enum types for status fields (type safety)

### State Management

**Client-Side State**
- TanStack Query for server state (files, jobs, templates, user session)
- React Context for authentication state (user, session, login/logout)
- Local component state for UI interactions (file upload, prompt editing)
- Query invalidation on mutations ensures fresh data after updates

**Server-Side State**
- Stateless HTTP API (no sessions, no cookies)
- Database as source of truth for all persistent state
- Worker maintains in-memory state for current job lease only
- Supabase Realtime for cross-client state synchronization

### Performance Optimizations

**Database Connection Pooling**
- Single shared connection with max pool size 1 (serverless environment)
- SSL/TLS enforcement with optional custom CA certificate
- Connection validation on startup with structured logging

**CSV Processing**
- Streaming CSV parsing with `csv-parser` for memory efficiency
- Normalized header handling (trim, BOM strip) prevents key mismatches
- Row-by-row processing to handle large files without memory exhaustion

**Frontend Bundling**
- Vite for fast HMR and optimized production builds
- Code splitting with dynamic imports for large dependencies
- Tree shaking removes unused code from final bundle

### Deployment Architecture

**Environment Requirements**
- Node.js 20+ runtime
- PostgreSQL database (Supabase/Neon recommended)
- Supabase project for auth and storage
- Encryption key (32-byte base64-encoded string)
- Optional: LLM provider API keys (users can add their own)

**Process Model**
- Single API server process (Express.js)
- Separate worker process for background jobs
- Both processes validate environment on startup
- Graceful shutdown handlers for SIGINT/SIGTERM

**Replit Integration**
- Development scripts run both API and worker with `tsx`
- Vite plugin for runtime error overlay and Cartographer
- Build process compiles server with esbuild, client with Vite
- Production mode runs compiled JavaScript with `node`

## External Dependencies

### Core Services

**Supabase Platform**
- Purpose: Backend-as-a-Service for auth, storage, and real-time
- Features: Google OAuth, JWT tokens, file storage with signed URLs, real-time database subscriptions
- Configuration: Project URL, anon key, service role key, JWT secret

**Database (PostgreSQL)**
- Provider: Neon Database (serverless Postgres)
- ORM: Drizzle ORM for type-safe queries
- Migrations: Drizzle Kit with push-based schema sync
- SSL: Enforced with optional custom CA certificate

### LLM Providers

**OpenAI API**
- Active models: GPT-5.5, GPT-5.5 Pro (Responses API only), GPT-5.4-mini, GPT-5.4-nano, GPT-5, GPT-5-mini, GPT-4o, GPT-4o-mini, GPT-4.1, GPT-4.1-mini
- Integration: LangChain's `ChatOpenAI` v1.x
- Features: Chat completions; reasoning-effort control surfaced for GPT-5.x and GPT-5.5 line via per-prompt `thinkingMode`/`thinkingEffort`

**Anthropic API**
- Active models: Claude Opus 4.7 (`claude-opus-4-7`), Claude Sonnet 4.6 (`claude-sonnet-4-6`), Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- Legacy (kept selectable as `deprecated: true`): Claude Sonnet 4.5, Claude 3.5 Sonnet, Claude 3.5 Haiku
- Integration: LangChain's `ChatAnthropic` v1.x
- Features: Extended thinking on 4.x (`thinking: { type: "enabled", budget_tokens }`) surfaced via per-prompt `thinkingMode`/`thinkingEffort`

**Google Gemini API**
- Active models: Gemini 3.1 Pro Preview, Gemini 3 Flash Preview, Gemini 3.1 Flash-Lite Preview
- Legacy (`deprecated: true`): Gemini 2.5 Pro, 2.5 Flash, 2.5 Flash-Lite, 2.0 Flash
- Integration: LangChain's `ChatGoogleGenerativeAI` v2.x
- Features: Multimodal capabilities; Gemini 3.x defaults thinking on

**Perplexity API**
- Active models: Sonar, Sonar Pro, Sonar Reasoning Pro
- Integration: LangChain Community's `ChatPerplexity` v1.x
- Features: Real-time web search, online research capabilities. The non-pro `sonar-reasoning` and the more expensive `sonar-deep-research` are not in the registry today (see archived plan).

**DeepSeek API**
- Active models: DeepSeek V4 Flash (`deepseek-v4-flash`), DeepSeek V4 Pro (`deepseek-v4-pro`) — both support dual thinking/non-thinking modes via a request parameter and a 1M context window
- Integration: OpenAI-compatible endpoint via `ChatOpenAI` with `baseURL: https://api.deepseek.com`; thinking flag plumbed through `modelKwargs.thinking`
- Features: Hybrid thinking/non-thinking, cost-effective. Legacy `deepseek-chat`/`deepseek-reasoner` aliases end-of-life on 2026-07-24 and are not in the registry.

### Development Tools

**Build and Bundling**
- Vite: Frontend build tool with HMR and optimized production builds
- esbuild: Fast TypeScript/JavaScript bundler for server code
- tsx: TypeScript execution for development and scripts
- PostCSS + Autoprefixer: CSS processing with vendor prefixes

**Type Safety**
- TypeScript: End-to-end type safety across client, server, shared, and worker
- Drizzle Zod: Schema-driven validation with Zod integration
- Zod: Runtime validation for API inputs and environment variables

**Code Quality**
- ESLint: Linting with TypeScript and React rules
- Prettier: Code formatting with consistent style
- Secretlint: Secret detection in codebase

### Third-Party Libraries

**UI Components**
- Radix UI: Accessible component primitives (dialog, dropdown, tooltip, etc.)
- Shadcn/UI: Pre-styled components built on Radix
- Tailwind CSS: Utility-first CSS framework
- class-variance-authority: Component variant styling
- Lucide React: Icon library

**Data Handling**
- csv-parser: Streaming CSV parsing
- papaparse: CSV serialization and parsing
- TanStack Query: Server state management with caching

**Utilities**
- nanoid: Unique ID generation for request tracking
- date-fns: Date formatting and manipulation
- clsx: Conditional class name composition