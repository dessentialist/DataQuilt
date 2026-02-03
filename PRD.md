# **PRD**

Date: Nov 15 2025
Author: Darpan Shah
PRD Versions: 0.5
Project Stage: Beta


## **1. Product Overview**

DataQuilt is a web application that enables users to enrich CSV data using multiple LLM providers. The platform provides secure Google OAuth authentication, real-time job processing, and comprehensive file management for data enrichment workflows.

## **2. Core Value Proposition**

- **Multi-LLM Integration**: Support for OpenAI GPT, Perplexity Sonar, Google Gemini, DeepSeek, and Anthropic Claude models
- **Secure Authentication**: Google OAuth 2.0 with Supabase integration
- **Real-time Processing**: Live job monitoring with progress tracking and control
- **Template System**: Reusable prompt templates with variable substitution
- **Security**: CSRF protection, input validation, and secure session management. API keys are encrypted at rest using AES-256-GCM via a shared crypto module; keys are never stored in plaintext.
- **Production Architecture**: PostgreSQL with connection pooling and optimized performance

## **3. Target Users**

### **Primary Users**

- **Data Analysts**: Enriching datasets with AI-generated insights and classifications
- **Content Marketers**: Generating personalized content at scale from customer data
- **Researchers**: Automated data annotation and information extraction
- **Business Intelligence Teams**: Adding qualitative analysis to quantitative datasets

### **Use Cases**

- Customer segmentation with AI-generated personas
- Product description enhancement from specifications
- Survey response analysis and categorization
- Lead qualification and scoring automation
- Content personalization based on user profiles

## **4. Key Features**
### **Frontend & UX (Updated)**
- **How It Works Page**: Comprehensive `/how-it-works` public page featuring a dynamic multi-step guide with videos on steps where applicable.
- **Global Footer**: Persistent footer with suggestion text, an email icon link to `mailto:d@dessentialist.com`, and a first‑party “Buy me a coffee” button linking to `https://www.buymeacoffee.com/darpanshah`. External widget scripts are intentionally not used for reliability.
 - **API Keys Management Location (Updated)**: API keys are configured exclusively on the `Settings` page. The `Dashboard` does not include the keys manager; instead, when no keys are configured, a small CTA banner appears with a button to go to Settings.
 - **API Keys Grid (Updated)**: Provider status cards render responsively — 1 column on extra narrow, 2 on small/mobile, 3 on tablet, and 4 on desktop — ensuring all four providers fit on one row on desktop.
 - **Buttons: Wrapping & Stacking **: Buttons globally support wrapping and auto height so long labels don’t overflow. A `stackOnNarrow` variant stacks icon above label on narrow screens (≤420px), and `size=compact` reduces padding for dense toolbars.
 - **Templates Page Header (Updated)**: The Templates page uses the shared `SectionHeader` with microcopy from `MC.templatesPage.header` (title, subheader, guide); the `TemplateManager` component remains headerless to prevent duplicated top-level headings.

### **Prompt Composition **
- Each prompt now supports two fields shown by default:
  - Expert Role: Instructions that steer the model’s behavior and format. Supports `{{variable}}` substitution.
  - Task Instructions: Row‑specific content. Supports `{{variable}}` substitution.
- Messages are sent to the model as structured roles via LangChain chat APIs.
- Users can save/load templates. 

### **Authentication & Security**

- Google OAuth 2.0 authentication via Supabase with PKCE flow support. The client sends `Authorization: Bearer <access_token>` on all API calls, and the server validates tokens using `SUPABASE_JWT_SECRET` (no server-managed cookies).
 - **Account Deletion **: From `Settings`, users can permanently delete their account and associated data. The API `DELETE /api/account` performs a hard delete with full cleanup (jobs, files, templates, storage) and removes the Supabase auth user. The server returns `{ success, userRowDeleted, authUserDeleted }` and emits audit events.
  - **Partial Deletion Handling **: The server applies a short retry; if any flag remains false it returns 409 with `{ code: ACCOUNT_DELETE_PARTIAL, userRowDeleted, authUserDeleted, requestId }`.

### **File Management**

- CSV file upload with validation
- Complete Supabase storage integration with secure file handling
- File metadata tracking and preview functionality
- Download original and enriched files with user authorization
- User-specific file access control and isolation

### **Job Processing**

