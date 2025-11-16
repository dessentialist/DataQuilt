# DataQuilt

## Overview

DataQuilt is a web application that enriches CSV data using multiple LLM providers (OpenAI, Google Gemini, Perplexity, and DeepSeek). Users upload CSV files, configure AI prompts with variable substitution, and process rows automatically with real-time progress tracking. The platform features secure API key management with AES-256-GCM encryption, prompt chaining capabilities, and a reusable template system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Three-Tier Architecture

**Presentation Layer (React SPA)**
- React 18 with TypeScript for type-safe component development
- Vite for fast development and optimized production builds
- Tailwind CSS + Shadcn/UI (Radix UI primitives) for consistent, accessible design
- Wouter for lightweight client-side routing
- TanStack Query for server state management and caching

**Application Layer (Express API)**
- Node.js + Express.js backend with TypeScript
- RESTful API endpoints for file operations, job management, and authentication
- Middleware stack: request ID tracking, Supabase authentication, CSRF protection
- Business logic separated into service and repository layers

**Data Layer**
- PostgreSQL database with Drizzle ORM for type-safe queries
- Supabase for authentication (Google OAuth), storage (file uploads), and real-time subscriptions
- Background worker process for asynchronous job processing with job leasing system

### Authentication & Authorization

**Supabase Auth Integration**
- Google OAuth 2.0 for user authentication
- JWT token verification on API requests via middleware
- Stateless server design - authentication state managed client-side
- User sync endpoint ensures database record exists for authenticated users

**Security Measures**
- API keys encrypted at rest using AES-256-GCM with 12-byte IV and authenticated encryption
- ENCRYPTION_KEY environment variable (32 bytes, base64 encoded) required for crypto operations
- Row-level security enforced through userId checks in all database operations
- Service role key used for privileged storage operations

### LLM Integration Architecture

**LangChain Foundation**
- Standardized integration across all providers using LangChain framework
- Curated model registry with explicit model ID selection (no provider defaults)
- Supports reasoning-capable models (GPT-5, Gemini 2.5 Pro, DeepSeek Reasoner, etc.)

**Provider Implementations**
- OpenAI: `ChatOpenAI` from `@langchain/openai`
- Gemini: `ChatGoogleGenerativeAI` from `@langchain/google-genai`
- Perplexity: `ChatPerplexity` from `@langchain/community`
- DeepSeek: OpenAI-compatible via `ChatOpenAI` with custom baseURL

**Error Handling**
- Centralized error categorization in `shared/llm.errors.ts`
- 11 error categories (TIMEOUT, RATE_LIMIT, AUTH_ERROR, QUOTA_EXCEEDED, etc.)
- Auto-pause on critical errors (AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED)
- Structured error details stored in database for debugging

### Background Processing

**Job Processor Design**
- Worker process polls for queued jobs every 5 seconds
- Job leasing system prevents concurrent processing (30-minute lease with heartbeat)
- Processes CSV rows sequentially with prompt chaining support
- Real-time progress updates via Supabase Realtime subscriptions

**Prompt Processing**
- Variable substitution with `{{column_name}}` syntax
- Supports both system message and user message with separate variable substitution
- Prompt validation checks for unknown variables, future references, duplicate outputs
- Skip existing values option to avoid reprocessing rows with data

### Data Flow

**File Upload → Job Creation → Processing → Download**
1. Client uploads CSV via multipart form data
2. Server validates content, stores in Supabase Storage, creates file metadata record
3. User configures prompts with variable substitution and model selection
4. Job created in "queued" status with prompts config
5. Worker leases job, processes rows, updates progress in real-time
6. Enriched CSV generated with new columns, stored in Supabase Storage
7. Client downloads results via signed URL

### Database Schema Design

**Core Tables**
- `users`: User accounts with encrypted LLM API keys (JSONB)
- `files`: File metadata with column headers array and row count
- `enrichment_jobs`: Job state with status, progress tracking, lease management, error details
- `prompt_templates`: Reusable prompt configurations with system/user text
- `system_templates`: System message templates for expert roles
- `job_history`: Completed jobs with statistics and outcomes

