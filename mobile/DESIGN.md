---
name: Quran Review
description: A motivating, reverent companion for the Quran-memorization journey — Arabic-first, themeable, mobile.
colors:
  islamic-green: "#1B5E20"
  green-light: "#4C8C4A"
  green-deep: "#003300"
  green-muted: "#E8F5E9"
  illumination-gold: "#FFC107"
  gold-light: "#FFD54F"
  gold-muted: "#FFF8E1"
  canvas: "#F5F5F5"
  surface: "#FFFFFF"
  surface-gold: "#FFF8E1"
  ink: "#212121"
  ink-secondary: "#757575"
  ink-muted: "#9E9E9E"
  on-primary: "#FFFFFF"
  border: "#BDBDBD"
  border-subtle: "#E0E0E0"
  success: "#388E3C"
  warning: "#FFA000"
  error: "#D32F2F"
  info: "#1976D2"
  grade-oral: "#3B82F6"
  grade-quiz: "#22C55E"
  grade-exam: "#EF4444"
  grade-assignment: "#F59E0B"
  grade-participation: "#8B5CF6"
typography:
  display:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "normal"
  headline:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "32px"
  title:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "26px"
  body:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "48px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.islamic-green}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.islamic-green}"
    rounded: "{rounded.full}"
    height: "44px"
    width: "44px"
  status-pill:
    backgroundColor: "{colors.green-muted}"
    textColor: "{colors.islamic-green}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  metric-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: Quran Review

## 1. Overview

**Creative North Star: "The Illuminated Manuscript"**

A page of a Quranic manuscript is dignified before it is decorated: deep, calm ground; disciplined text; and gold reserved for what is worth illuminating. This system works the same way. The surface is quiet and breathable, the green is grounded and reverent, and the **amber-gold is the light of earned progress** — it appears on the completed surah, the maintained streak, the granted certificate, and almost nowhere else. The reward loop is the heart of the product, but illumination is precious precisely because it is rationed.

The system is **themeable**: four primary identities (Islamic green as the anchor, plus blue, purple, and a slate dark theme) each render in light and dark, and a per-user font-size scale (0.85 / 1.0 / 1.15) and compact-spacing scale flex every screen. Green is the canonical default and the one documented here; the others are tonal swaps of the same structure, never different design languages.

It explicitly rejects three things from PRODUCT.md: the **cold grey of corporate SaaS** (this is a personal journey, not a back-office tool), the **cartoon bounce of toy-like gamification** (reverence outranks novelty), and the **dense clutter of an institutional portal** (one screen, one job).

**Key Characteristics:**
- Reverent green ground; gold rationed to genuine achievement.
- Arabic-first: Cairo throughout, RTL writing direction baked into the text primitive.
- Refined and restrained surfaces — hairline borders, soft shadows, real breathing room.
- Themeable (4 identities × light/dark) and size-adjustable without layout breakage.
- Material-derived color, type, elevation, and 8pt-grid spacing.

## 2. Colors

A grounded, reverent palette: a deep green identity, a single precious gold accent, calm neutrals, and unambiguous Material status hues.

