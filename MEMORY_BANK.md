# Bookie App - Memory Bank

> **Current state (SDK 58 upgrade + engagement features).** Sections further
> below describe the original v1 design and are partly outdated (e.g. the PDF.js
> CDN and absolute file paths are gone).

- **Stack:** Expo SDK 58, React 19.3, RN 0.88 (New Architecture), expo-router,
  TypeScript 6, zustand 5, Jest 30 (`npm test`, `npm run typecheck`).
- **Native folders are generated (CNG):** `android/` and `ios/` are gitignored;
  `app.json` is the source of truth. `npx expo run:android` regenerates them.
- **Package manager:** npm (`package-lock.json`). Don't mix in pnpm.
- **Files:** `utils/files.ts` uses the new `expo-file-system` `File`/`Directory`
  API. Books are stored by **file name** (`book.fileName`) in `Documents/books/`,
  and covers in `Documents/covers/`. Paths are resolved at runtime because the
  iOS container path changes between installs.
- **Stores** (all persisted to AsyncStorage):
  - `bookStore` (v2, migration in `store/migrations.ts`): books, progress,
    covers, finished state, bookmarks, highlights.
  - `statsStore`: per-day `{pages, seconds}` log, finished history, daily goal,
    night-owl/early-bird flags.
  - `settingsStore`: app theme (`system`/`light`/`dark`), reader theme, haptics.
- **App theme (light/dark):** tokens are `lightColors`/`darkColors` (`AppColors`)
  in `constants/theme.ts`. Components use `useAppColors()` and
  `useThemedStyles(makeStyles)` from `hooks/useAppTheme.ts`, with a module-level
  `makeStyles = (c: AppColors) => StyleSheet.create(...)`. Don't use
  `palette.light*`/`palette.textPrimary` in library UI. The root layout calls
  `useApplyAppearance()` (`Appearance.setColorScheme`) and themes the
  navigation, status bar and system UI background. Users pick the mode in the
  Settings tab (`components/SettingsScreen.tsx`). The reader keeps its own
  palette.
- **Covers:** `components/CoverGenerator.tsx` (mounted in the root layout)
  renders page 1 of each `coverStatus: "pending"` book in an invisible WebView
  (`components/PDF/coverHtml.ts`). It also fills in `totalPages` and a title
  from the PDF metadata unless the user renamed the book.
- **Reading sessions:** `hooks/useReadingSession.ts` plus the pure
  `utils/sessionTracker.ts`. Distinct pages turned count as pages read; time
  counts only while the app is in the foreground, capped at 5 minutes after
  the last page turn.
- **Stats/streaks/badges:** pure functions in `utils/stats.ts`, shown in the
  Stats tab (`components/StatsScreen.tsx`).
- **Reader themes:** `constants/readerThemes.ts` holds the metadata; the CSS
  lives in `pdfViewerStyles.ts` (`body[data-theme]`) and themes switch live
  via `window.__bookie.setTheme`.
- **Fun bits:** confetti `Celebration` on reaching the last page, a session
  toast after closing the reader, and haptics (`utils/haptics.ts`).
- **App Lock (Android only):** `modules/app-lock` is a local Expo module
  (classic `ModuleDefinition` API) and is autolinked from `./modules`.
  - `AppLockService` (AccessibilityService, window-state events only) opens
    `BlockActivity` over locked apps.
  - `LockPrefs` (SharedPreferences) stores the config pushed from JS, the
    passes (3 a day, 5 minutes each) and the cheat history.
  - Native treats a config with a stale `date` as 0 pages, which gives the
    midnight reset.
  - JS side: `store/appLockStore.ts` holds the tiers as increments, the apps
    with a 0-based tier, and the re-lock penalty.
  - The pure rules are in `utils/appLock.ts`.
  - `hooks/useAppLock.ts` pushes the config after both stores have hydrated.
  - The screen is `app/app-lock.tsx` (`components/AppLockScreen.tsx`).
  - `AppLock` is `null` on iOS and web, so the UI hides itself there.
- **Roadmap:** see `future.md` (monetization / Pro).

---

# Original v1 notes

## 🏗️ **Project Overview**

**Bookie** is a React Native/Expo mobile application that serves as a personal PDF book reader and library manager. The app allows users to import PDF files, organize them in a personal library, and read them with an advanced PDF viewer featuring smooth page transitions and touch controls.

## 📱 **Core Functionality**

- **PDF Import**: Users can select and import PDF files from their device
- **Book Library**: Displays all imported books with metadata
- **PDF Reader**: Advanced WebView-based PDF viewer with animations
- **Progress Tracking**: Remembers current page and last read date for each book
- **File Management**: Stores books locally in app's document directory

## 🛠️ **Technical Stack**

### **Core Technologies**

- **Framework**: React Native with Expo (~52.0.24)
- **Language**: TypeScript (~5.3.3)
- **Navigation**: Expo Router (~4.0.16) with React Navigation
- **State Management**: Zustand (~5.0.3) with AsyncStorage persistence
- **PDF Handling**: react-native-pdf, WebView, and PDF.js integration

