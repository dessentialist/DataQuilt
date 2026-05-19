
# 🎨 Design Guide

## 1. Overall Aesthetic

- **Modern & Minimal**: Clean layouts, generous whitespace, clear visual hierarchy.
    
- **Typographic Focus**: Elegant geometric headings (Josefin Sans) paired with highly readable body text (Lato).
    
- **High Contrast**: Deep charcoal text on ghost white background with vibrant teal accents for CTAs and highlights.
    

---

## 2. Color System (Tokens)

All roles are defined as CSS variables in `client/src/index.css` and exposed via Tailwind theme tokens.

|Role|Token|Name|Hex|HSL|Usage|
|---|---|---|---|---|---|
|**Background**|`--background`|Ghost White|`#FBF9FF`|hsl(270 100% 99%)|App surface / page background|
|**Foreground**|`--foreground`|Charcoal|`#2E4057`|hsl(215 32% 26%)|Primary body text|
|**Heading**|`--oracle-heading`|Charcoal|`#2E4057`|hsl(215 32% 26%)|H1–H6 text|
|**Primary**|`--primary`|Midnight Green|`#003738`|hsl(182 100% 11%)|Key brand color, major CTAs, primary buttons|
|**Accent**|`--oracle-accent`|Verdigris|`#45ADA8`|hsl(177 41% 47%)|Secondary actions, hover highlights, links|
|**Secondary**|`--oracle-secondary`|Cambridge Blue|`#87B38D`|hsl(132 20% 62%)|Supporting buttons, background accents|
|**Muted**|`--oracle-muted`|Neutral Gray|—|hsl(217 8% 50%)|Captions, metadata|
|**Border**|`--oracle-border`|Light Gray|—|hsl(210 20% 94%)|Card, input borders|
|**Input Border**|`--oracle-input-border`|Pale Gray|—|hsl(210 15% 85%)|Inputs, focus base|
|**Alert (Yellow)**|`--oracle-alert-yellow`|Naples Yellow|`#F4D35E`|hsl(47 89% 67%)|Warnings, caution indicators|
|**Alert (Red)**|`--destructive`|Fire Brick|`#AE2628`|hsl(359 63% 42%)|Destructive actions, error states|

- **Soft accent surface**: `.bg-oracle-accent-soft` (10% alpha of `--oracle-accent`) — used behind section titles.
    
- **Dark mode**: `.dark` overrides defined; tone values shift slightly to maintain contrast balance.
    

---

## 3. Typography


Set in `index.css` and inherited globally.

|Element|Family|Weight|Size|Line-Height|Color|Notes|
|---|---|---|---|---|---|---|
|**H1**|"Josefin Sans", system-ui|700|2.5rem|1.2|`var(--oracle-heading)` / Charcoal (`#2E4057`)|Hero / page title|
|**H2**|"Josefin Sans", "Lato", system-ui|700|1.875rem|1.3|`var(--oracle-heading)` / Charcoal (`#2E4057`)|Section headings|
|**H3**|"Lato", system-ui|600|1.25rem|1.4|`var(--foreground)` / Charcoal (`#2E4057`)|Subsection headers|
|**H4–H6**|"Lato", system-ui|600|1rem–1.125rem|1.4|`var(--foreground)` / Charcoal (`#2E4057`)|Inline headers, cards|
|**Body**|"Lato", system-ui|400|1rem|1.5|`var(--foreground)` / Charcoal (`#2E4057`)|Paragraph text|
|**CTA Text**|"Lato", system-ui|600|1rem|1.4|`var(--primary)` / Midnight Green (`#003738`)|Buttons and key actions|
|**Links / Highlights**|"Lato", system-ui|500|1rem|1.5|`var(--oracle-accent)` / Verdigris (`#45ADA8`)|Inline links and emphasis|
|**Captions / Metadata**|"Lato", system-ui|400|0.875rem|1.4|`var(--oracle-muted)` / Neutral Gray|Helper text, timestamps|

- **Case**: Sentence-case headings. Avoid ALL CAPS unless part of logo type.
    
- **CTAs**: Use clear, verb-driven language; maintain sentence case.
    
- **Font pairing rationale**:
    
    - _Josefin Sans_ → geometric, crisp, great for hierarchy.
        
    - _Lato_ → friendly, legible, perfect for UI density and body text.
        

---

## 4. Layout & Grid

- **Grid**: 12-column (`.grid-cols-12`) with fluid containers.
    
- **Section spacing**: Maintain consistent vertical rhythm between sections and within cards.
    
- **Page ownership**: Page files own top-level headings and numbering (see Patterns below).
    

---

## 5. Spacing & Rhythm (Tokens)

Defined in `index.css` as CSS variables; utilities ensure consistent vertical rhythm.

- **Tokens**:
    
    - `--space-xxs: 0.25rem` – headline → subheader
        
    - `--space-xs: 0.5rem` – subheader → guide, microcopy offsets
        
    - `--space-sm: 0.75rem` – between control rows
        
    - `--space-md: 1rem` – section padding increments
        
    - `--space-lg: 1.5rem` – larger section gaps
        
