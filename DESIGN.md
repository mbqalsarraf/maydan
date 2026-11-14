---
name: Maydan | ميدان
description: This weekend in Kuwait, printed as the co-op's honest weekly sheet.
colors:
  forest-green: "#173F35"
  press-green: "#22564A"
  ivory-newsprint: "#F4F0E8"
  paper: "#FBF8F2"
  charcoal-ink: "#232624"
  sand: "#B09462"
  sand-wash: "#E7DCC6"
  sand-rule: "#CFC3AA"
  field-stroke: "#8F8878"
  muted-ink: "#565A55"
  umber-label: "#6B5328"
  warn-wash: "#F3E8CF"
  ok-green: "#1F5F45"
  danger-brick: "#9B2C1F"
typography:
  display:
    fontFamily: "Archivo Variable, Readex Pro Variable, system-ui, sans-serif"
    fontSize: "clamp(2.3rem, 1.4rem + 3vw, 3.9rem)"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 88"
  headline:
    fontFamily: "Archivo Variable, Readex Pro Variable, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.3rem + 1.2vw, 2.35rem)"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 88"
  title:
    fontFamily: "Archivo Variable, Readex Pro Variable, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 88"
  body:
    fontFamily: "Urbanist Variable, Readex Pro Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  body-arabic:
    fontFamily: "Readex Pro Variable, Urbanist Variable, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Urbanist Variable, Readex Pro Variable, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.04em"
  numeral:
    fontFamily: "Urbanist Variable, Readex Pro Variable, system-ui, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 700
    fontFeature: "'tnum' 1, 'lnum' 1"
rounded:
  stamp: "2px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "28px"
  xl: "40px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.ivory-newsprint}"
    rounded: "{rounded.stamp}"
    padding: "8px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.press-green}"
    textColor: "{colors.ivory-newsprint}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.forest-green}"
    rounded: "{rounded.stamp}"
    padding: "8px 18px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.sand-wash}"
  button-ghost:
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.stamp}"
    padding: "8px 18px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.stamp}"
    padding: "8px 10px"
    height: "44px"
  price-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.forest-green}"
    typography: "{typography.numeral}"
    rounded: "{rounded.stamp}"
    padding: "3px 8px"
  price-tag-stamped:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.ivory-newsprint}"
  dateline-strip:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.ivory-newsprint}"
    padding: "8px 18px"
  tag:
    textColor: "{colors.charcoal-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "2px 7px"
  slot:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.stamp}"
    height: "44px"
    width: "76px"
  slot-selected:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.ivory-newsprint}"
---

# Design System: Maydan | ميدان

## Overview

**Creative North Star: "The Co-op Weekly Sheet"**

Maydan reads like the honest weekly bulletin a neighbourhood co-op pins by the door: ivory newsprint, charcoal ink, forest-green press bands and stamped date strips, sand rules and unit tags. Information is set as ruled tabular rows, not floated in cards. Every heading sits on a heavy ink rule; every price is set right-aligned in tabular numerals with its unit beside it ("per person", "per unit"). The sheet persuades by being specific and plainly labelled, never by decoration.

Density is that of a printed timetable: rows of 48 to 56px, hairline sand rules between them, generous section breaks between topics. Arabic RTL is an equal layout, not a mirror pass: the same rules, the same grid, with Readex Pro and looser leading. The one signature motion is the price tag that "stamps" (a quick press and an ink fill) when its row is hovered or pressed; elsewhere motion is short, functional and fully removable.

There are no photographs, illustrations, gradients or glows. Sample data is always visibly stamped as such; honesty is part of the visual system.

**Key Characteristics:**
- Ivory newsprint ground, charcoal ink type, forest green as the one voice.
- Heavy 3px ink rules under headings and on top of entries; 1px sand rules between rows.
- Tabular, right-aligned prices with an umber unit label underneath.
- Flat surfaces: structure comes from rules and bands, not shadows or cards.
- Narrow-width Archivo headlines against an open, round Urbanist text face; Readex Pro for Arabic.
- Bilingual as equals: logical properties (`inset-inline-start`, `text-align: start`) everywhere.

## Colors

A pinned four-colour newsprint palette (forest green, ivory, charcoal, sand) with a few washes and state hues derived from it.

