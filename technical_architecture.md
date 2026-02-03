# Technical Architecture: High-Level Overview & Separation of Concerns

This document provides a high-level architectural overview of the Oracle MVP system, focusing on system design principles, separation of concerns, and architectural patterns. For detailed implementation references, see `index.md`. For technical specifications, see `Blueprint.md`.

## System Architecture Overview

The Oracle MVP follows a **three-tier architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                       │
│                    (React SPA + UI Components)                 │
├─────────────────────────────────────────────────────────────────┤
│                        Application Layer                        │
│                   (Express API + Business Logic)               │
├─────────────────────────────────────────────────────────────────┤
│                        Data Layer                              │
│              (PostgreSQL + Supabase + Background Workers)      │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### **Frontend Technologies**
- **React 18**: Component-based UI framework with hooks
- **TypeScript**: Type-safe JavaScript development
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/UI**: Component library built on Radix UI primitives
- **Wouter**: Lightweight routing solution
 - **Google Analytics**: User behavior tracking and analytics (Tracking ID: G-MGJTE79PH3)
 - **Footer (New)**: First‑party “Buy me a coffee” CTA and mail icon; we intentionally avoid third‑party widget scripts that rely on `document.write` to ensure reliability in a SPA and to reduce ad‑blocker interference.
 - **Skip Toggle (New)**: Dashboard includes a global "Skip if output exists" toggle with tooltip. When enabled, preview and processing skip generating values for cells that already contain a value (including input/output name collisions). Error markers (LLM_ERROR/ROW_ERROR) and NA/N\A are treated as empty.

### **Backend Technologies**
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **TypeScript**: Type-safe server-side development
- **Drizzle ORM**: Type-safe database operations

### **Database & Storage**
- **PostgreSQL**: Primary database with ACID compliance
- **Supabase**: Backend-as-a-Service platform
- **Supabase Auth**: Authentication and authorization
- **Supabase Storage**: File storage with access control
- **Supabase Realtime**: Real-time database subscriptions