- Multi-prompt job creation with LLM provider selection
- Real-time progress monitoring and job control (pause/resume/stop/download/retry)
- Preview functionality for prompt testing (Updated)
  - The preview modal shows tabs for the first two rows ("Row 1", "Row 2").
  - An "Original Data" table lists the union of variables referenced across prompts for the active row. When a variable comes from a prior prompt's output, it is labeled "AI Response Column".
  - Each prompt renders an expanded section by default with:
    - Expert Role (filled System Message)
    - Task Instructions (filled User Message)
    - AI Response labeled by the prompt's Output Column Name
  - Typography and spacing are optimized for comfortable reading; content preserves newlines.
- Asynchronous background processing via a dedicated worker script, ensuring the main application remains responsive.
- Real-time event logging and monitoring
 - Logs Artifact : For completed jobs, a `*_logs.txt` artifact is created and made available via signed URL in History. The API endpoint `GET /api/jobs/:jobId/logs` returns the signed URL and will lazily generate the artifact if absent for terminal jobs.
- Comprehensive error handling and retry logic
- Batch processing with rate limiting and retry logic
- **Auto-Pause on Critical Errors**:
  - When critical LLM errors occur (AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED), jobs automatically pause
  - Error modal displays with error category, user-friendly message, actionable guidance, and context (row, prompt, output column, provider, model)
  - Users can resume job (clears error details), stop job (clears error details), or dismiss modal
  - Transient errors (RATE_LIMIT, TIMEOUT, NETWORK_ERROR, SERVER_ERROR) continue with retry logic and do not trigger auto-pause
  - Error messages can include markdown-style links. The modal renders them as clickable links (e.g., `[Settings](/settings)` or provider docs for organization verification).
- **Prompt Validation (Updated)**: Before Preview and Job Start, the system validates that all `{{variable}}` references are exact, case-sensitive matches to CSV headers or prior prompt outputs, enforces sequential dependencies (no future references), blocks duplicate `outputColumnName`, and detects output/header name collisions. The UI shows grouped errors per prompt. Preview blocks on collisions. On Job Start, collisions trigger a confirmation dialog allowing users to proceed and overwrite existing input columns; the backend permits collisions on start and returns WARN logs while still blocking on all other validation issues via `JOBS_INVALID_INPUT` with structured details.
 - **System + User Messages **: For each prompt, the worker and API construct a LangChain message array: `[SystemMessage, HumanMessage]` when a system message is provided; otherwise just `[HumanMessage]`. Variable substitution is applied to both messages using the same semantics.
 - **Skip Existing Values**: A Dashboard toggle "Skip if output exists" controls whether Preview and processing skip generating values when the target output cell already contains a value (including when output column collides with an input header). Values treated as empty: `LLM_ERROR`, `ROW_ERROR`, `NA`, `N/A` (case-insensitive) and empty/whitespace. Mid‑run toggles are supported via pause → PATCH `/api/jobs/:jobId/options` → resume; worker re‑reads on resume.

### **Template Management**

- Reusable prompt templates with variable substitution
- Template validation and syntax checking
- User-specific template libraries
- Multi-provider template compatibility

#### **Expert Role Template Management**
- Separate library to save, list, update, and delete Expert Role templates.
- AI Roles are reusable across prompts and sessions and support `{{variable}}` substitution.
- AI Roles can be applied per prompt row independently of Prompt templates.
 - **Prompt Actions Layout (Updated)**: System/User action rows render as a 3‑column grid (Add Variable, Load, Save). On small screens, buttons use `stackOnNarrow` to stack icon above label; Load precedes Save consistently.

#### **Default Templates**
- On new user creation, the app seeds a curated set of templates into the user’s library so first‑time users can start quickly.
- Defaults live in `shared/defaultTemplates.ts` and are applied by `UsersService.createUserAndSeed` (invoked only when the user row is first created).
- Seeding is idempotent (name‑based checks) and non‑blocking; a backfill script `server/scripts/seed-defaults-for-existing-users.ts` can seed legacy users.

### **External Integrations**

- **LangChain**: Interface for making calls to LLMs
- **Supabase**: Database, authentication, and file storage

## **5. User Stories**

