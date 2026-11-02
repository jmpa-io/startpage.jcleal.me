<!-- markdownlint-disable MD041 MD010 -->
[![./README.yml](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./README.yml/badge.svg)](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./README.yml)[![./cicd.yml](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./cicd.yml/badge.svg)](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./cicd.yml)

# ``

+ 🌐 My personal startpage.

## Colours and day/night

The popup has two colour inputs (Primary, Secondary) and Reset; there are no presets. Everything (links, headings, text, borders, popup, selection, focus) is derived from the pair by `src/js/palette.js` and stays WCAG AA in both schemes. `[day]`/`[night]` toggles the scheme (stored in `localStorage['scheme']`; follows the OS until you choose). Both are applied in `<head>` before first paint.

`src/js/palette.js` and `src/js/palette.test.js` are master copies mirrored from jcleal.me (`make e2e-sync` there) - don't edit them here.

## Editing, notes and backup

The page is an Arch Linux style terminal (dark in day and night, JetBrains Mono / Fira Code, `[jcleal@archlinux ~]$` prompt, neofetch header with live facts, `tree` link list, blinking cursor, tmux-style status bar with clock). Accents follow the Primary/Secondary colours with an Arch-blue default feel.

- Drag the title bar to move; double-click it (or use the maximise button) to maximise/restore; or focus the title bar (or a note's header) and use the arrow keys (Shift = bigger steps). Minimise and close (a chip restores it). On mobile it is a full-width stacked layout.
- Resize from any of 8 edge/corner handles (pointer, or focus a handle and use the arrow keys; Shift = bigger steps). Minimum 320x200, clamped to the viewport. Position, size and maximised state persist; `Reset layout` restores the defaults. Content scrolls inside the window.
- Toolbar actions are real buttons with icons and names: Edit, Link, Group, Note, Export, Import, Reset layout (plus day/night and Colours). In edit mode each link row gets move up/down, edit and delete icon buttons, and add/edit use labelled inline forms. Only `http(s)` and `mailto` URLs are accepted.
- `Note` adds a draggable, resizable post-it (paper texture, tape, slight tilt that straightens on hover/drag, delete button, raises on focus). Its six colour dots are tints derived live from the Primary/Secondary pair (`src/js/note-colours.js`: primary, secondary, warm yellow/green/pink pulled toward the palette, a blend), AA text contrast in day and night. Notes store a palette slot (0-5), not a hex, so they follow the picker; older colour names/hex values are migrated.
- `Export` downloads `startpage.json`; `Import` replaces everything from such a file (invalid files are rejected and nothing changes).
- Everything lives in one versioned JSON document in `localStorage['startpage.v1']` (`src/js/store.js`, unit-tested in `store.test.js`): groups/links, notes (`x, y, text, slot, w, h`) and the window frame (`x, y, w, h, max, min`). No backend, no sync.
- Every `github.com` link gets the GitHub mark (inline SVG, `data-icon="github"`).

## Testing

```bash
npm ci && npm test                                      # unit tests (vitest + jsdom)
cd e2e && npm ci && npx playwright test                 # screenshot + interaction tests, serves ../src (SITE_DIR overrides)
npm run test:update                                     # refresh the committed baselines in e2e/*-snapshots
```
Or `make e2e`. Set `E2E_PORT` if 4175 is taken (the config reuses whatever already listens there). External requests are blocked in the tests. The page ships a strict `<meta>` Content-Security-Policy (no inline script/style, `form-action 'none'`); `e2e/manage.spec.ts` runs under it, `site.ts` bypasses it only for the shared style-freezing helper. `e2e/playwright.config.ts`, `e2e/helpers/palette-helpers.ts` and `e2e/server.mjs` are master copies from jcleal.me; site specifics live in `e2e/site.ts`.