### **Key Dependencies**

```json
{
  "expo-document-picker": "Document selection from device",
  "expo-file-system": "File operations and storage",
  "react-native-webview": "PDF rendering via WebView",
  "zustand": "State management",
  "@react-native-async-storage/async-storage": "Data persistence",
  "react-native-reanimated": "Animations"
}
```

## 🏛️ **Architecture & Structure**

### **Project Structure**

```
bookie/
├── app/                          # Expo Router pages
│   ├── _layout.tsx              # Root layout with theme provider
│   ├── (tabs)/                 # Tab-based navigation
│   │   ├── _layout.tsx         # Tab layout configuration
│   │   └── index.tsx           # Main screen (displays BookList)
├── components/                  # Reusable components
│   ├── BookList.tsx            # Main book management component
│   ├── PDF/                    # PDF-related components
│   │   ├── PDFViewer.tsx       # Advanced PDF reader
│   │   └── PDFViewerControls.tsx
├── store/                       # State management
│   └── bookStore.ts            # Zustand store with persistence
├── hooks/                       # Custom React hooks
│   ├── useBookActions.ts       # Book management actions
│   ├── useColorScheme.ts       # Theme handling
└── types/                       # TypeScript definitions
    └── index.ts                # Book and store interfaces
```

## 📊 **State Management (Zustand Store)**

### **Book Interface**

```typescript
interface Book {
  id: string; // Unique identifier
  title: string; // Book filename/title
  filePath: string; // Local storage path
  currentPage: number; // Last read page
  totalPages: number; // Total pages (currently unused)
  lastReadAt: string; // ISO timestamp
  fileUri: string; // File URI for access
}
```

### **Store Actions**

- `addBook()`: Adds new book with auto-generated ID and timestamp
- `updatePage()`: Updates current page and last read time
- `removeBook()`: Removes book and deletes associated file
- **Persistence**: Automatically saves to AsyncStorage as "book-storage"

## 🎨 **UI Components Deep Dive**

### **BookList Component**

- **Primary Interface**: Main screen component showing all books
- **Features**:
  - Scrollable list of imported books
  - "Add Book" button with dashed border styling
  - Individual book cards with title, last read date
  - Delete functionality (× button on each book)
  - Modal integration for PDF viewer
- **File Import Flow**:
  1. Uses `expo-document-picker` to select PDF
  2. Copies file to app's `documents/books/` directory
  3. Adds book to Zustand store with metadata

### **PDFViewer Component**

- **Advanced PDF Reader** with sophisticated features:

#### **Core Features**:

- **WebView-based**: Uses PDF.js library via HTML/JavaScript
- **Page Navigation**: Previous/Next buttons and swipe gestures
- **Visual Animations**: 3D page flip transitions with CSS animations
- **Touch Controls**: Swipe left/right for page navigation
- **Progress Tracking**: Communicates page changes to React Native

#### **Technical Implementation**:

- **Base64 Loading**: Converts PDF file to base64 for WebView
- **PDF.js Integration**: Uses CDN-hosted PDF.js (v3.11.174)
- **3D Animations**: CSS transforms with perspective and rotateY
- **Gesture Recognition**: Touch event handling for swipe detection
- **React Native Bridge**: PostMessage communication for page updates

#### **Visual Design**:

- **Dark Theme**: "#2C3E50" background with gradient buttons
- **Page Shadows**: Box shadows for depth and realism
- **Smooth Transitions**: 0.8s cubic-bezier animations
- **Responsive Design**: Viewport meta tag for mobile optimization

## 🎯 **Key Features & UX**

### **Book Management**

- **Import Process**:
  1. Tap "Add Book" → Document picker opens
  2. Select PDF → File copied to app storage
  3. Book appears in library with current timestamp
- **Reading Experience**:
  1. Tap book card → Opens modal PDF viewer
  2. Navigate with buttons or swipe gestures
  3. Progress automatically saved
  4. Close returns to library

### **File System Strategy**

- **Storage Location**: `${FileSystem.documentDirectory}books/`
- **File Naming**: `${timestamp}-${originalFilename}`
- **Cleanup**: Automatic file deletion when book is removed
- **Directory Management**: Auto-creates books directory if needed

## 🎨 **Styling & Theme**

### **Design System**

- **Color Scheme**: Supports light/dark mode via React Navigation themes
- **Typography**: System fonts with SpaceMono for headings
- **Layout**: SafeAreaView wrapper with flex-based layouts
- **Interactive Elements**: Gradient buttons, shadow effects, rounded corners

### **Visual Hierarchy**

- **Book Cards**: Dashed borders, shadow elevation, white text on dark background
- **Buttons**: Blue gradient with hover/press states
- **PDF Viewer**: Full-screen modal with floating close button

## 🔧 **Custom Hooks**

### **useBookActions**

- **Purpose**: Encapsulates book import logic
- **Returns**: `handleAddBook` function
- **Error Handling**: Alert dialogs for failed operations
- **Optimization**: useCallback for performance

### **useColorScheme**