- **US1 (File Upload):** As a user, I want to easily upload a CSV file so that I can prepare my data for LLM processing.
- **US2 (Field Recognition):** As a system, when a CSV is uploaded, I want to parse it and identify its column headers so that they can be used in prompt templating.
- **US3 (Prompt Definition):** As a user, I want to define a prompt template using column names from my CSV (e.g., `{{column_name}}`) so that I can dynamically query the LLM for each row. Output column headers already added for the current session are recognized as well.
- **US4 (Autocomplete):** As a user, when typing `{{` in the prompt box, I want to see auto-complete suggestions of available column names from my CSV so that I can accurately and quickly create my prompt.
- **US5 (Multiple Queries):** As a user, I want the option to add multiple distinct queries/prompts to be run against each row so that I can gather different pieces of information simultaneously.
- **US6 (Output Column Naming):** As a user, for each query I define, I want to specify the name of the new column that will store the LLM's responses in the output CSV so that my results are clearly labeled.
- **US7 (Preview):** As a user, I want to run my defined query(s) on a small subset of my data (the first 2 rows) and see a preview of the LLM's responses so that I can quickly validate and refine my prompts before full processing.
- **US8 (Query Submission):** As a user, I want to submit my configured queries so that the LLM processing can begin.
- **US9 (Real-time Monitoring):** As a user, I want to see a real-time console view of the queries being sent and the responses received so that I can monitor the progress and identify any immediate issues.
- **US10 (Process Control - Pause):** As a user, I want to be able to pause the ongoing querying process so that I can temporarily halt operations if needed.
- **US11 (Process Control - Resume):** As a user, I want to be able to resume a paused querying process so that it continues from where it left off.
- **US12 (Process Control - Stop):** As a user, I want to be able to stop the querying process completely so that I can terminate it if it's not yielding desired results or if I need to make significant changes.
- **US19 (Process Control - Restart)**: As a user, I want to be able to restart the process so that it starts again using the queries from my input box.
- **US20 (Process Control - Download)**: As a user, I want to be able to download the file at any point in the process, so that I am able to download the CSV with all the updated responses in the output column up to the last completed row before process interruption.
- **US13 (Handling No Response):** As a system, if the LLM API does not provide a response for a specific query/row, I want to flag this event in the console view and move to the next query/row without halting the entire process.
- **US14 (Result Appending):** As a system, I want to append the LLM's response for each query as a new column to the corresponding row in the dataset so that the results are tied to the input data.
- **US15 (Download Output):** As a user, I want to download the processed CSV file, which includes the original data plus the new column(s) containing the LLM responses, so that I can use the enriched data.
- **US16 (Error Display):** As a user, if an error occurs during processing, I want to see a clear message in the console view explaining the issue so that I can troubleshoot or report it.
- **US17 (API Key)**: As a user, I want to enter my API key for LLM service (Perplexity, ChatGPT/OpenAI, Gemini, DeepSeek, Anthropic), so each request I make uses that API key and only the account associated with my API key is used for running queries
- **US18 (Model Selection):** As for user, I want to select the model (Perplexity, ChatGPT, Gemini, DeepSeek, Anthropic) for each prompt that I add, so that only the model I've selected is used for running that prompt
- **US21 (Login):** - As a user, I want to login through Google authentication so that I can access the data associated to my profile such as past saved prompt file operations and previous enriched files
- **US22 (Sign Up)**:- as a user, I want to sign up to DataQuilt through Google authentication so that I create an account where data associated to my profile is securely accessed only by me
- **US23 (Save Prompt Template):** As a user, I want to save a configured prompt (including its output‐column name and chosen model) so that I can reuse it in future sessions without redefining it each time.
- **US24 (List/Delete Saved Templates):** As a user, I want to view my list of saved prompt templates, edit an existing template, or delete one so that I can keep my workspace organized and current with my evolving needs.
- **US25 (View Enrichment History):** As a user, I want to see a history of my previously processed files (including timestamps, file names, and status) so that I can quickly access past results, or download an old enriched file if needed.
- **US27 (Delete Past Records):** As a user, I want to delete old/enqueued enrichment jobs or their associated data so that I can free up storage and remove clutter from my dashboard.
- **US28 (Automatic Retry on Transient Errors):** As a system, if an LLM call fails due to a transient error (e.g., timeout, 5xx), I want to retry up to N times before flagging it—so that minor outages don't derail the entire job.
- **US29 (Comprehensive Logging):** As a developer/user, I want comprehensive logging throughout the React application so that I can debug issues, monitor performance, and track user interactions for improved reliability.
- **US30 (Error Boundaries):** As a system, I want the application to gracefully handle React component errors so that a single component failure doesn't crash the entire application.
- **US31 (Safe Data Handling):** As a system, I want safe array and object handling throughout the frontend so that "map is not a function" and similar errors are prevented with proper data validation.
 - **US32 (System Message Field):** As a user, I want to provide a per‑prompt System Message (with `{{variables}}`) to guide the LLM’s behavior separately from the row‑specific User Message.
 - **US33 (Save System Template):** As a user, I want to save a System Message template so that I can reuse it across prompts and sessions.
 - **US34 (Load/Manage System Templates):** As a user, I want to list, edit, and delete my saved System Message templates and apply one to any prompt.
 - **US35 (Validation of System Variables):** As a system, I want to validate variables in both System and User messages to ensure they reference input headers or prior outputs and respect prompt order.
 - **US36 (Account Deletion):** As a user, i want to delete my account permanently from the app so that I can remove all my data from the app. 
 - **US37 (Pre-Loaded Prompts):** As a user, I want to have pre-loaded prompts when I open a new account so that I can use those pre-loaded prompts on my data. 
 - **US38 (Skip Filled Outputs) :** As a user, I want to choose to skip prompt outputs for rows where values are already filled so that I can use inputs with partially filled outputs without rerunning rows
 - **US39 (Auto-Pause on Critical Errors)**: As a system, when a critical LLM error occurs (invalid API key, quota exceeded, content filtered), I want to automatically pause the job and display an error modal with context and actionable guidance so that users can resolve the issue without wasting API calls.

