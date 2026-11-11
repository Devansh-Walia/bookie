# Bookie on the web

Plan for shipping Bookie as a website on GitHub Pages, alongside the existing
Android/iOS builds.

## Decisions

| Question | Decision |
| --- | --- |
| Hosting | **GitHub Pages** (public repo, free). No EC2. |
| Expo upgrade | **Not needed** — already on the latest SDK (58.0.23 is latest, project on `~58.0.14`). |
| Codebase | **The same Expo app**, exported to web. Not a separate site. |
| Sync | **None.** The web library is independent of the phone. Data moves via the existing backup ZIP. |
| URL layout | Landing at `/bookie/`, app at `/bookie/app/`. |
| Scope | Library, Reader, Stats, Settings — including bookmarks, highlights and backup. **No App Lock** (Android-only). |
| PDF storage | **IndexedDB**, persisted across reloads. |
| Layout | Real desktop layout (left sidebar), responsive down to phone. |
| PWA | Phase 8, after the app works. Additive, nothing depends on it. |
| Web output mode | **`single` (SPA)**, not `static`. See "Export mode" below. |

### Why not EC2

The site is 100% static: no server code, no database, no API. EC2 would add
billing after 12 months, TLS/nginx/ops, and a deployment pipeline, for zero
benefit. If sync is ever wanted, the answer is Supabase's free tier (auth +
Postgres + object storage), not a VM.

### Why no Expo upgrade

The two things blocking web are not version problems:

- `expo-file-system` 58.0.13 (latest) ships `build/ExpoFileSystem.web.js`, which
  is a stub: every method `console.warn`s and `documentDirectory` returns `''`.
  The `File`/`Directory` API is native-only by design.
- `react-native-webview` 14.0.1 (latest) has **no web implementation at all**.

Upgrading would only risk the native builds.

## Export mode: `single`, not `static`

`web.output` is **`"single"`**, not `"static"`. This is not a preference —
`"static"` is broken on `@expo/cli` 58.1.11 and produces a site that cannot run.

What happens with `"static"`: the export writes per-route HTML files and the JS
bundles to `dist/_expo/static/js/web/`, but the HTML contains **no `<script>`
tags** at all — only the inline `globalThis.__EXPO_ROUTER_HYDRATE__=true`. The
bundle never loads, so the page is a dead shell: no clicks, no import, and
`localStorage` is never read (library and stats silently do nothing).

Root cause: `exportStaticAsync.js` has an `injectScriptTags(html, scriptTags)`
helper, but the caller in `exportApp.js` never passes `scriptTags`, so
`if (scriptTags)` is always false. `renderAsync` doesn't inject them either.
Hand-patching the tags in doesn't help — the async chunk registry is missing too
(`Requiring unknown module "1256"`).

This is pre-existing: the original commit `cecef38` behaves identically.

`"single"` emits one `index.html` with the runtime, common and entry chunks
correctly wired. Deep links are handled by the `404.html` fallback. For an app
behind GitHub Pages there is no SEO value in pre-rendering `/stats`, so nothing
is lost.

## Verified end to end

Driven through Chrome DevTools Protocol against the real exported site served
under `/bookie/app/`:

- Import a PDF through the file picker → book appears, bytes land in IndexedDB.
- Cover generation → `coverStatus: "done"`, `totalPages: 2` read from the PDF.
- Reader → iframe mounts, `Page 1 / 2`, canvas rendered, bridge and
  `window.__bookie` live.
