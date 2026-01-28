# Code Patterns

## Page-level Section Headers (DataQuilt Frontend)

- Intent: Keep section titles/headings owned by pages, not reusable components. Prevents duplicated titles when a component is reused in multiple contexts, and centralizes sequencing (1., 2., 3.) and copy changes.
- Where used: `client/src/pages/Dashboard.tsx` owns the section headers for Upload/Preview, Configure Prompts, and View Progress. `Templates.tsx` owns the page title, while `TemplateManager.tsx` no longer renders its own top header. `/how-it-works` now also uses the shared `SectionHeader` component for all top-level section headings (e.g., “DataQuilt vs LLMs”, Steps, Why DataQuilt, Crafting Prompts, Putting It Together, API Keys & Billing, FAQ). The Templates page header copy is sourced from `MC.templatesPage.header`.
- Rationale:
  - Reusable components should not assert layout hierarchy or section numbering.
  - Page authors control order, wording, and iconography without touching component code.
- Do:
  - Render headers like `1. Upload & Preview`, `2. Configure Prompts`, `3. View Progress` in the page file.
  - Keep components focused on content, controls, and sub-sections only.
- Don’t:
  - Render top-level section titles (e.g., “SECTION 2 — PROMPT MANAGER”) inside components such as `CsvUploader`, `PromptManager`, `ProcessMonitor`, or `TemplateManager`.
- Example:
  - Page-level (Dashboard):
    - `1. Upload & Preview` above `CsvUploader`
    - `2. Configure Prompts` above `PromptManager`
    - `3. View Progress` above `ProcessMonitor`
  - Component-level: may include localized sub-headers (e.g., “CSV PREVIEW” within `CsvUploader`) where appropriate for component-internal structure.
- Impacted edits:
  - Removed component-owned section headers from:
    - `client/src/components/core/CsvUploader.tsx`
    - `client/src/components/core/PromptManager.tsx`
    - `client/src/components/core/ProcessMonitor.tsx`
    - `client/src/components/templates/TemplateManager.tsx`
  - Added/standardized page-owned headers in:
    - `client/src/pages/Dashboard.tsx`

## Centralized Microcopy

- Intent: Keep user-visible strings in a single registry for consistency and future i18n.
- Where used: `client/src/lib/microcopy.ts` exported as `MC`.
- Namespaces:
  - `MC.dashboard.*` – Dashboard section copy and button micro‑explanations
  - `MC.homepage.*` – Homepage hero/problem/use‑cases/features/mini steps/CTA
  - `MC.howItWorksPage.*` – `/how-it-works` page (sidebar labels, hero, vs‑LLMs intro, dynamic steps incl. 3.5 + 6, benefits/Why DataQuilt, prompts guide, putting it together, API keys with subsections 4.1–4.5, FAQ, support CTA, a11y)
- Rationale:
  - Centralizes wording so edits propagate consistently.
  - Enables eventual i18n without touching page/component code.
- Do:
  - Reference strings from `MC.*` inside pages/components.
  - Keep page structure and headings (h1/h2) owned by the page file.
- Don’t:
  - Hardcode repeated copy across multiple files.
  - Move layout/structure concerns into the microcopy registry.

## SectionCard Wrapper

- Intent: Provide a simple, standard container that pairs a bordered card with a `SectionHeader`, so pages can add subsections quickly and consistently (especially in Settings and similar pages).
- Where used: `client/src/pages/Settings.tsx` for "API Keys" and "Account" subsections.
- Rationale:
  - Reduces repeated boilerplate (card wrapper + header + padding wrapper).
  - Keeps SEO/a11y semantics: the section is wrapped in a semantic `section` with `aria-labelledby`.
- Do:
  - Use `SectionCard` for page-owned subsections that need a card-style container.
  - Pass `actions` to place right-aligned controls (e.g., Manage Keys button).
  - Keep complex dialogs inside the card’s children or control them externally via props.
- Don’t:
  - Render `SectionCard` inside a component that is meant to be reusable across pages; keep it at page level.
- Example:
  - `Settings.tsx`:
    - `SectionCard id="api-keys" title="API Keys" actions={<Button ... />}>` + `<ApiKeysManager headerless containerless ... />`
    - `SectionCard id="account" title="Account">` + Delete account dialog block

## HelpTip Placement

- Intent: Prevent duplicated help icons and keep guidance where users look first.
- Do:
  - Place HelpTip on page-owned `SectionHeader` for section-level guidance.
  - Use inline helper text within cards and form labels for granular guidance.
- Don’t:
  - Duplicate HelpTip icons on both the page header and child card headers for the same content.

### HelpTip Content Formatting

- Prefer multi-line strings for lists or steps; newline characters are preserved in both Tooltip and Popover. `ExampleBlock` also preserves newlines (`whitespace-pre-line`) so example content can be authored with intentional line breaks.

## Minimal Tables over Cards (Docs/Guides)

- Intent: For documentation-style link lists and pricing summaries, prefer compact tables over card grids for better scanability.
- Where used: `/how-it-works` → API Keys quick links (Provider/Primary/Guide) and Usage & Costs (Model/Estimate/Pricing/Ref).
- Rationale: Lower visual noise, better alignment for labels/links, improved a11y for screen readers.

## Data Lists Inside Modals (Preview Modal)

- Intent: Favor compact tables over card grids when listing key-value data inside modals for readability and scanability.
- Where used: Preview Modal → "Original Data" shows a table with columns: Name, Origin, Value (union of variables used across prompts). Variables originating from prior prompt outputs are labeled "AI Response Column".
- Rationale:
  - Tables align labels and values predictably in tight vertical space.
  - Works well with keyboard navigation and screen readers.
- Do:
  - Keep header labels concise and uppercase at `text-xs` with muted color.
  - Use relaxed body sizing (`text-[15px]`, `leading-relaxed`) and sufficient cell padding for readability.
- Don’t:
  - Use dense card grids for long lists inside constrained modal surfaces.

## Preview Prompt Sections Defaults

- Intent: Allow quick scanning of all prompt details without extra clicks.
- Where used: Preview Modal → Per‑prompt accordions are opened by default and the response label uses the prompt’s `outputColumnName`.
- Rationale: Reduces toil during iteration cycles; the output column name provides immediate context for where values will be written in the CSV.

## Page-Scoped Readability Tweaks

- Intent: Allow darker body text on long-form pages without affecting the rest of the app.
- Mechanism: Wrap page root with `.howitworks-page` and define `--oracle-muted-strong`. Utility `.howitworks-page .oracle-muted { color: var(--oracle-muted-strong) }` increases contrast on this page only.
- Where used: `/how-it-works` long paragraphs (intro, vs‑LLMs, API Keys lead).

## Info Blocks Tone

- ExampleBlock and TipBlock use `text-gray-800 text-sm` to reduce glare and visual weight relative to normal body text.
- Avoid embedding `<br>` tags; use plain text with line breaks instead.
- Keep lines concise (ideally ≤100 characters) to fit within the default `max-w-sm` surface.

