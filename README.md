<div align="center">

<img src="site/icon.png" width="128" alt="Bookie icon" style="border-radius:28px" />

# Bookie

**Your PDFs, turned into a reading habit.**

A personal PDF library and reader for iOS, Android and web, with covers, streaks, stats and reading goals.

[![Release](https://img.shields.io/github/v/release/Devansh-Walia/bookie?style=for-the-badge&color=6366F1)](https://github.com/Devansh-Walia/bookie/releases/latest)
[![Expo](https://img.shields.io/badge/Expo-SDK_58-000020?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

[⬇️ Download](https://github.com/Devansh-Walia/bookie/releases/latest) · [🌐 Website](https://devansh-walia.github.io/bookie/) · [🗺️ Roadmap](future.md)

</div>

---

> 🔒 **Private by design.** Everything stays on your device. There is no account, no server and no tracking.

## ✨ Features

- **Library**: import PDFs from your device. Covers are generated from page 1, and titles are read from PDF metadata (you can rename them).
- **Reader**: PDF.js in a WebView with page transitions and touch controls. Your place is remembered per book.
- **Bookmarks and highlights**
- **Reader themes**: switch live while reading.
- **Light/dark app theme**: system, light or dark, set in Settings.
- **Stats and streaks**: pages and time per day, a daily goal, finished-book history and badges.
- **App Lock (Android)**: lock distracting apps behind reading. Group apps into tiers that stack (default 10 / +20 / +30 pages). Reading unlocks a tier for the rest of the day, and you can re-lock any tier. Everything locks again at midnight. You get three 5-minute cheat passes a day, and each one is counted.
- **Fun touches**: confetti when you finish a book, a session summary toast, and haptics (can be turned off).

## 🧰 Tech stack

| Area | Choice |
| --- | --- |
| Framework | Expo SDK 58, React 19.3, React Native 0.88 (New Architecture) |
| Navigation | expo-router |
| State | zustand 5, persisted to AsyncStorage |
| PDF | pdfjs-dist 3.11 in react-native-webview |
| Files | expo-file-system (`File`/`Directory` API), expo-document-picker |
| Tests | Jest 30 with jest-expo |

## 🚀 Getting started

Requirements: Node.js, npm (don't mix in pnpm or yarn), and Xcode and/or Android Studio for native builds.

```bash
npm install        # also copies the PDF.js assets (postinstall)
npm start          # Expo dev server
npm run ios        # build and run on iOS
npm run android    # build and run on Android
npm run web        # run in the browser
```

The `android/` and `ios/` folders are generated (Continuous Native Generation) and gitignored. `app.json` is the source of truth, and `expo run:*` regenerates the native projects.

### Scripts

| Command | Description |
| --- | --- |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |

## 🗂️ Project structure

```
app/          expo-router routes (tabs: Library, Stats, Settings)
components/   UI: BookList, BookCover, CoverGenerator, StatsScreen, SettingsScreen, PDF viewer...
constants/    theme tokens and reader themes
hooks/        useAppTheme, useReadingSession...
store/        zustand stores (books, stats, settings, app lock) and migrations
modules/      local Expo modules (app-lock: Android accessibility blocker)
utils/        file handling, stats/streak logic, session tracker, PDF.js assets
scripts/      build helpers (PDF.js asset copy)
site/         static landing page (deployed via GitHub Pages)
```

## 🏛️ Architecture notes

- **Stores**: `bookStore` holds books, progress, covers, bookmarks and highlights. `statsStore` holds the per-day log, daily goal and history. `settingsStore` holds the themes and haptics. All are persisted, and `store/migrations.ts` handles schema upgrades.
- **File storage**: books live in `Documents/books/` and covers in `Documents/covers/`. They are referenced by file name, and the full path is resolved at runtime because the iOS container path changes between installs.
- **Covers**: `CoverGenerator` is mounted in the root layout. It renders page 1 of each pending book in a hidden WebView and fills in the page count and title.
- **Reading sessions**: distinct pages turned count as pages read. Time only counts while the app is in the foreground, and it is capped at 5 minutes after the last page turn.
- **App Lock**: `modules/app-lock` is a local Expo module (Android only). An Accessibility Service watches which app is in the foreground and opens a native block screen over locked apps. JS (`hooks/useAppLock.ts`) pushes the rules and today's page count to native storage. Passes, cheat history and the midnight reset are handled natively, so they work while Bookie is closed. The pure rules live in `utils/appLock.ts`.
- **Theming**: use `useAppColors()` or `useThemedStyles(makeStyles)` with the tokens in `constants/theme.ts`. The reader has its own palette.

More detail is in [MEMORY_BANK.md](MEMORY_BANK.md). Planned work is in [future.md](future.md).

## 📦 Releases

- GitHub Actions (`.github/workflows/release.yml`) builds releases. `pages.yml` deploys the landing page in `site/`.
- EAS build profiles are in `eas.json`.
- App identifier: `com.decker.bookie` (iOS and Android).

## 🗺️ Roadmap

See [future.md](future.md), which covers a "Bookie Pro" tier with in-app purchases and advanced stats.

---

## 📄 License

No license has been specified yet. All rights reserved by the author unless one is added.

<div align="center">

Made with ☕ and 📖 by [Devansh Walia](https://github.com/Devansh-Walia)

</div>