- Page turn → `currentPage: 2` persisted, book marked finished at the last page.
- Reload → library, streak, progress and cover all restored from IndexedDB.
- Deep link `/bookie/app/stats` → Stats screen renders (baseUrl is stripped by
  expo-router's `stripBaseUrl`).
- Phone width (420px) → bottom tab bar; desktop (1280px) → 232px left sidebar.

## Current state

`npx expo export -p web` succeeds. The shell renders correctly (library empty
state, tab bar, theming).

| Area | Web status |
| --- | --- |
| Library shell, tabs, theming | works |
| Stats, streaks, badges (`utils/stats.ts`) | works — pure JS |
| Settings (app theme, reader theme) | works |
| `store/*` persistence | works — AsyncStorage → localStorage |
| PDF import (`hooks/useBookActions.ts`) | **broken** — `new File(uri).copy()` hits the stub and throws |
| PDF storage (`utils/files.ts`) | **broken** — `Paths.document` is `''` |
| Reader (`components/PDF/PDFViewer.tsx`) | **broken** — no WebView on web |
| Covers (`components/CoverGenerator.tsx`) | **skipped** — early-returns on web (line 51) |
| Backup/restore (`utils/backup.ts`) | **broken** — `expo-sharing` + file system |
| App Lock | already hidden (`if (!AppLock)` guard) |
| Haptics | already guarded |

Four files to fix, not a rewrite.

## Phase 1 — storage abstraction

The only real architectural change. Metro resolves `.web.ts` automatically, so
the native path stays byte-for-byte identical.

- `utils/files.ts` — keep as-is (native).
- `utils/files.web.ts` — new. IndexedDB backend:
  - `putBook(fileName, blob)`, `getBookUrl(fileName)` → `URL.createObjectURL`,
    `hasBook(fileName)`, `deleteBook(fileName)`.
  - Same four for covers.
  - One IDB database, two object stores (`books`, `covers`), keyed by file name
    so it matches the native layout.
- `utils/files.ts` also exports `deleteQuietly`, `bookFile`, `coverFile`,
  `documentDirectoryUri`, `booksDir`, `coversDir`. The web version must export
  the same names so `store/bookStore.ts` and `utils/backup.ts` compile
  unchanged — or the call sites move to a small `storage` interface.

**Do this in Phase 1, not Phase 7:** call `navigator.storage.persist()` on the
first import. Safari evicts IndexedDB for sites that are not installed to the
home screen after ~7 days of non-use, which would silently delete a user's
library. Also surface the backup export prominently in Settings on web.

## Phase 2 — import

- `hooks/useBookActions.web.ts` — on web, `DocumentPicker.getDocumentAsync()`
  returns `asset.file` (a real `File`/Blob). Write that straight to IndexedDB.
  No `copy()` call.
- Native file untouched.

## Phase 3 — reader

The cheapest correct approach: reuse the existing viewer HTML verbatim.

- `components/PDF/PDFViewer.tsx` — keep (native, WebView).
- `components/PDF/PDFViewer.web.tsx` — new. Render the **same**
  `buildPdfViewerHtml()` output in a same-origin `<iframe srcDoc>`.
  - `pdfUrl` = blob URL from IndexedDB. The PDF.js worker is already created as
    a `Blob` URL inside the script (`pdfViewerScript.ts:46`), so it works
    unchanged.
  - Bridge shim, injected before the viewer script:
    `window.ReactNativeWebView = { postMessage: (s) => parent.postMessage(s, '*') }`.
    The parent listens for `message` events.
  - `inject(js)` → `iframe.contentWindow.eval(js)`. `srcdoc` iframes inherit the
    parent origin, so this is allowed and matches `injectJavaScript` semantics
    exactly.

This reuses all of `pdfViewerScript.ts` (15 KB): page-flip animation, text
selection, highlights, bookmarks, themes, book thickness. No rewrite.

## Phase 4 — covers

- `components/CoverGenerator.web.tsx` — new. Skip the WebView entirely: render
  page 1 with `pdfjs-dist` straight to a `<canvas>`, `canvas.toBlob()`, store in
  IndexedDB. Simpler than the native version. Also fills in `totalPages` and the
  metadata title, same as native.

## Phase 5 — backup / restore

- `utils/backup.web.ts` — export: build the ZIP with JSZip (already a
  dependency), then `Blob` + `<a download>`. Restore: `<input type="file">`
  instead of `DocumentPicker` + `expo-sharing`.
- The manifest format (`utils/backupFormat.ts`) is unchanged, so a ZIP exported
  on the phone imports in the browser and vice versa. That is the sync story
  until there is a backend.

## Phase 6 — desktop layout

Done.

- `hooks/useBreakpoint.ts` — `isDesktop` at 900px, grid columns 3/4/5/6 by
  width, `CONTENT_MAX_WIDTH` 1280.
- `app/(tabs)/_layout.tsx` — `tabBarPosition: "left"` above 900px, plus
  `tabBarLabelPosition: "beside-icon"`. The sidebar needs `minWidth` set too:
  React Navigation applies a responsive `minWidth` (`getDefaultSidebarWidth`)
  that overrides a plain `width`.
- `BookList` — `COLUMNS` is no longer a constant; the grid re-keys on the column
  count so `FlatList` re-lays-out.
- Stats and Settings content columns are capped at `CONTENT_MAX_WIDTH` and
  centred.

## Phase 7 — hosting

Done. `.github/workflows/pages.yml` builds the app and ships the landing page in
one artifact:

1. `npm ci`, `npm run typecheck`, `npm test -- --ci` — don't publish a broken build.
2. `npx expo export -p web`
3. `dist/` → `public/app/`, `site/` → `public/`
4. `touch public/.nojekyll` — **critical**, Jekyll silently drops `_expo/`
5. `cp public/app/index.html public/app/404.html` — SPA deep-link fallback
6. `upload-pages-artifact` → `deploy-pages`

`app.json` sets `experiments.baseUrl: "/bookie/app"`, which prefixes every
bundled asset URL. expo-router strips it again when resolving routes, so
`/bookie/app/stats` works on a cold load.

`site/index.html` gained an "Open in your browser" button pointing at `app/`.

## Phase 8 — PWA (optional)
**Effort: ~2–4 hours.** Nothing in Phases 1–7 depends on it.

1. `manifest.json` — 30 min. `display: standalone`, `start_url: /bookie/app/`,
   `scope: /bookie/app/`. Generate 192/512/maskable icons from
   `assets/images/icon.png` with `sips` (macOS, no dependencies).
2. Service worker — 1–2 h. Either hand-written (~60 lines) or `workbox-build`
   `generateSW` over `dist/**` in CI. Rules:
   - `_expo/static/**` → cache-first (hashed filenames are immutable).
   - HTML → **network-first**. Never cache-first, or users get stuck on an old
     build.
3. Register it in `app/+html.tsx` (the file already exists) — 15 min.
4. Test the update flow — 30–60 min. Stale service workers serving old JS is
   the classic bug here.

Caveats:

- **iOS Safari has no `beforeinstallprompt`.** Install is manual (Share → Add to
  Home Screen), so an install button only works on Android/Chrome/Edge.
- **iOS evicts IndexedDB** for non-installed sites after ~7 days of non-use. See
  the Phase 1 note — handle this regardless of whether PWA ships.
- Payoff: once the shell is cached, the app plus the IndexedDB PDFs work fully
  offline. Good story for a "private by design" app.

## Risks

| Risk | Mitigation |
| --- | --- |
| Safari evicts IndexedDB → library lost | `navigator.storage.persist()` on first import; prominent backup export; a storage-usage row in Settings. |
| Stale service worker serves an old build | Network-first for HTML; version the cache name per build. |
| Large PDFs blow past browser quota | Check `navigator.storage.estimate()` before import; warn above ~80% of quota. |
| `_expo/` dropped by Jekyll | `.nojekyll` in the artifact root. |
| Deep links 404 on Pages | `404.html` copy of the app's `index.html`. |
| Reader HTML diverges between native and web | Both call the same `buildPdfViewerHtml()`; only the host (WebView vs iframe) differs. |

## Out of scope

- Sync between phone and web (needs a backend — Supabase free tier if ever).
- App Lock (Android AccessibilityService; no web equivalent).
- Haptics, native share sheet.
- EPUB support.

## Order of work

Phases 1–7 are done. Phase 8 (PWA) is optional and additive.
