# PWA Icons — Designer Brief

The PNG files in this directory (`icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`) are **placeholders**. They must be replaced with
production-grade A'lochi brand artwork before public launch.

## Required deliverables

| File | Size | Purpose |
| ---- | ---- | ------- |
| `icon-192.png` | 192 × 192 | Standard PWA icon (Android home screen, browser tab) |
| `icon-512.png` | 512 × 512 | High-resolution PWA icon (splash screens, store listings) |
| `icon-maskable-512.png` | 512 × 512 | Maskable icon — safe zone inside the inner 80% (Android adaptive icons) |

All files: PNG, sRGB, no transparency for the maskable variant
(background must fill the full square so OS masks crop cleanly).

## Brand guidance

- Background: **slate-800** (`#1e293b`) per A'lochi design system
- Accent: project **amber** (e.g. `#f59e0b`) for the foreground glyph
- Stroke / glyph weight: bold, recognisable at 48 px favicon scale
- Maskable safe zone: keep the wordmark / glyph inside the inner 80%
  (a 410 × 410 box centred in 512) — the outer 10% will be clipped on
  Android adaptive launchers

## Tooling

Use https://maskable.app/editor to preview the maskable variant before
shipping. Verify all three on a real device (iOS Add-to-Home-Screen and
Android "Install app" prompt).

## Status

- [ ] icon-192.png (placeholder)
- [ ] icon-512.png (placeholder)
- [ ] icon-maskable-512.png (placeholder)