### Primary
- **Forest Green** (#173F35): the press colour. Headings, links, the primary button, the dateline strip, the selected slot, the price tag stamp, the nav underline for the active page, and text selection. Pinned brand colour.
- **Press Green** (#22564A): the hover state of the primary button and the "below range" verdict. Never used as a standalone fill.

### Secondary
- **Sand** (#B09462): the restrained second voice. The 6px top band on Persuade panels (quote ruler, day plan), provider ticks on the ruler, the focus outline, the warning panel top rule and the scrollbar thumb. Pinned brand colour.
- **Umber Label** (#6B5328): text on sand: unit labels under prices ("per person") and demo tags.

### Neutral
- **Ivory Newsprint** (#F4F0E8): the page ground, masthead background and ink on green. Pinned brand colour.
- **Paper** (#FBF8F2): the slightly brighter sheet stock for the weekly sheet, panels, inputs, slots and outline buttons.
- **Charcoal Ink** (#232624): body text and every heavy rule (masthead base, heading underlines, card tops, table headers). Pinned brand colour.
- **Muted Ink** (#565A55): secondary text, column headers, fine print, axis labels.
- **Sand Rule** (#CFC3AA): hairline 1px row dividers, ghost-button borders, tag borders, dashed empty states.
- **Sand Wash** (#E7DCC6): hover fill for outline buttons, pressed toggle fill, zebra rows at 28% opacity, skeleton shimmer.
- **Field Stroke** (#8F8878): the 1.5px resting border of inputs and selects, darker than Sand Rule so fields meet 3:1 against paper.
- **Warn Wash** (#F3E8CF): background of demo badges and warning panels.

### State
- **OK Green** (#1F5F45): success panel rule, confirmed tags.
- **Danger Brick** (#9B2C1F): errors, cancelled tags, destructive buttons.

### Named Rules
**The Pinned Four Rule.** Forest green, ivory, charcoal and sand are pinned by the brand and are not retuned. New hues enter only as state colours (ok, danger) or as washes of the pinned four.

**The One Press Rule.** Forest green is the only solid fill that carries ivory type at size: the primary button, the dateline strip, the stamped price tag, the selected slot. Sand never carries body text; it marks rules, bands and focus.

## Typography

**Display Font:** Archivo Variable at 88% width (with Readex Pro, system-ui)
**Body Font:** Urbanist Variable (with Readex Pro, system-ui, Segoe UI)
**Arabic Font:** Readex Pro Variable for both headings and text
**Reference numerals:** ui-monospace (Menlo) for booking references only

**Character:** A narrowed, heavy grotesque for headings set like bulletin headers, against a round, friendly geometric text face that keeps long Kuwaiti family-facing copy easy to read. All fonts are self-hosted.

### Hierarchy
- **Display** (750, clamp(2.3rem, 1.4rem + 3vw, 3.9rem), 1.08): the home page h1 only, sitting on a 3px ink rule.
- **Headline** (750, clamp(1.75rem, 1.3rem + 1.2vw, 2.35rem) on home; 1.6rem in app screens, 1.08): section headings, each on a 3px ink rule. App-screen h1 uses clamp(1.9rem, 1.4rem + 1.6vw, 2.6rem).
- **Title** (750, 1.1rem, 1.08): h3 inside entries and panels. Row titles in the sheet use the body face at 650 in forest green.
- **Body** (400, 17px, 1.55; 16px under 560px): running text, with `text-wrap: pretty`. Lead copy at 1.08rem capped at 44ch; band copy at 46ch.
- **Label** (700, 0.78rem, 0.04em, uppercase in Latin only): table column headers of the weekly sheet. Form labels are 600 at 0.92rem, sentence case, always visible above the field.
- **Numeral** (700, 0.92rem, tabular lining figures): prices, times, places left, table cells, facts values.

### Named Rules
**The Tabular Figures Rule.** Every price, time, count, reference and table cell uses `tabular-nums lining-nums`, and prices align to the inline end of their column.

**The Arabic Equal Rule.** Under `:lang(ar)` headings switch to Readex Pro at 650, normal width, 0 tracking, 1.35 leading; body goes to 16.5px at 1.7; uppercase and tracking are dropped from labels. Arabic is never set in Archivo or in caps styling.

## Layout

A single centred column at max 1180px with a 16px gutter. Persuade sections (home) use a 5fr / 7fr two-column grid with a 40px gap: copy on the left, the evidence object (sheet, ruler, day plan, billing list) on the right; they collapse to one column at 900px with a 24px gap. Home sections are spaced 32px top / 56px bottom.

Entry lists use `repeat(auto-fill, minmax(300px, 1fr))` with 0 row gap and 28px column gap: entries are separated by their own top rule, not by gutters. Forms use a 14px grid gap and cap fields at 420px; filters sit between two 1px rules.

The weekly sheet is a 4-column ruled table (title, 9.5rem when, 3.6rem left, 7rem price). Under 560px the column headers hide and each row reflows to a 2x2 grid (title | price, when | left). The masthead is sticky, with the nav scrolling horizontally on narrow screens.

**The 44 Rule.** Every interactive target is at least 44px tall (sheet rows 56px, day-plan rows 48px, small buttons 36px only in dense app tables).

## Elevation & Depth

Flat. There are no box shadows anywhere at rest or on hover. Depth is conveyed by stock and rule: paper (#FBF8F2) sits on ivory, bounded by a 1px sand rule and a coloured top band (3px green on panels, 6px sand on Persuade panels). The only box-shadow in the system is the input focus halo (`0 0 0 3px rgba(176, 148, 98, 0.45)`), which is a focus indicator, not elevation.

### Named Rules
**The Printed Page Rule.** Surfaces are flat. If something needs to stand apart, give it paper stock, a sand hairline and a top band; never a shadow.

## Shapes

Near-square stamped corners: a single radius token of 2px for buttons, inputs, tags, slots and price tags. The dateline stamp uses 1px. Rules are the dominant form: 3px charcoal under headings, on top of entries and under the masthead; 2px charcoal under table headers, ruler baselines and day axes; 1px sand between rows. Bands are top-only (3px or 6px) on panels. Toggles and selected sessions use a 2px inset outline rather than a side stripe.

## Components

### Buttons
Solid, stamped and square-shouldered.
- **Shape:** near-square (2px), 44px minimum height, 600 weight.
- **Primary:** forest green fill, ivory text, 1.5px green border, 8px 18px padding.
- **Outline (default):** paper fill, forest green text and border. Pressed toggles (`aria-pressed`) take the sand wash.
- **Ghost:** transparent, ink text, sand-rule border; hover darkens the border to ink.
- **Danger:** brick fill and border, white text.
- **Hover / Focus / Active:** hover only on fine pointers (primary to press green, outline to sand wash); focus is a 3px sand outline at 2px offset; active scales to 0.97 over 160ms on the ease-out curve.

### Price Tag (signature)
The stamped price. A 1.5px forest-green bordered box on paper, 700 weight, tabular figures, with the umber unit label stacked beneath and right-aligned. When its row is hovered it fills with forest green and the text turns ivory (180ms ease-out); when pressed it scales to 0.96. The same tag is used in the weekly sheet and the day plan.

### Weekly Sheet (signature)
Paper stock in a 1px sand-rule frame. Opens with a full-bleed forest-green dateline strip holding an ivory "stamp" label and the real date range. Below: uppercase muted column headers on a 2px ink rule, then rows each a single link, divided by sand hairlines with a 28% sand-wash zebra; hover shifts the row to ivory and stamps its price. Rows enter with a 420ms rise staggered 45ms per row. Closes with fine print (0.78rem muted) stating that data is sample, times are Kuwait time and no payments are taken.

### Quote Ruler (signature)
A single shared scale on paper with a 6px sand top band. A 56px track with a 2px ink baseline and tenth-step hairline ticks; the reported 25th-75th range is the only marked band (16% green with 2px green ends); provider prices are 2px sand ticks; the quote marker is a 3px ink bar with an ink-on-ivory value tag that slides along the scale (220ms ease-out). A 1.2rem green verdict sits below.

### Entries / Containers
- **Entry (card):** no background, no border box; a 3px ink top rule and 16px 0 20px padding. Faded entries drop to 65% opacity.
- **Panel:** paper, 1px sand rule, 3px green top band, 18px padding; success and warn variants change the band and wash.
- **Facts list:** label/value rows split by 1px sand rules, values end-aligned and tabular.
- **Billing list:** 3px ink top rule, then 8.5rem green term column against ink-grey descriptions.

### Inputs / Fields
- **Style:** paper fill, 1.5px field-stroke border, 2px corners, 44px height, 8px 10px padding; labels always visible above.
- **Hover:** border darkens to ink.
- **Focus:** border turns forest green with a 3px sand halo; the caret is green.
- **Checkboxes, radios, ranges:** native controls at 22px with forest-green accent colour.

### Tags & Badges
Small bordered labels (0.74rem, 600, 0.02em). Neutral tags use a sand-rule border; demo tags use sand border on warn wash with umber text; flexible, ok and off tags carry their state colour in the border and text. The demo badge is the larger 0.84rem 700 variant and appears on every sample comparison.

### Time Slots
44px by 76px paper tiles with a sand-rule border; hover sets a green border, selection fills green with ivory text, disabled slots fade to 40% and strike through.

### Navigation
Ivory sticky masthead with the supplied MAYDAN wordmark (36px tall, 30px on phones, multiply blend) on a 3px ink base rule. Nav links are 600 at 0.95rem in ink; the active page gets a 3px forest-green underline that sits on the masthead rule; hover turns the text green. A forest-green demo banner runs directly under the masthead on every screen.

## Do's and Don'ts

### Do:
- **Do** put a 3px charcoal rule under every section heading and on top of every entry.
- **Do** set prices right-aligned in tabular figures with their unit ("per person", "per unit") in umber beneath.
- **Do** use the supplied MAYDAN wordmark as supplied, proportions kept, at 36px tall (30px on phones).
- **Do** stamp sample data visibly (demo banner, demo tags, fine print) on every surface that shows it.
- **Do** keep every interactive target at least 44px tall and every focus state a visible 3px sand outline.
- **Do** use logical properties so Arabic RTL renders as an equal layout.
- **Do** wrap all motion so `prefers-reduced-motion` removes it, and keep transitions between 150ms and 480ms on the ease-out curve.

### Don't:
- **Don't** add box shadows for elevation; use paper stock, a sand hairline and a top band.
- **Don't** introduce new hues beyond the pinned four, their washes and the two state colours.
- **Don't** use invented photographs, testimonials, statistics or partner logos; the system has no imagery slot for them.
- **Don't** set Arabic in Archivo, in uppercase styling or with letter-spacing.
- **Don't** round corners beyond 2px.
- **Don't** mark selection or emphasis with a coloured side stripe on one edge; use a full inset outline or a fill.
- **Don't** put small uppercase labels above headings; uppercase is reserved for table column headers.