## **7. User Flows**

### **Flow 7.1: Main Data Enrichment Flow**

1. **Start:** User lands on the DataQuilt application page.
2. **(Optional) Login / Signup:**
   - User clicks on the "Login/Sign up" button
   - User clicks on "Login / Sign Up With Google " button, and authenticates their google profile in the modal
   - User is returned to the DataQuilt home page as authenticated users
3. **API Key Setup:** User navigates to the `Settings` page and enters API keys for OpenAI, Gemini, Perplexity, DeepSeek, and/or Anthropic. If the user begins at the dashboard without keys, a CTA banner directs them to Settings.
4. **Upload CSV:**
   - User clicks "Upload CSV" button.
   - User selects a CSV file from their local system.
   - System validates file type. On success, parses CSV headers. On failure, shows an error.
5. **Configure Queries (Prompt Modal):**
   - User clicks "Configure Prompts" (or similar) opening a modal.
   - **Query 1:**
     - User provides a AI Role (optional) that defines behavior, tone, output format; supports `{{column_name}}` variables.
     - User provides a User Message (required) with row‑specific content; supports `{{column_name}}` variables.
     - User types the desired "Output Column Name 1" for this query's results.
     - User selects the desired LLM model for that prompt.
     - User can save/load a AI Role template or a Task template independently for this row.
   - **(Optional) Add More Queries:**
     - User clicks "Add Query".
     - A new "Prompt Box N" and "Output Column Name N" field appear. User configures them.
     - User can delete added queries.
     - User can reference column headers associated to already added prompts, for dynamic insertion following the same `{{column_name}}` notation in subsequent prompts
6. **(Optional) Preview Queries:**
   - User clicks "Preview Prompts".
   - System takes the first data rows (after headers) from the CSV.
   - System runs prompt validation (exact, case-sensitive) across both AI Role and Task messages. If invalid, it shows errors grouped by prompt and blocks. Header collisions are treated as errors during Preview. If valid, constructs a LangChain message array and sends to the LLM service for these 2 rows for _all_ defined prompts.
   - System displays the input data and corresponding LLM responses for the first row in a "Preview Box" or section of the modal.
7. **Submit Queries:**
   - User clicks "Submit" in the Prompt Modal. System runs prompt validation and blocks on errors except header collisions. If only collisions are present, a confirmation appears indicating that existing input columns with the same names will be overwritten; proceeding starts the job. Otherwise, if no issues remain, the job starts.