### Primary
- **Islamic Green** (#1B5E20): The brand anchor — primary buttons, active navigation, key headings, progress fills, the app bar. Carries identity, not celebration.
- **Green Light** (#4C8C4A): Lighter tint for pressed/secondary primary surfaces and the dark-theme primary.
- **Green Deep** (#003300): Reserved depth for high-emphasis primary edges.
- **Green Muted** (#E8F5E9): Light green wash behind neutral status pills and quiet primary-tinted surfaces.

### Secondary
- **Illumination Gold** (#FFC107): The accent — and the system's most disciplined color. Used to mark **earned achievement**: streaks, completed surahs, certificates, the gold metric tile. Amber, not yellow; warm, not neon.
- **Gold Light** (#FFD54F) / **Gold Muted** (#FFF8E1): Hover/tint and the soft surface behind gold content.

### Neutral
- **Canvas** (#F5F5F5): App scaffold background. Screens rest on this, cards lift off it.
- **Surface** (#FFFFFF): Cards, tiles, sheets — the page you write on.
- **Ink** (#212121): Primary text. Hits 4.5:1+ on Canvas and Surface.
- **Ink Secondary** (#757575): Supporting text, labels, metric captions.
- **Ink Muted** (#9E9E9E): De-emphasized hints only — never primary reading text.
- **Border** (#BDBDBD) / **Border Subtle** (#E0E0E0): Input strokes and dividers / hairline card edges.

### Tertiary — Status & Grades
- **Status** (Material): Success #388E3C · Warning #FFA000 · Error #D32F2F · Info #1976D2, each with a light tint surface.
- **Grade types** (categorical, fixed): Oral #3B82F6 · Quiz #22C55E · Exam #EF4444 · Assignment #F59E0B · Participation #8B5CF6 — a stable legend across grade screens.

### Named Rules
**The Rationed Gold Rule.** Gold marks earned achievement and nothing else. It is forbidden as a decorative accent, a background, a divider, or a "make it pop" highlight. If gold appears and nothing was earned, it is wrong. Its rarity is what makes illumination mean something.

**The Status-Is-Not-Only-Color Rule.** Grade, attendance, appointment, and recording status must always pair color with an icon or label. Color alone is prohibited — color-blind users must read every status.

## 3. Typography

**Display / Body Font:** Cairo (with `system-ui, sans-serif` fallback) — a single humanist family carrying both Arabic and Latin, so Arabic and English share one voice and one vertical rhythm.

**Character:** One family, weight-differentiated. Cairo reads warmly and openly in Arabic (the primary script) while covering Latin cleanly, so the interface never code-switches typefaces between languages.

### Hierarchy
- **Display** (700, 28px / 36px): Screen titles and hero numbers — the largest voice, used once per screen.
- **Headline** (700, 24px / 32px): Major section headings, metric tile values.
- **Title** (600, 18px / 26px): Card titles, section headers, list-row leads.
- **Body** (400, 16px / 24px): Primary reading text. A 14px/20px medium body exists for dense rows; never smaller for sustained reading.
- **Label** (500, 14px / 20px): Pills, buttons, captions, avatar initials. Pills push to 800 weight for legibility at small size.

### Named Rules
**The Cairo-Everywhere Rule.** Cairo is the only UI family. Do not introduce a second sans for Latin — Cairo covers it, and a second face would break the Arabic-first vertical rhythm. (A dedicated Quran/Amiri face for ayah display is the one sanctioned future exception.)

**The Honor-the-Scale Rule.** Every text size flows through the user's font-size scale (0.85/1.0/1.15) via the `AppText` primitive. Hard-coded `<Text>` font sizes that bypass the scale are prohibited — they break the elder-friendly accessibility contract.

## 4. Elevation

A **Material elevation** system, used with restraint. Depth is ambient, not dramatic: cards sit barely above the canvas, and elevation climbs only with genuine surface hierarchy (sheets, dialogs). There are no custom glows, no neumorphism, no inner shadows.

### Shadow Vocabulary
- **sm** (`0 1px 2px rgba(0,0,0,0.06)`, elevation 1): The default — cards, tiles. A whisper of lift.
- **md** (`0 1px 3px rgba(0,0,0,0.10)`, elevation 2): Raised cards and the app bar.
- **lg** (`0 4px 8px rgba(0,0,0,0.10)`, elevation 5): Floating actions, popovers.
- **xl** (`0 8px 24px rgba(0,0,0,0.12)`, elevation 8): Modals and bottom sheets only.

### Named Rules
**The Whisper-Lift Rule.** Resting cards use `sm` and a hairline border, never more. Heavier shadow is a response to genuine layering (a sheet over content), not a way to make a card "stand out." If a flat card looks weak, fix spacing and hierarchy, not shadow depth.

## 5. Components

The character is **refined and restrained**: hairline borders, soft `sm` shadows, generous internal padding, quiet surfaces. Every interactive surface honors a ≥44pt touch target.

### Buttons
- **Primary:** Solid Islamic Green fill, white text, 8px radius (`rounded.sm`), ~14×20px padding, `activeOpacity` press feedback. The single high-emphasis action per screen.
- **Icon button:** Circular (44pt min), tonal background by intent — `surface` (default, green glyph), `primary` (filled), `danger`/`warning` (tinted-light bg, colored glyph), `ghost` (translucent on colored headers). Always carries an `accessibilityLabel`.
- **Text action:** Inline green label (e.g. section "See all"), generous `hitSlop`.

### Cards / Containers
- **Corner Style:** 12px radius (`rounded.md`).
- **Background:** Surface white (#FFFFFF) on the Canvas (#F5F5F5) scaffold.
- **Border:** Hairline `border-subtle` (#E0E0E0) — the card is defined by edge + whisper-shadow, not heavy elevation.
- **Shadow:** `sm` only (see Elevation).
- **Internal Padding:** 16px (`spacing.lg`), flexed by the compact-spacing scale.

### Chips / Status Pills
- **Style:** Fully rounded (`rounded.full`), tinted-light background with same-hue text — Success on success-light, Warning on warning-light, etc.; neutral falls back to green-muted + green text.
- **Rule:** Always paired with an icon or label per the Status-Is-Not-Only-Color Rule. Label weight 800 for small-size legibility.

### Metric Tiles
- Compact stat surfaces: large headline value in the tone accent, small secondary-ink caption below. Gold tone reserved for achievement metrics (streaks, certificates); primary/info/success for neutral stats.

### Progress Bar
- Track in `border-subtle`, fill in the tone accent (primary by default, gold for achievement). Rounded ends, 6px default height. The quiet workhorse of the "visible progress" promise.

### Navigation (Bottom Nav)
- Role-aware tab bar. Active tab in Islamic Green (icon + label); inactive in muted ink. RTL-ordered. The persistent home base.

### Empty State
- Centered: a primary-muted icon medallion, a title, and a calm secondary-ink description. Turns the inevitable "nothing here yet" into a composed, on-brand moment rather than a void.

## 6. Do's and Don'ts

### Do:
- **Do** ration gold to earned achievement — streaks, completed surahs, certificates. Identity green carries everything else.
- **Do** route every text size and spacing value through `AppText` / the settings scales, so the elder-friendly large-text contract holds.
- **Do** pair every status with an icon or label, never color alone (color-blind safety).
- **Do** keep one primary action per screen; let surfaces breathe (16px+ card padding, real whitespace).
- **Do** design RTL-first — logical layout and direction-aware icons; Arabic is the tested default.
- **Do** verify ≥4.5:1 body contrast across all four themes and dark mode before shipping a screen.
- **Do** degrade celebratory motion to a calm crossfade under reduced-motion.

### Don't:
- **Don't** make it feel like **corporate / sterile SaaS** — no cold dashboard-grey enterprise UI with no warmth.
- **Don't** make it **childish / toy-like** — no cartoon mascots, bouncy/elastic motion, or sticker-sheet badges. Over-gamification cheapens reverence.
- **Don't** make it **cluttered / institutional** — no government-portal screens that dump every field at once.
- **Don't** use gold as decoration, a background, or a generic highlight. If nothing was earned, no gold.
- **Don't** add purple-to-blue (or any multi-hue) gradients; the brand is solid primary. Decorative gradients are prohibited.
- **Don't** use gradient text (`background-clip: text`), glassmorphism, custom glows, or neumorphism.
- **Don't** use a colored side-stripe (`border-left`/`border-right` > 1px) as a card or alert accent — use a full hairline border, a tinted surface, or a leading icon.
- **Don't** introduce a second UI font for Latin; Cairo covers both scripts.
