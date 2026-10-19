# Bookie — Future Work

## 5. Monetization: "Bookie Pro" paywall + premium features

**Goal:** a freemium model that keeps the core reading loop free (to build habit
and word of mouth) and charges for power features.

### Model
- **Free forever:** unlimited books, reading, bookmarks, highlights, covers,
  streaks, daily goal, the basic Stats tab, and all reader themes that ship today.
- **Pro:** one-time lifetime unlock (~$4.99–7.99) **or** a subscription
  (~$1.99/mo or ~$14.99/yr) if cloud or AI features are included (they have
  ongoing costs).

### Tasks
- [ ] **In-app purchases with RevenueCat** (`react-native-purchases`, needs a
      dev build, which is fine because the project already uses CNG/prebuild).
  - [ ] Create products in App Store Connect and Google Play Console
        (lifetime + monthly + yearly).
  - [ ] RevenueCat project, entitlement `pro`, offerings.
  - [ ] `store/proStore.ts`: cached entitlement status, `restorePurchases()`.
  - [ ] `usePro()` hook + `<ProGate feature="…">` wrapper component.
- [ ] **Paywall screen** (`app/paywall.tsx`, modal route).
  - Feature list, price toggle (yearly highlighted), restore button,
    terms/privacy links (required by both stores).
  - Trigger points: tapping a locked feature, after the 3rd finished book,
    after a 7-day streak (a "you're a real reader" moment). Never interrupt
    an active reading session.
- [ ] **Pro features (pick a first batch):**
  - [ ] Advanced stats: full-year heatmap, per-book time, reading speed
        (pages/hour), monthly recap.
  - [ ] Highlight export: Markdown / plain text / share sheet.
  - [ ] Shareable **quote cards**: render a highlight as an image (also free
        marketing).
  - [ ] Extra reader themes and custom accent colors.
  - [ ] Custom shelves / tags beyond the built-in filters.
  - [ ] Streak freeze (1 per week): protect a streak on a missed day.
  - [ ] **Cloud sync and backup** (Supabase or Firebase): books, progress,
        highlights and stats across devices. Requires auth + file storage.
  - [ ] **AI study companion** (subscription only; per-request costs):
        "summarize this chapter", "explain this highlight",
        "make flashcards/quiz from my highlights". Needs a small backend
        proxy so API keys never ship in the app; rate-limit per user.
- [ ] **Analytics** (privacy-friendly, e.g. PostHog): paywall views,
      conversion by trigger point, D1/D7 retention, streak lengths.
- [ ] **Store presence:** real app icon, screenshots of covers, stats and
      themes, ASO keywords ("PDF reader", "reading tracker", "reading streak"),
      privacy policy page.
- [ ] **Release signing:** a real upload keystore / EAS credentials (the old
      local build used the debug keystore for release).

## Smaller ideas backlog
- Search inside a book; table of contents (PDF outline) navigation; page slider.
- EPUB support (biggest audience expansion).
- Focus timer ("read 25 minutes") with an end-of-session summary.
- Home-screen widget showing the streak and today's goal.
- Daily reminder notification if the streak is at risk (`expo-notifications`).
- Dark mode for the library and Stats screens (the reader already has themes).
- Notes attached to highlights.