**Key Decisions**
- JSONB for flexible storage of API keys, column headers, and prompt configurations
- UUID primary keys for all entities
- Timestamps with timezone for accurate temporal tracking
- Nullable lease expiration for job recovery from worker failures

### Real-Time Architecture

**Supabase Realtime Integration**
- Client subscribes to job updates via Supabase Realtime channel
- Worker publishes progress updates after each row processed
- Automatic reconnection handling with exponential backoff
- Error modal displays on critical errors with structured details

### State Management

**Client-Side State**
- TanStack Query for server state (files, jobs, templates, user session)
- React Context for authentication state and global skip toggle
- Local component state for form inputs and UI interactions

**Server-Side State**
- Stateless API design - no session storage
- All state persisted in PostgreSQL
- Worker maintains in-memory job state during processing

### Error Handling Strategy

**Categorization & Recovery**
- Errors categorized into retryable vs. critical
- Retryable errors (RATE_LIMIT, TIMEOUT, NETWORK_ERROR) trigger exponential backoff
- Critical errors (AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED) auto-pause job
- Structured error details (JobErrorDetails) include row/prompt context for debugging

**User Communication**
- User-friendly messages displayed in error modal
- Technical details logged server-side for observability
- Actionable guidance provided (e.g., "Check API key in Settings")

## External Dependencies

### Required Services

**Supabase (Backend-as-a-Service)**
- PostgreSQL database hosting (Neon Database integration)
- Authentication service (Google OAuth provider configuration)
- Storage bucket (`oracle-files`) for CSV file storage
- Realtime service for job progress subscriptions
- Service role key for privileged operations

**Environment Variables**
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: Public API key
- `SUPABASE_SERVICE_ROLE_KEY`: Admin API key
- `SUPABASE_JWT_SECRET`: Token verification secret

**PostgreSQL Database**
- Connection via `DATABASE_URL` environment variable
- SSL/TLS required for production (optional CA certificate via `DATABASE_CA_CERT_PATH` or `DATABASE_CA_CERT_B64`)
- Drizzle ORM for migrations and queries

### LLM Provider APIs

**OpenAI**
- API key stored encrypted per user
- Models: GPT-5, GPT-5-mini, GPT-4o, GPT-4o-mini, GPT-4.1, GPT-4.1-mini
- Reasoning effort configuration for reasoning models

**Google Gemini**
- API key stored encrypted per user
- Models: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.0 Flash (legacy)
- Thinking mode enabled by default for Pro/Flash

**Perplexity**
- API key stored encrypted per user
- Models: Sonar, Sonar Pro, Sonar Reasoning, Sonar Reasoning Pro
- Real-time web access for research workflows

**DeepSeek**
- API key stored encrypted per user
- OpenAI-compatible API surface with custom baseURL
- Models: DeepSeek Chat (V3.1), DeepSeek Reasoner (V3.1)

### Third-Party Libraries

**Frontend**
- Radix UI primitives for accessible components
- Lucide React for icon system
- React Hook Form + Zod for form validation
- date-fns for date formatting

**Backend**
- csv-parser for CSV reading with BOM handling
- multer for multipart file uploads
- jsonwebtoken for token verification (Supabase tokens)
- nanoid for request ID generation

**Development**
- Prettier + ESLint for code formatting and linting
- tsx for TypeScript execution in development
- esbuild for production bundling
- Replit integration for cloud development environment

### Analytics & Monitoring

**Google Analytics**
- Tracking ID: G-MGJTE79PH3
- Page view tracking and user behavior analytics
- Event tracking for key user actions

**Structured Logging**
- JSON-formatted logs with request ID correlation
- Performance metrics (memory, CPU, response time)
- Error tracking with categorization and severity levels
- Component-level logging for observability