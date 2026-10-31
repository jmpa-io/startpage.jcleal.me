<!-- markdownlint-disable MD041 MD010 -->
[![./README.yml](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./README.yml/badge.svg)](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./README.yml)[![./cicd.yml](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./cicd.yml/badge.svg)](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./cicd.yml)

# ``

+ 🌐 My personal startpage.

## Colours and day/night

The popup has two colour inputs (Primary, Secondary) and Reset; there are no presets. Everything (links, headings, text, borders, popup, selection, focus) is derived from the pair by `src/js/palette.js` and stays WCAG AA in both schemes. `[day]`/`[night]` toggles the scheme (stored in `localStorage['scheme']`; follows the OS until you choose). Both are applied in `<head>` before first paint.

`src/js/palette.js` and `src/js/palette.test.js` are master copies mirrored from jcleal.me (`make e2e-sync` there) - don't edit them here.

## Editing, notes and backup

The page is a draggable terminal-style window (drag the title bar; the position is remembered; on mobile it is a normal stacked layout).

- `[edit]` shows per-item controls: add/rename/delete/reorder (↑↓) groups and links, inline forms. Only `http(s)` and `mailto` URLs are accepted.
- `[+note]` adds a draggable post-it note: type in it, pick one of four colours, `×` deletes.
- `[export]` downloads `startpage.json`; `[import]` replaces everything from such a file (invalid files are rejected and nothing changes).
- Everything lives in one versioned JSON document in `localStorage['startpage.v1']` (`src/js/store.js`, unit-tested in `store.test.js`). No backend, no sync.
- Every `github.com` link gets the GitHub mark (inline SVG, `data-icon="github"`).

## Testing

```bash
npm ci && npm test                                      # unit tests (vitest + jsdom)
cd e2e && npm ci && npx playwright test                 # screenshot + interaction tests, serves ../src (SITE_DIR overrides)
npm run test:update                                     # refresh the committed baselines in e2e/*-snapshots
```
Or `make e2e`. External requests are blocked in the tests. `e2e/playwright.config.ts`, `e2e/helpers/palette-helpers.ts` and `e2e/server.mjs` are master copies from jcleal.me; site specifics live in `e2e/site.ts`.