### **AI & LLM Integration**
- **LangChain**: Core framework for LLM integration and orchestration
- **OpenAI API**: GPT models via LangChain providers with curated model registry and explicit modelId selection
- **Google Gemini API**: Gemini models via LangChain providers with curated model registry and explicit modelId selection
- **Perplexity API**: Sonar models via LangChain providers with curated model registry and explicit modelId selection
- **DeepSeek API (New)**: OpenAI-compatible API via LangChain `ChatOpenAI` using `baseURL: https://api.deepseek.com`; supports `deepseek-chat` (non-thinking) and `deepseek-reasoner` (thinking). See [DeepSeek API Docs](http://api-docs.deepseek.com/).
- **Anthropic API (New)**: Claude models via LangChain `ChatAnthropic` with a curated allowlist (e.g., `claude-sonnet-4-5-20250929`, `claude-3-5-sonnet-latest`).

### **State Management & Data Fetching**
- **TanStack Query**: Server state management and caching
- **React Context**: Global state management
- **React Hooks**: Custom hooks for business logic

### **Development & Build Tools**
- **ESLint**: Code linting and quality enforcement
- **Prettier**: Code formatting
- **esbuild**: Fast JavaScript bundler for production builds

## Core Architectural Principles

### 1. **Separation of Concerns**
- **Frontend**: Pure presentation and user interaction
- **Backend**: Business logic and data validation
- **Worker**: Asynchronous processing and background tasks
- **Shared**: Common utilities and type definitions

### 2. **Event-Driven Architecture**
- **Real-time Updates**: Supabase real-time for live data synchronization
- **Asynchronous Processing**: Background workers for long-running tasks
- **Event Sourcing**: Job logs and progress tracking

### 3. **Microservices Pattern**
- **API Services**: RESTful endpoints for different domains
- **Background Workers**: Independent processing units
- **Shared Libraries**: Common functionality across services

### 4. **Security-First Design**
- **Authentication**: Supabase JWT with server-side validation
- **Authorization**: Row-level security and user isolation
- **Data Protection**: Encryption at rest for sensitive information

## Layer Responsibilities

### Presentation Layer (Client)

#### **Component Architecture**
- **Atomic Design**: Reusable UI components with clear interfaces
- **State Management**: React Query for server state, Context for global state
- **Real-time Integration**: WebSocket-like subscriptions for live updates

#### **User Experience Patterns**
- **Error Boundaries**: Graceful error handling and recovery
- **Loading States**: Clear feedback during async operations
- **Toast Notifications**: User feedback and error display
- **Responsive Design**: Mobile-responsive layout with breakpoint detection
- **Device‑Aware Pickers (New)**: A shared `useDevicePicker` hook centralizes how UI pickers open depending on viewport. Desktop uses Radix Popovers; mobile uses a centered modal. Components rely on a single `open(index)/close()` API and bind the desktop slice to Popovers. This avoids duplicate triggers and double‑open states across layouts.
- **Microcopy Centralization (New)**: All page copy is sourced from a centralized registry `client/src/lib/microcopy.ts` (`MC.*`). Dashboard uses `MC.dashboard.*`, the Homepage uses `MC.homepage.*`, `/how-it-works` uses `MC.howItWorksPage.*`, and the Templates page uses `MC.templatesPage.*`. Pages continue to own structure and headings; reusable components do not render page‑level section titles.
- **Preview Modal UX (Updated)**: The preview modal shows tabs for the first two rows, an “Original Data” table listing the union of variables used across prompts (with Origin = CSV or AI Response Column), and per‑prompt accordions (opened by default) that display the filled System/User messages and the response labeled by `outputColumnName`. Typography and spacing are relaxed for readability.
 - **How It Works Page (Updated)**: Full-featured `/how-it-works` page with:
   - A new intro section “DataQuilt vs LLMs” explaining when to use DataQuilt
   - A dynamic Steps section (now 6 items, including step 3.5 for chaining) where steps may optionally have a video
   - Sticky sidebar navigation (via `useScrollSpy`) with nested subsections, including API Keys sub-items (4.1–4.5)
   - Reusable information components (ExampleBlock, TipBlock, CalloutBlock). Example/Tip text uses darker `text-gray-800` at `text-sm` for reduced glare; Example preserves newlines (`whitespace-pre-line`)
   - Help tips on steps reuse the shared `HelpTip` (hover tooltip + click popover)
   - API Keys “Get your keys” and “Usage & costs” are displayed as minimal tables instead of cards
   - Section headers rendered with the shared `SectionHeader` accent band for visual consistency; the vs‑LLMs section adds extra spacing between header/subheader/body
   - Readability: page wraps content in `.howitworks-page` which maps `.oracle-muted` to `--oracle-muted-strong`, darkening body copy only on this page
   - Compact vertical rhythm using shared spacing tokens; single‑column paragraphs are allowed to span full width

#### **Accessibility & Mobile Support**
- **Accessibility Guidelines**: WCAG 2.1 AA compliance framework
- **Mobile Detection**: `useIsMobile` hook for responsive behavior
- **Component Validation**: Accessibility validation utilities in shared library
- **Responsive Components**: Sidebar and layout components with mobile considerations
  - **API Keys Grid (Updated)**: The API keys provider status cards use a responsive grid: 1 column on extra narrow, 2 on small/mobile, 3 on tablet, and 4 on desktop so all four providers appear in one row on larger screens.

### Prompt Manager Interaction Patterns
- **Load Template Popover**: The “Load Template” button opens a per-prompt popover that lazy-loads templates. Selecting an item applies the template only to that prompt (updates prompt text, output column, and model) and preserves the order of prompts. On mobile, this action opens a centered modal; on desktop, it opens a Popover anchored to the header button via `useDevicePicker`.
- **Responsive Actions (Updated)**: System/User action rows are rendered as a 3‑column grid (Add Variable, Load, Save). Global Button defaults allow wrapping & auto‑height; we also use the `stackOnNarrow` variant to stack icon above label on narrow screens (≤420px). Button order is enforced via grid ordering so Load precedes Save consistently.

#### Global Button Defaults (New)
- Base Button now wraps text and grows in height (`h-auto`, `min-h-9`, `whitespace-normal`, `break-words`, centered text).
- Variants:
  - `stackOnNarrow`: stacks icon over label on narrow screens.
  - `size=compact`: reduced padding for dense layouts.
- **Add Variable Popover**: The “Add Variable” button opens a per-prompt popover listing available variables (union of CSV column headers and current output columns). Selecting inserts a `{{variable}}` token at the caret in the textarea.

- **Stable Keys (Updated)**: Each prompt has a client-only `localId` used as the React key for stable identity across add/remove operations. This identifier is generated by `generateLocalId()` and is created consistently via the shared factory `createEmptyUiPrompt()` in `client/src/lib/uiPrompts.ts`. The `localId` is stripped out before preview/create API calls.
- **Save Template (Per-Prompt)**: Saving a template operates on the specific prompt row; only that prompt’s configuration is persisted as a reusable template. If the template popover is already loaded, the list is refreshed after a successful save.
#### Button Placement (Updated)
- **Desktop**: “Load/Save System” sit above the System Message textarea (right‑aligned). “Save/Load Template” sit above the User Message textarea (right‑aligned).
- **Mobile**: The same actions render inline on the corresponding header rows. The earlier mobile‑only button rows were removed to reduce duplication.
 - **Preflight Validation (Updated)**: On Preview/Start, the client runs a shared validator that enforces exact, case-sensitive `{{variable}}` references to CSV headers or prior outputs, flags future prompt references, prevents duplicate output columns, and detects output/header collisions. Preview blocks on collisions; Start shows a confirmation dialog allowing the user to proceed and overwrite existing input columns.

### Application Layer (Server)

#### **API Design Patterns**
- **RESTful Architecture**: Standard HTTP methods and status codes
- **Resource-Oriented**: Clear resource hierarchy and relationships
- **Stateless Design**: No server-side session state
- **Request Correlation**: Unique request IDs for tracking and debugging

#### **Middleware Architecture**
- **Authentication**: JWT validation and user context
- **Request Processing**: Logging, validation, and error handling
- **CORS & Security**: Cross-origin and security headers
- **Request ID Generation**: Unique identifiers for request tracking

#### **Business Logic Separation**
- **Controllers**: HTTP-only concerns (parse, validate, map errors, pass `requestId`), no direct DB/Storage
- **Services**: Domain orchestration (ownership checks, workflows, compensation), logging with `requestId`
- **Repositories**: Drizzle queries isolated per domain (`JobsRepository`, `FilesRepository`, `UsersRepository`, `PromptTemplatesRepository`)
- **Validation**: Zod schemas at controller boundary; domain rules in services
- **Error Handling**: `mapErrorToHttp` translates Zod to domain `*_INVALID_INPUT`, honors structured error codes
  - **Prompt Validation Enforcement (Updated)**: Services call a shared validator with file `columnHeaders` to validate `promptsConfig` on `createJob` and `previewJob`. Preview blocks on any issues (including collisions) with `JOBS_INVALID_INPUT`. CreateJob only blocks on non-collision issues; collisions are permitted and emitted as WARN logs noting overwrite behavior.
  - **Per‑User Default Templates (New)**: On new user creation, the server seeds a curated set of prompt and system templates into the user’s library.
  - **Job Options (New)**: Create/Preview accept optional `options` (`{ skipIfExistingValue?: boolean }`). Endpoints: `PATCH /api/jobs/:jobId/options` writes the control file (used during pause → resume); `GET /api/jobs/:jobId/options` returns current values. On create, the server writes the control file immediately to avoid worker read races.
    - Defaults source: `shared/defaultTemplates.ts`
    - Orchestration: `UsersService.createUserAndSeed` (invoked by `AuthService.syncUser` only on create)
    - Idempotency: repository helpers perform name‑based checks to avoid duplicates;
    - Backfill: `server/scripts/seed-defaults-for-existing-users.ts` seeds existing users safely.
  - **Preview Response Shape (New)**: `previewJob` now returns `{ previewData, detailed, meta }` where `detailed` contains per-row, per-prompt items including `usedVariables`, filled `systemText`/`promptText`, `response`, and `skipped`.

### Data Layer (Database + Workers)

#### **Database Architecture**
- **PostgreSQL**: ACID compliance and advanced features
- **Drizzle ORM**: Type-safe database operations
- **Migrations**: Versioned schema changes
- **Connection Management**: Single connection with max: 1 pool size

#### **Storage Strategy**
- **Supabase Storage**: Scalable file storage with access control
- **Signed URLs**: Secure file access with expiration
- **Metadata Management**: File information and relationships
- **Bucket Management**: Automatic bucket creation and validation
  - **Artifacts (Updated)**: For each completed job the worker writes `*_enriched.csv` to `enriched/<userId>/` and logs to `logs/<userId>/<jobId>.txt`. The API exposes signed URLs for both; logs URLs force download (`Content-Disposition: attachment; filename="<jobId>-logs.txt"`). Lazy back-compat: if a legacy `enriched/<userId>/<jobId>_logs.txt` exists, the service migrates it to `logs/` on first request.
  - **Job Control File (New)**: Per‑job options are stored at `controls/<userId>/<jobId>.json` with `{ skipIfExistingValue: boolean, updatedAt, updatedBy }`. Absence implies defaults (skip=false).

#### **Background Processing**
- **Worker Processes**: Independent job processing units
- **Job Leasing**: Database-based job queue with atomic claiming
- **Progress Tracking**: Real-time progress and status updates
  - **Iterator vs Completion (New)**: We track two distinct signals:
    - `currentRow` (iterator position, 1-based) indicates the row being processed now and is updated at row start; cleared on stop/completion.
    - `rowsProcessed` (completion count) increments when a row fully completes across all prompts.
  - Finalization is atomic: on completion the worker updates `status=completed`, `rowsProcessed=totalRows`, and `currentRow=null` in one DB write to prevent UI races.
- **Partial Results**: Incremental output generation during processing
- **LangChain Integration**: Multi-provider LLM orchestration for data enrichment
- **AI Processing Pipeline**: Row-by-row processing with dynamic provider selection
  - **Per-User, Per-Prompt Deduplication (New)**: Within a job, identical substituted prompts for the same promptId reuse responses using a per-user HMAC key. Includes in-flight suppression and a final summary metric.
  - **CSV Encoding (New)**: Worker prefixes partial and final CSVs with a UTF-8 BOM to enforce correct rendering in Excel/Numbers. Storage uploads use `text/csv` (no charset) due to Supabase’s mime-type validation.
  - **Logs Artifact (New)**: On completion, worker serializes job logs as `[ISO] LEVEL message` and uploads to `logs/<userId>/<jobId>.txt` with `text/plain`. Server endpoint `/api/jobs/:jobId/logs` returns a signed URL that forces download and can lazily generate the artifact (and migrate legacy path) for terminal jobs.
  - **Skip Existing Values (New)**: If the control file enables `skipIfExistingValue`, the worker checks the composed row view (inputs overlaid with prior outputs) and skips LLM calls when the target output cell is non‑empty. Treats `LLM_ERROR`, `ROW_ERROR`, and `NA/N\A` (case‑insensitive) as empty. After pause → resume, the worker re‑reads the control file so mid‑run toggles apply.

## Data Flow Architecture

### **Primary Data Flow**
```
User Action → Frontend State → API Request → Backend Processing → Database Update → Real-time Notification → Frontend Update
```

### **File Processing Flow**
```
Upload → Validation → Storage → Job Creation → Worker Processing → Progress Updates → Result Storage → Download
```

### **AI/LLM Processing Flow**
```
CSV Row → Variable Substitution → Provider Selection (OpenAI/Gemini/Perplexity/DeepSeek/Anthropic) → Model Selection (allowlisted modelId) → Per-Prompt Dedupe Check (HMAC key) → LangChain LLM Call (if miss/inflight) → Response Processing → Output Generation → Progress Update

### CSV Parsing & Header Normalization
- Row parsing across preview, job preview, and worker uses normalized headers (trim whitespace; strip UTF-8 BOM on first header; preserve case) to ensure row object keys match detected metadata headers. This guarantees UI preview cells and prompt variable substitution (e.g., `{{Topic}}`) resolve correctly even for single-column CSVs or files authored by Excel/Numbers.
```

### **Real-time Synchronization**
```
Database Change → Supabase Realtime → Client Subscription → UI Update → User Feedback
```

## Cross-Cutting Concerns

### **Authentication & Authorization**
- **Supabase Authentication**: Google OAuth integration with JWT tokens
- **Client-Side Auth**: Supabase client handles OAuth flow and token management
- **Server-Side Validation**: Express middleware validates JWT tokens using `SUPABASE_JWT_SECRET`
- **User Isolation**: Row-level security ensures users can only access their own data
- **API Key Management**: Encrypted storage and secure access for LLM provider keys; keys are configured exclusively via the `Settings` page. The `Dashboard` renders a conditional CTA banner linking to Settings when no keys are configured, and otherwise stays focused on the enrichment workflow.
  - **Hard Delete Account (New)**: API `DELETE /api/account` stops active jobs, cleans storage (`uploads/`, `enriched/`, `logs/` prefixes), removes templates, deletes `users` row, and hard-deletes the Supabase auth identity using Admin API (`deleteUser(userId, false)`). Server logs and audit telemetry report `userRowDeleted` and `authUserDeleted`. A brief retry is applied; if either flag remains false, the controller returns 409 with `ACCOUNT_DELETE_PARTIAL` and both flags.

### **Error Handling & Logging**
- **Structured Logging**: JSON-formatted logs with context
- **Error Taxonomy**: Consistent error codes and messages
- **Request Correlation**: Request ID tracking across services
- **Graceful Degradation**: Fallback mechanisms and user feedback
- **Client Telemetry**: Event tracking for user interactions and errors
  - **Details Passthrough (New)**: The HTTP error mapper includes `details` in responses when present, enabling the client to render structured validation output.
- **Auto-Pause on Critical Errors (New)**:
  - **Error Categorization**: Centralized LLM error categorization service (`shared/llm.errors.ts`) classifies errors into 11 categories (TIMEOUT, RATE_LIMIT, AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED, etc.)
  - **Critical Error Detection**: AUTH_ERROR, QUOTA_EXCEEDED, and CONTENT_FILTERED trigger automatic job pause (require user intervention)
  - **Error Details Storage**: Structured error information stored in `enrichment_jobs.error_details` JSONB column including category, user/technical messages, row/prompt context, provider/model, timestamp, and metadata
  - **Worker Auto-Pause**: Worker detects critical errors during processing, checks job status (race condition guard), and atomically updates status to "paused" with error details. The guard allows pausing when status is "processing" or "queued" to handle early‑row races.
  - **Graceful Degradation**: If pause fails, worker logs error and continues with `LLM_ERROR` marker (does not fail entire job)
  - **Error Modal**: UI automatically displays error modal when job is paused with error details, showing actionable guidance and context
  - **Cleanup**: Error details cleared on resume, stop, or successful completion

### **Performance & Scalability**
- **Database Connections**: Single connection with controlled pool size
- **Caching Strategy**: React Query for client-side caching
- **Worker Dedupe (New)**: Job-local, per-prompt in-memory dedupe keyed by per-user HMAC to avoid repeated LLM calls for identical substituted prompts. Configurable via `DQ_PROMPT_DEDUPE` and `DQ_DEDUPE_SECRET`.
- **Async Processing**: Background workers for heavy operations
- **Real-time Updates**: Efficient data synchronization
- **Partial Results**: Incremental processing and download availability

### **Security & Data Protection**
- **Data Encryption**: AES-256-GCM for sensitive API keys
- **Input Validation**: Comprehensive sanitization and validation
- **Access Control**: Principle of least privilege with RLS policies
- **Secure Storage**: Supabase Storage with signed URLs and access control
- **Request Validation**: Zod schema validation for all API endpoints

## Integration Patterns

### **External Service Integration**
- **LLM Providers**: OpenAI, Gemini, Perplexity APIs via LangChain
- **Authentication**: Supabase OAuth and JWT
- **Storage**: Supabase Storage with access control
- **Database**: PostgreSQL with advanced features

### **AI/LLM Integration Architecture**
- **LangChain Framework**: Core integration layer for multi-provider LLM access
- **Provider Abstraction**: Unified interface for OpenAI, Gemini, Perplexity, DeepSeek, and Anthropic
- **Model Selection**: Dynamic provider selection per prompt configuration
- **Retry Logic**: Exponential backoff with jitter for transient failures
- **Timeout Management**: Configurable timeouts for different provider APIs
- **Error Handling**: Graceful degradation and error reporting
 
#### Capability-Aware Parameters (OpenAI)
- Reasoning models (e.g., `gpt-5`, `gpt-5-mini`) are handled via a Responses-style path: classic sampling knobs are omitted, `reasoning.effort=medium` is used by default, and safe token limits are applied.
- Non-reasoning models (e.g., `gpt-4o`, `gpt-4.1`) use Chat defaults optimized for deterministic enrichment: temperature=0, top_p=1, penalties=0.
- A sanitizer computes effective parameters per model, logs requested vs effective values, and performs a one-time sanitize+retry on “unsupported parameter” errors.
- Prompt-length token heuristics: removed globally. We keep timeout scaling by prompt length; tokens use explicit values or model defaults.

#### Capability-Aware Parameters (Perplexity)
- Perplexity models are treated as Chat with deterministic enrichment defaults: temperature=0 and safe `max_tokens`.
- Sanitizer computes effective parameters, logs requested vs effective, and reflects temperature buckets in cache keys.

#### Capability-Aware Parameters (Gemini)
- Gemini models use Chat defaults optimized for deterministic enrichment: temperature=0 and safe `maxOutputTokens`.
- Sanitizer computes effective parameters and logs requested vs effective with sanitized fields; cache keys reflect temperature buckets.
- Safety settings are disabled for enrichment by default (BLOCK_NONE on all categories). A system instruction is prepended (“plain text only; no tools”) to reduce non-text/tool-call responses while keeping outputs flexible.

### **LangChain Implementation Details**
- **Provider Management**: LangChain community providers for each LLM service
- **Model Registry**: Curated allowlist per provider (OpenAI: gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini; Gemini: gemini-2.5-pro/flash/flash-lite; Perplexity: sonar/sonar-pro/sonar-reasoning/sonar-reasoning-pro; DeepSeek: deepseek-chat, deepseek-reasoner; Anthropic: claude-sonnet-4-5-20250929, claude-3-5-sonnet-latest, claude-3-5-haiku-latest, claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307)
- **Explicit ModelId**: Required per prompt; no provider defaults; validated at the application layer
- **Prompt Processing**: Variable substitution and template management (UI templates are saved per prompt; loading applies only to the targeted prompt)
- **Response Handling**: Flexible outputs by default (no enforced JSON mode); structured handling can be layered when needed; DeepSeek returns message content directly.
- **Rate Limiting**: Built-in rate limiting and retry mechanisms
- **Model Configuration**: Provider-specific model selection and parameters

### **Internal Service Communication**
- **HTTP APIs**: RESTful communication between layers
- **Database Events**: Real-time notifications via Supabase
- **Shared Libraries**: Common functionality across services
- **Type Safety**: TypeScript interfaces and validation

### **Real-time Communication**
- **WebSocket-like**: Supabase real-time subscriptions
- **Event Filtering**: Channel-based event routing
- **Connection Management**: Automatic reconnection and error handling
- **State Synchronization**: Real-time UI updates
  - **Updated Payload (New)**: Realtime events include `current_row`, mapped client-side to `currentRow` so the UI can display a stable “Now processing” indicator even when dedupe causes earlier rows to fill.

## Authentication Architecture

### **Supabase Authentication Flow**
1. **Client Initialization**: Supabase client configured with project URL and anon key
2. **OAuth Flow**: Google OAuth handled entirely by Supabase client
3. **Token Management**: Access tokens managed by Supabase client
4. **Server Validation**: Express middleware validates JWT tokens using `SUPABASE_JWT_SECRET`
5. **User Context**: Validated user information attached to request object

### **Security Measures**
- **JWT Validation**: Server-side validation of all authentication tokens
- **No Cookie Storage**: Stateless authentication without server-side sessions
- **User Isolation**: Row-level security policies ensure data separation
- **API Key Encryption**: Sensitive keys encrypted using AES-256-GCM
  - **Server-side Merge (Updated)**: When saving API keys, the server decrypts existing keys, applies merge semantics (undefined=no change; non-empty string=set/replace; null=delete), re-encrypts, and persists. The client never receives actual keys back—only a masked map used to drive configured/not configured badges. After save/delete, the client invalidates and refetches the session to reflect changes.

### **Authentication Middleware**
- **`authenticateSupabaseUser`**: Full user authentication with user context
- **`verifySupabaseTokenOnly`**: Token validation without user lookup
- **Request Context**: `req.user` and `req.requestId` propagated; controllers pass `requestId` to services

## Deployment Architecture

### **Environment Separation**
- **Development**: Local development with hot reloading
- **Staging**: Production-like environment for testing
- **Production**: Optimized deployment with monitoring

### **Infrastructure Components**
- **Frontend**: Vite build with CDN distribution
- **Backend**: Express.js with single-instance deployment
- **Database**: PostgreSQL with single connection pool
- **Storage**: Supabase with access control
- **Workers**: Background processes with monitoring

### **Scalability Considerations**
- **Vertical Scaling**: Single-instance services for current scale
- **Database Optimization**: Indexing and query optimization
- **Caching Strategy**: Client-side caching with React Query
- **Background Processing**: Asynchronous job processing for heavy operations

## Monitoring & Observability

### **Application Monitoring**
- **Health Checks**: Endpoint monitoring and status reporting
- **Performance Metrics**: Response times and throughput
- **Error Tracking**: Error rates and failure patterns
- **User Analytics**: Usage patterns and feature adoption

### **Infrastructure Monitoring**
- **Resource Utilization**: CPU, memory, and storage monitoring
- **Database Performance**: Query performance and connection health
- **Worker Health**: Background process monitoring
- **Real-time Status**: Connection and subscription health

### **Logging Strategy**
- **Structured Logs**: JSON format for easy parsing
- **Log Levels**: Appropriate verbosity for different environments
- **Context Preservation**: Request correlation and user context
- **Log Aggregation**: Centralized log collection and analysis

### **Client Telemetry**
- **Event Tracking**: Comprehensive user interaction monitoring
- **Performance Monitoring**: Upload, processing, and download metrics
- **Error Tracking**: Client-side error capture and reporting
- **User Journey**: Complete workflow tracking from upload to completion
- **Google Analytics**: Web analytics integration for user behavior tracking (Tracking ID: G-MGJTE79PH3)

## Security Architecture

### **Data Protection**
- **Encryption at Rest**: Sensitive data encryption using AES-256-GCM
- **Encryption in Transit**: TLS for all communications
- **API Key Security**: Secure storage and access control
- **User Data Isolation**: Multi-tenant data separation via RLS

### **Access Control**
- **Authentication**: Google OAuth via Supabase
- **Authorization**: Row-level security policies
- **Session Management**: JWT-based stateless sessions
- **API Security**: Input validation and comprehensive sanitization

### **Security Implementation**
- **Row Level Security**: Database-level access control
- **Input Validation**: Comprehensive sanitization and validation
- **Error Handling**: Secure error messages without information leakage
- **Audit Logging**: Comprehensive operation tracking

## Future Architecture Considerations

### **Scalability Enhancements**
- **Microservices**: Further service decomposition
- **Event Sourcing**: Advanced event-driven architecture
- **CQRS**: Command-query responsibility separation
- **Distributed Caching**: Redis or similar caching layer

### **Advanced Features**
- **Multi-tenancy**: Enhanced tenant isolation
- **Plugin Architecture**: Extensible functionality
- **API Versioning**: Backward-compatible API evolution
- **Advanced Analytics**: Business intelligence and reporting

### **Integration Capabilities**
- **Webhook Support**: External system integration
- **API Gateway**: Advanced API management
- **Service Mesh**: Inter-service communication
- **Event Streaming**: Kafka or similar event streaming

## Architectural Decision Records

### **Technology Choices**
- **React + TypeScript**: Type safety and component reusability
- **Express.js**: Lightweight, flexible backend framework
- **PostgreSQL**: ACID compliance and advanced features
- **Supabase**: Rapid development with enterprise features

### **Design Patterns**
- **Repository Pattern**: Data access abstraction
- **Factory Pattern**: Object creation and configuration
- **Observer Pattern**: Real-time event handling
- **Strategy Pattern**: Pluggable algorithms and behaviors

### **Trade-offs Considered**
- **Monorepo vs. Microservices**: Development efficiency vs. deployment complexity
- **Real-time vs. Polling**: User experience vs. resource utilization
- **Synchronous vs. Asynchronous**: Simplicity vs. scalability
- **Monolithic vs. Modular**: Development speed vs. maintainability

### **Current Implementation Constraints**
- **Single Connection Pool**: Database connection limited to max: 1 for current scale
- **No Load Balancing**: Single-instance deployment for current requirements
- **No Rate Limiting**: External API rate limiting not implemented
- **Limited Caching**: Client-side caching only, no server-side caching layer

This architecture provides a solid foundation for the Oracle MVP while maintaining flexibility for future enhancements and scaling requirements.
