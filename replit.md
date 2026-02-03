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

**Provider Implementations**
- **OpenAI**: `ChatOpenAI` from `@langchain/openai` (models: gpt-5, gpt-5-mini, gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini)
- **Google Gemini**: `ChatGoogleGenerativeAI` from `@langchain/google-genai` (models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash)
- **Perplexity**: `ChatPerplexity` from `@langchain/community` (models: sonar, sonar-pro, sonar-reasoning, sonar-reasoning-pro)
- **DeepSeek**: OpenAI-compatible via `ChatOpenAI` with custom baseURL (models: deepseek-chat, deepseek-reasoner)

**Capability-Based Parameter Sanitization**
- Each model has capability metadata (supports temperature, top-p, reasoning effort, etc.)
- Provider-specific sanitization functions strip unsupported parameters before API calls
- Prevents "unsupported parameter" errors and enables model-specific features (e.g., reasoning effort for GPT-5)

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
- Models: GPT-5, GPT-5-mini, GPT-4o, GPT-4o-mini, GPT-4.1, GPT-4.1-mini
- Integration: LangChain's `ChatOpenAI` with OpenAI SDK
- Features: Chat completions, reasoning effort for newer models

**Google Gemini API**
- Models: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.0 Flash
- Integration: LangChain's `ChatGoogleGenerativeAI`
- Features: Multimodal capabilities, thinking mode for reasoning models

**Perplexity API**
- Models: Sonar, Sonar Pro, Sonar Reasoning, Sonar Reasoning Pro
- Integration: LangChain Community's `ChatPerplexity`
- Features: Real-time web search, online research capabilities

**DeepSeek API**
- Models: DeepSeek Chat (V3.1), DeepSeek Reasoner (V3.1)
- Integration: OpenAI-compatible endpoint via `ChatOpenAI` with custom baseURL
- Features: Chat and reasoning modes, cost-effective alternative

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