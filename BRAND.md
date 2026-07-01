# Redcentric Brand — Portal Style Guide

Brand assets and the 2027 colour palette were supplied in
`OneDrive_1_01-07-2026.zip` and `Branding 2027 HEX Codes (1).docx`. This
document captures how that brand is applied to the Contact Portal
(`dataverse-rcportal`).

## Colour palette

The 2027 palette is two families (blue and green/teal) plus a lime accent.

| Token             | Hex       | Role                                              |
| ----------------- | --------- | ------------------------------------------------- |
| `rc-navy`         | `#142d46` | Darkest blue — primary text, wordmark, headings   |
| `rc-blue`         | `#0066b3` | Blue — primary actions, links, focus              |
| `rc-blue-light`   | `#d9e8f4` | Lightest blue — tinted surfaces, hover fills      |
| `rc-green-dark`   | `#00272b` | Darkest green — deep contrast on teal             |
| `rc-teal`         | `#005862` | Green/teal — secondary, gradient end-stop         |
| `rc-green-light`  | `#d8f0f1` | Lightest green — soft surfaces, success tints     |
| `rc-lime`         | `#8dc63f` | Lime — sparing accent (highlights, active states) |

These are declared as Tailwind v4 theme tokens in `src/index.css`, so utilities
like `bg-rc-blue`, `text-rc-navy`, `border-rc-blue-light` are available app-wide.

### Signature gradient

The logo's top/bottom rules run **blue → teal** (`#0066b3` → `#005862`). This
left-to-right gradient is the brand's signature device. It appears in the app as
a thin accent bar under the header and above the login card
(`.rc-gradient` in `src/index.css`).

## Typography

The brand typeface is **Avenir** (`Avenir LT Std 55 Roman` for body,
`AvenirLTStd-Black` for headings) — confirmed from the supplied Word template's
paragraph styles, and the face the "redcentric" wordmark is set in. Avenir is
licensed, so the app prefers a locally-installed Avenir and loads **Mulish**
(the closest free geometric sans) from Google Fonts as the web fallback:

```
--font-sans: 'Avenir Next', 'Avenir LT Std', Avenir, Mulish, 'Segoe UI', system-ui, sans-serif;
```

Headings render heavy (`font-weight: 800`, matching Avenir Black) with slight
negative tracking; body is 400/500.

### Usage rules

- **Navy** for body text and headings — not pure black.
- **Blue** is the single primary-action colour. One primary button per view.
- **Lime** is an accent only; never use it for large fills or body text
  (fails contrast). Good for a small active dot or highlight.
- Tinted surfaces (`rc-blue-light`, `rc-green-light`) for page backgrounds and
  subtle panels — keep cards white for contrast.

## Logo

Extracted to `public/brand/`:

| File                                      | Use                                        |
| ----------------------------------------- | ------------------------------------------ |
| `Redcentric_logo_no-strapline.png`        | Wordmark, navy — for **light** backgrounds |
| `Redcentric_logo_white_no-strapline.png`  | Wordmark, white — for **dark** backgrounds |
| `Redcentric-logo_2026_full-colour.png`    | Full lockup with gradient rules            |
| `Redcentric-logo_2026_white.png`          | Full lockup, white                         |

The wordmark is lowercase `redcentric`. The header uses the navy no-strapline
wordmark on a white bar. Keep clear space around it and don't recolour it.

## Application in the portal

| Surface            | Treatment                                                     |
| ------------------ | ------------------------------------------------------------- |
| Page background    | `rc-canvas` (`#eef4fa`) — a soft wash, calmer than blue-light |
| Header             | White bar, navy wordmark, blue→teal gradient bottom accent    |
| Cards              | White, soft border, rounded, subtle shadow                    |
| Headings / text    | `rc-navy`                                                     |
| Labels / meta      | `rc-teal` muted                                              |
| Primary buttons    | `rc-blue` fill, white text, darker-navy hover                |
| Secondary buttons  | White fill, `rc-navy` text, blue-light hover                 |
| Inputs (focus)     | `rc-blue` border + ring                                       |
| Errors             | Kept red for semantic clarity (not a brand colour)           |
| Favicon            | Navy tile with a blue→teal gradient bar (`public/favicon.svg`) |

## Other supplied assets (not yet used)

The zip also contains, available if the portal grows:

- **Icons/** — 76 brand icons (`Icon_*.png`).
- **Stock images/** — sector photography (General, Health & care, Hospitality,
  Local government, Manufacturing & logistics, Professional services, Retail).
- **Templates** — Word (`.dotx`), PowerPoint (`.potx`), ISO doc template.
- **Redcentric-teams-background_2026.jpg**, **RSL-LinkedIn-staff-banner_2026.jpg**.

These live only in the source zip; extract into `public/` as needed.