8. **Real-time Processing & Monitoring:**
   - The main page displays a "Console View".
   - System iterates through CSV rows (row 2 onwards). For each row:
     - For each configured query:
       - Dynamically inserts row values into both System and User messages.
       - Sends `[SystemMessage?, HumanMessage]` to the selected LLM via LangChain.
       - Displays "Sending: [Formatted Query]" in the console.
       - On receiving a response: Displays "Received: [LLM Response]" in the console. Appends response to an internal data structure for the new column.
       - If no response/API error: Displays "Warning/Error: No response for row X, query Y. [Details if any]" in the console. Moves to the next.
       - **Auto-Pause on Critical Errors (New)**: If a critical error occurs (AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED), the job automatically pauses and an error modal displays with:
         - Error category badge (color-coded)
         - User-friendly error message with actionable guidance
         - Context: Row number, Prompt number, Output column, Provider, Model
         - Collapsible technical details section
         - Actions: Resume Job, Stop Job, Dismiss
    - A progress bar displays how many rows are completed out of all the rows in real time
   - "Pause," "Resume","Stop", "Download", "Restart" buttons are active.
  - The "Sync Jobs" button is always visible above the Process Monitor and can be used to manually refresh job state (useful if realtime temporarily drops).
     - **Pause:** Halts sending new queries. In-flight queries may complete.
     - **Resume:** Continues processing from the last processed row. Clears error details if present.
     - **Stop:** Terminates the entire process. Partial results up to the stop point may be available for download. Clears error details.
     - **Download:** Interrupts the CSV enrichment process, and downloads a csv file with all the query responses added to the new column up to that time
     - **Restart:** Restarts the CSV enrichment process
9. **Process Completion:**
   - Once all rows/queries are processed or the process is stopped, a "Download Enriched CSV" button becomes active.
   - A summary message (e.g., "Processing complete. X rows processed.") appears.
10. **Download Output:**
    - User clicks "Download Completed CSV".
    - System generates a new CSV file containing original data + new column(s) with LLM responses.
    - The file is downloaded to the user's system.
11. **Error Handling (General):**
    - If a critical error stops the process (e.g., API key invalid, unrecoverable CSV parsing error), a clear error message is displayed in the console or as a notification.
    - **Auto-Pause on Critical Errors (New)**: Critical errors (AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED) automatically pause the job and display an error modal with context and actionable guidance. Transient errors (RATE_LIMIT, TIMEOUT, NETWORK_ERROR, SERVER_ERROR) continue with retry logic and do not trigger auto-pause.

### **Flow 7.2: Authentication & Account Management**

1. **Sign-Up Flow**
   - User visits DataQuilt application
   - Clicks "Login / Sign Up with Google"
   - Redirected to Google OAuth consent screen
   - Grants permissions and returns to DataQuilt
   - New user account created automatically
   - User lands on main dashboard with authentication

2. **Login Flow**
   - Existing user clicks "Login / Sign Up with Google"
   - Authenticates with Google
   - Returns to DataQuilt dashboard with session restored
   - Previous API keys and templates available

3. **API Key Management**
   - User opens `Settings` and clicks "Manage Keys"
   - Enters API keys for OpenAI, Gemini, Perplexity, and/or DeepSeek
   - User clicks on "Save Keys"
   - Keys are encrypted and stored securely
   - Keys persist across sessions

4. **Delete Account**
   - User opens `Settings` and clicks “Delete account” → confirm dialog.
   - API `DELETE /api/account` executes hard delete flow and retries briefly.
   - On success, client logs out and redirects to `/`.
   - Audit logs record `account_delete_requested` and `account_deleted` with deletion flags.

### **Flow 7.3: Template Management**

1. **Create New Prompt Template**
   - User configures prompts on main dashboard
   - Clicks "Save Template"
   - Enters template name and saves configuration (Task Instructions + Output column + Provider + Model)
   - Template becomes available for future use

2. **Use Prompt Template**
   - User clicks "Load Template" on a prompt row
   - Selects from saved templates
   - User Message + output column + model are applied to that row (does not affect System Message)
   - User can modify before running

3. **Manage Prompt Templates**
   - User visits Templates page
   - Views all saved templates
   - Can edit, delete, or create new templates

4. **Create System Template **
   - User clicks "Save System Message" on a prompt row
   - Enters a name and saves the System Message
   - System Template becomes available for future use

5. **Use System Template **
   - User clicks "Load System Message" on a prompt row
   - Selects from saved System Templates
   - System Message field is populated; User Message remains unchanged

6. **Manage System Templates **
   - User visits Templates page (or a new System Templates tab)
   - Views saved System Templates
   - Can edit, delete, or create new System Templates
   - Changes persist across sessions

### **Flow 7.4: History & File Management**

1. **View History**
   - User navigates to History page:
   - Views list of past enrichment jobs
   - Can see status, file names, progress
   - Can download completed results, logs, and original files

2. **Download Results**
   - User clicks download button for enriched CSV:
   - Gets signed URL for enriched CSV
   - User clicks Logs to download TXT with full job logs (available for completed/failed/stopped jobs; generated on-demand if missing)
   - Files download to local system

3. **Clean Up**
   - User can delete old jobs from history:
   - Associated files removed from storage
   - Helps manage storage usage