- **Theme Management**: Detects and provides current color scheme
- **Integration**: Used throughout app for theme-aware styling

## 📁 **File System Operations**

### **Directory Structure**

```
DocumentDirectory/
└── books/
    ├── 1703123456789-example.pdf
    ├── 1703123567890-another-book.pdf
    └── ...
```

### **Operations**

- **File Copy**: `FileSystem.copyAsync()` from picker result to app directory
- **Directory Creation**: `FileSystem.makeDirectoryAsync()` with intermediates
- **File Deletion**: `FileSystem.deleteAsync()` when removing books
- **Base64 Reading**: `FileSystem.readAsStringAsync()` for PDF viewer

## 🚀 **Performance Optimizations**

### **PDF Viewer Optimizations**

- **Lazy Loading**: Pages rendered on-demand
- **Animation Throttling**: `isAnimating` flag prevents rapid page changes
- **Memory Management**: Canvas cleanup between page renders
- **Touch Debouncing**: Time-based gesture detection (300ms threshold)

### **State Management**

- **Persistence**: Zustand middleware for automatic AsyncStorage sync
- **Immutable Updates**: Proper state immutability patterns
- **Selective Re-renders**: Component-level state subscriptions

## 🎭 **Advanced PDF Viewer Features**

### **Animation System**

- **3D Transforms**: CSS `rotateY` with `perspective` for realistic flipping
- **Keyframe Animations**: Custom `@keyframes` for smooth transitions
- **Transform Origins**: Dynamic origin points for natural page turning
- **Box Shadows**: Dynamic shadow effects during animations

### **Touch Interaction**

```javascript
// Swipe Detection Logic
const diffX = touchStartX - touchEndX;
const diffY = Math.abs(touchStartY - touchEndY);
const timeDiff = touchEndTime - touchStartTime;

// Criteria: Horizontal swipe > 50px, < 300ms, primarily horizontal
if (Math.abs(diffX) > diffY && Math.abs(diffX) > 50 && timeDiff < 300) {
  // Navigate pages based on swipe direction
}
```

## 🛡️ **Error Handling & Edge Cases**

### **File Operations**

- **Import Failures**: Alert dialogs with user-friendly messages
- **File System Errors**: Console logging with graceful degradation
- **PDF Loading Errors**: Loading states and fallback UI

### **PDF Viewer Resilience**

- **WebView Errors**: Error event handlers with logging
- **PDF.js Failures**: Try-catch blocks around PDF operations
- **Memory Management**: Canvas cleanup to prevent memory leaks

## 📱 **Platform Considerations**

### **iOS/Android Compatibility**

- **File System**: Uses Expo FileSystem for cross-platform file operations
- **Document Picker**: Expo DocumentPicker handles platform-specific file selection
- **WebView**: react-native-webview provides consistent PDF rendering

### **Web Support**

- **Expo Router**: Built-in web support via Next.js-style routing
- **WebView**: Falls back to iframe-based PDF rendering on web
- **Touch Events**: Handles both touch and mouse interactions

## 🎯 **User Experience Flow**

### **First-Time User**

1. **Empty State**: Clean interface with prominent "Add Book" button
2. **Import Guide**: Simple tap-to-import interaction
3. **Immediate Feedback**: Book appears instantly after import

### **Regular Usage**

1. **Library View**: Quick access to all books with visual previews
2. **Reading Session**: Seamless modal transition to PDF reader
3. **Progress Continuity**: Always returns to last read page

### **Power User Features**

- **Swipe Navigation**: Gesture-based page turning
- **Quick Delete**: One-tap book removal
- **Visual Feedback**: Animation states and loading indicators

## 📈 **Extensibility & Future Enhancements**

### **Current Architecture Supports**

- **Multiple File Formats**: Easy to extend beyond PDF
- **Cloud Sync**: Store structure ready for remote persistence
- **Reading Statistics**: Framework exists for analytics
- **Book Metadata**: Structure supports additional book properties

### **Potential Improvements**

- **Search Functionality**: Text search within PDFs
- **Bookmarks**: Save specific pages/positions
- **Notes & Highlights**: Annotation system
- **Reading Goals**: Progress tracking and statistics
- **Sync Across Devices**: Cloud storage integration

---

## 🔍 **Development Notes**

### **Key Learning Points**

1. **WebView PDF Rendering**: Complex but powerful approach using PDF.js
2. **File System Management**: Proper local storage patterns for mobile apps
3. **Animation Performance**: CSS transforms vs React Native Animated
4. **State Persistence**: Zustand + AsyncStorage for seamless data handling
5. **Touch Gesture Recognition**: Custom implementation for swipe detection

### **Best Practices Demonstrated**

- **TypeScript Integration**: Comprehensive type safety
- **Component Composition**: Logical separation of concerns
- **Performance Optimization**: Careful animation and rendering management
- **Error Boundaries**: Graceful error handling throughout
- **Mobile-First Design**: Touch-optimized interactions

This memory bank captures the comprehensive understanding of the Bookie app's architecture, functionality, and implementation details for future reference and development.