- **Utilities**:
    
    - `oracle-mt-subheader` (headline → subheader)
        
    - `oracle-mt-guide` (subheader → guidance text)
        
    - `oracle-mt-micro` (microcopy offset)
        
    - `oracle-mt-controls` (text → controls row)
        
    - `oracle-gap-actions` (inline actions spacing)
        
    - `oracle-section-gap` (between major sections)
        

---

## 6. Component Guidelines

This app uses a cohesive UI kit in `client/src/components/ui`.

### Buttons (`button.tsx`)

- **Primary**: Filled `--primary` (Midnight Green) on ghost white surface; bold, high-contrast.
    
- **Secondary**: Uses `--oracle-accent` (Verdigris) or `--oracle-secondary` (Cambridge Blue).
    
- **Destructive**: Uses `--destructive` (Fire Brick).
    
- **CTA text**: Always _Lato_ 600, sentence case.
    

### SectionHeader (`SectionHeader.tsx`)

- Props: `title`, `level (2–6)`, `icon`, `tooltip`, `subheader`, `guide`, `actions`, `variant ("plain"|"card")`.
    
- Title surface: `.bg-oracle-accent-soft` for quick scanning.
    
- Placement: Page-owned section headers render icons and HelpTips; child cards shouldn’t duplicate them.
    
- Variant `"card"` adds padding and bottom border for card headers.
    

### SectionCard (`SectionCard.tsx`)

- Semantic `section` with `aria-labelledby` for accessibility.
    
- Wraps a `SectionHeader` and content body with consistent padding.
    
- Use for subsections (e.g., API Keys, Account).
    

### HelpTip (`help-tip.tsx`)

- Hover → Tooltip; click → Popover. Tooltip hides while Popover open.
    
- Shared surface styles; newlines preserved (`whitespace-pre-line`).
    
- Place only on page `SectionHeader`s to avoid duplication.
    

### Forms & Inputs (`input.tsx`, `textarea.tsx`, `select.tsx`, `form.tsx`)

- Borders use `--oracle-input-border`; focus adds accent border.
    
- Validation: include textual or icon cues, not color alone.
    

### Data Display

- **Table** (`table.tsx`): Stick to provided variants.
    
- **Progress**, **Skeleton**, **Badge**, **Separator**: Provide subtle feedback and hierarchy.
    

### Overlays & Navigation

- **Dialog**, **Drawer**, **Popover**, **Tooltip**: Rounded borders, `bg-popover` surfaces, consistent tone.
    
- **Toast/Toaster**: Non-blocking feedback.
    
- **Sidebar**, **Breadcrumb**, **Navigation Menu**: Short labels, icons as secondary cues.
    

---

## 7. Iconography & Imagery

- **Icons**: `lucide-react` 2px strokes, rounded caps, 16–20px typical in headers.
    
- **Section icons**: Upload & Preview (`FolderOpen`), Configure Prompts (`Workflow`), View Progress (`Gauge`).
    
- **Imagery**: Clean, minimal illustrations or screenshots; consistent aspect ratios; avoid heavy filters.
    

---

## 8. Interaction & Micro-Animations

- **Links**: Hover → shift from `--primary` (Midnight Green) to `--oracle-accent` (Verdigris).
    
- **Buttons**: Subtle press scale (~0.98) with quick rebound.
    
- **Scroll-into-view**: Soft fade-up animation.
    
- **Help affordance**: Tooltip on hover, Popover on click; click outside to dismiss.
    

---

## 9. Accessibility (a11y)

- Text contrast ≥ 4.5:1 against background (`#2E4057` on `#FBF9FF` = 12.9:1 ✅).
    
- Visible focus indicators.
    
- Alt text for images; `aria-label`s for icon-only buttons.
    
- Use semantic wrapping (`section` + `aria-labelledby`) as per `SectionCard`.
    

---

## 10. Content Tone & Voice

- **Direct & Action-Oriented**: Highlight user benefit.
    
- **Concise**: Short, clear, and instructive.
    
- **Benefit-first CTAs**: Prefer “Start processing” over “Learn more.”
    

---

## 11. Microcopy & Ownership

- **Centralized microcopy**: Use `client/src/lib/microcopy.ts` (`MC.*`) for reusable text.
    
- **Page ownership**: Pages own top-level headers, numbering, and icons.
    
- **Formatting**: Multi-line `HelpTip` copy uses newlines, not `<br>`.
    

---

## 12. Dark Mode

- `.dark` variables are defined in `index.css`; components inherit automatically.
    
- Test overlays (Tooltip, Popover, Dialog, Sheet) for legibility and border contrast.
    

---

## 13. Patterns (Authoring Guidance)

- **Page-level Section Headers**: Pages own `1. Upload & Preview`, `2. Configure Prompts`, `3. View Progress`.
    
- **SectionCard Wrapper**: For Settings-like subsections (e.g., API Keys).
    
- **HelpTip Placement**: Only on page headers; avoid redundant child help.
    

---

## 14. Utilities

- **Color helpers**: `.oracle-primary`, `.oracle-heading`, `.oracle-accent`, `.bg-oracle-accent`, `.bg-oracle-accent-soft`, `.border-oracle-accent`.
    
- **Layout helpers**: `.grid-cols-12`, `.oracle-section-gap`.
    
- **Console styles**: `.console-log`, `.timestamp`, `.info`, `.warn`, `.error`.
    
