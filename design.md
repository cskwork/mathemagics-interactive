# Mathemagics Interactive — Living Stage design system

## Product intent

Mathemagics is a short-session mental-math learning app for independent learners aged 8–13. The interface should feel like a small theatre where the learner performs mathematical transformations, while remaining calm enough for repeated daily use. Parents and teachers are secondary viewers of progress and reports.

The primary action is always contextual: continue due practice when review cards exist; otherwise open the next available lesson. The design must preserve the existing profile, lesson, prerequisite, progress, SRS, locale, sound, offline PWA, and hash-routing contracts.

## Direction

- **Theme:** Living Stage — warm paper and deep plum, spotlight gold, insight cyan, applause green, and miss coral.
- **Genre:** playful, precise, Korean-first, and theatrical without mascots or childish reward language. Brief completion effects may celebrate a finished learning session.
- **Macrostructures:** Bento Grid for the learner hub, Narrative Workflow for the curriculum, and Workbench for focused activities.
- **Navigation:** a compact four-destination learning deck: Home, Lessons, Practice, Progress. It is a horizontal rail on wider screens and a thumb-reachable dock on mobile. Utilities stay contextual instead of competing with learning destinations.
- **Typography:** Pretendard Variable is the offline-safe Korean/English body and display family; display weight, tighter tracking, tabular numerals, and a compact numeric outlier voice create hierarchy without downloading a second Korean family.
- **Shape:** crisp 12/18/28px hierarchy. Pills are reserved for status and compact controls. Content surfaces do not become nested cards.
- **Motion:** the shared shell uses three primitives — one route reveal, a tactile press, and a meaningful success/unlock response. Instructional diagrams may keep their existing one-shot state transitions, and completed sessions may use the existing ripple/celebration effect. Ambient decorative motion is excluded; loading indicators may repeat only while work is pending. All motion collapses under reduced motion.

## Layout contract

- Mobile first at 320, 375, 414, and 768 CSS pixels; no horizontal scroll and no wrapped clickable labels.
- Focused problem-solving routes remain narrow for attention. Home, curriculum, profiles, settings, progress, and reports may use the wider 76rem stage.
- Base page gutter is fluid from 16px to 48px on the 4-point scale.
- Home uses an asymmetric 12-column composition above 60rem; curriculum reads as a connected vertical journey rather than a flat card list.
- The mobile learning deck accounts for `env(safe-area-inset-bottom)` and never obscures route content.

## Interaction contract

- Every touch action is at least 44×44px; primary learner actions are 48px.
- Keyboard focus is immediate, 3px, and visible on both light and dark surfaces.
- Buttons retain one-line labels and have default, hover-capable, focus, pressed, disabled, loading, error, and success treatments.
- Wrong answers are never dead ends: the learner receives text feedback, the input resets, and focus stays in the task.
- Loading uses a stable skeleton or named status. Empty states explain why and provide the next valid action.
- Status is never communicated by colour alone. Numerals use tabular figures.

## Content voice

Use short, direct stage language only when it explains a real learning state: “Today’s show,” “Ready to review,” “Next lesson.” Avoid invented achievements, urgency, mascots, celebratory toasts, and decoration-only eyebrows. Korean and English carry equivalent meaning.

## Token roles

The canonical source is [`tokens.css`](./tokens.css). Components use semantic Hallmark tokens or the documented compatibility aliases; raw colours and ad-hoc font declarations do not belong in component styles.

- `paper / paper-2 / paper-3`: page, raised surface, and quiet inset.
- `ink / ink-2 / muted`: primary, secondary, and supporting copy.
- `accent / accent-strong / accent-ink`: spotlight action fill, accessible accent text, and text on accent.
- `insight`, `success`, `error`: explanation, completed/correct, and recoverable miss states.
- `rule / rule-2`: structural and emphasized borders.

## Exports

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(96.5% 0.018 78);
  --color-paper-2: oklch(99% 0.008 78);
  --color-paper-3: oklch(92.5% 0.024 78);
  --color-ink: oklch(20% 0.032 302);
  --color-ink-2: oklch(38% 0.036 302);
  --color-muted: oklch(46% 0.03 302);
  --color-rule: oklch(84% 0.026 78);
  --color-rule-2: oklch(72% 0.035 78);
  --color-accent: oklch(76% 0.155 78);
  --color-accent-strong: oklch(47% 0.132 67);
  --color-accent-ink: oklch(18% 0.03 67);
  --color-focus: oklch(54% 0.2 245);
  --font-display: "Pretendard Variable", Pretendard, sans-serif;
  --font-body: "Pretendard Variable", Pretendard, sans-serif;
  --font-outlier: "SFMono-Regular", Consolas, monospace;
  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --radius-card: 1.125rem;
  --radius-pill: 999px;
  --radius-input: 0.75rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(96.5% 0.018 78)", "$type": "color" },
    "paper-2": { "$value": "oklch(99% 0.008 78)", "$type": "color" },
    "paper-3": { "$value": "oklch(92.5% 0.024 78)", "$type": "color" },
    "ink": { "$value": "oklch(20% 0.032 302)", "$type": "color" },
    "ink-2": { "$value": "oklch(38% 0.036 302)", "$type": "color" },
    "accent": { "$value": "oklch(76% 0.155 78)", "$type": "color" },
    "accent-ink": { "$value": "oklch(18% 0.03 67)", "$type": "color" },
    "focus": { "$value": "oklch(54% 0.2 245)", "$type": "color" }
  },
  "font": {
    "display": { "$value": ["Pretendard Variable", "Pretendard", "sans-serif"], "$type": "fontFamily" },
    "body": { "$value": ["Pretendard Variable", "Pretendard", "sans-serif"], "$type": "fontFamily" },
    "outlier": { "$value": ["SFMono-Regular", "Consolas", "monospace"], "$type": "fontFamily" }
  },
  "size": {
    "space-3xs": { "$value": "0.25rem", "$type": "dimension" },
    "space-2xs": { "$value": "0.5rem", "$type": "dimension" },
    "space-xs": { "$value": "0.75rem", "$type": "dimension" },
    "space-sm": { "$value": "1rem", "$type": "dimension" },
    "space-md": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui variables

```css
:root {
  --background: 78 55% 96.5%;
  --foreground: 302 32% 20%;
  --card: 78 22% 99%;
  --card-foreground: 302 32% 20%;
  --primary: 78 82% 54%;
  --primary-foreground: 67 45% 18%;
  --secondary: 78 32% 92.5%;
  --secondary-foreground: 302 32% 20%;
  --muted: 78 32% 92.5%;
  --muted-foreground: 302 22% 46%;
  --destructive: 25 73% 52%;
  --destructive-foreground: 78 22% 99%;
  --border: 78 28% 84%;
  --ring: 245 72% 57%;
  --radius: 1.125rem;
}
```
