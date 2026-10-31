<!-- markdownlint-disable MD041 MD010 -->
[![./README.yml](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./README.yml/badge.svg)](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./README.yml)[![./cicd.yml](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./cicd.yml/badge.svg)](https://github.com/jmpa-io/startpage.jcleal.me/actions/workflows/./cicd.yml)

# ``

+ 🌐 My personal startpage.

## Colours and day/night

The popup has two colour inputs (Primary, Secondary) and Reset; there are no presets. Everything (links, headings, text, borders, popup, selection, focus) is derived from the pair by `src/js/palette.js` and stays WCAG AA in both schemes. `[day]`/`[night]` toggles the scheme (stored in `localStorage['scheme']`; follows the OS until you choose). Both are applied in `<head>` before first paint.

`src/js/palette.js` and `src/js/palette.test.js` are master copies mirrored from jcleal.me (`make e2e-sync` there) - don't edit them here.

## Testing

```bash
npm ci && npm test                                      # unit tests (vitest + jsdom)
cd e2e && npm ci && npx playwright test                 # screenshot + interaction tests, serves ../src (SITE_DIR overrides)
npm run test:update                                     # refresh the committed baselines in e2e/*-snapshots
```
Or `make e2e`. External requests are blocked in the tests. `e2e/playwright.config.ts`, `e2e/helpers/palette-helpers.ts` and `e2e/server.mjs` are master copies from jcleal.me; site specifics live in `e2e/site.ts`.
