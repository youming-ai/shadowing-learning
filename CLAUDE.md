# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shadowing Learning is a language learning application focused on shadowing practice with AI-powered audio transcription. The application processes audio files, generates transcripts with timestamps, and provides an interactive player for language learning.

## Core Architecture

### Frontend Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **UI**: React 19 + shadcn/ui components + Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: React hooks + TanStack Query for server state
- **Database**: IndexedDB via Dexie (client-side)

### AI Integration
- **Primary**: Groq SDK (direct integration, not via AI SDK) with Whisper-large-v3-turbo for transcription
- **Text Processing**: Groq SDK for text normalization and enhancement via `/api/postprocess`
- **Processing**: Server-side API routes with client-side state management
- **Migration**: Recently migrated from AI SDK to direct Groq SDK for simplified integration and better performance

### Data Flow
```
Audio Upload → Transcription API → Post-processing → IndexedDB Storage → UI State Sync
    ↓              ↓              ↓               ↓              ↓
File Management   AI Services   Text Normalization   Persistent Storage   Real-time Updates
```

### State Management Architecture
- **TanStack Query**: Server state management, caching, and synchronization
- **React Hooks**: Component-level state management
- **IndexedDB**: Persistent client-side storage
- **Real-time Updates**: Automatic UI sync with database changes
- **Database Utilities**: Simplified DBUtils class for direct database operations

## Available Commands

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run Biome.js linter
pnpm format           # Format code with Biome.js
pnpm type-check       # TypeScript type checking

# Testing (Integration with Vitest)
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Run tests with coverage report
```

## Key Directories

- `/src/app` - Next.js App Router pages and API routes
- `/src/components` - React components organized by feature
- `/src/hooks` - Custom React hooks for state management
- `/src/lib` - Utility functions, database operations, and API clients
- `/src/types` - TypeScript type definitions
- `/src/components/providers` - React providers (QueryProvider, etc.)

## Database Schema

The application uses Dexie (IndexedDB) with the following main tables:
- `files` - Audio file metadata and storage with blob data
- `transcripts` - Transcription status and metadata
- `segments` - Time-coded transcript segments with word timestamps, normalized text, translations, and annotations

**Database Version**: Currently at version 3 with migration support for:
- Enhanced transcription features (normalizedText, translation, annotations, furigana)
- Word timestamps for precise playback synchronization
- Comprehensive indexing for performance optimization

**Database Utilities**: Simplified DBUtils class with batch processing support for large segment datasets

### Database Operations

The application uses a simplified `DBUtils` class in `/src/lib/db/db.ts` for direct database operations:

```typescript
class DBUtils {
  // Core CRUD operations
  static async add<T>(table: Dexie.Table<T, number>, item: Omit<T, 'id'>): Promise<number>
  static async get<T>(table: Dexie.Table<T, number>, id: number): Promise<T | undefined>
  static async update<T>(table: Dexie.Table<T, number>, id: number, changes: Partial<T>): Promise<number>
  static async delete<T>(table: Dexie.Table<T, number>, id: number): Promise<void>

  // Batch operations
  static async bulkAdd<T>(table: Dexie.Table<T, number>, items: Omit<T, 'id'>[]): Promise<number[]>
  static async bulkUpdate<T>(table: Dexie.Table<T, number>, items: Array<{id: number, changes: Partial<T>}): Promise<number[]>

  // Query operations
  static async where<T>(table: Dexie.Table<T, number>, predicate: (item: T) => boolean): Promise<T[]>
  static async orderBy<T>(table: Dexie.Table<T, number>, key: keyof T, direction?: 'asc' | 'desc'): Promise<T[]>
}
```

**Key Features**:
- **Type-safe operations** with TypeScript generics
- **Batch processing** support for large datasets
- **Simplified query interface** for common database patterns
- **Transaction support** for complex operations

## API Routes Structure

- `/api/transcribe` - Main transcription endpoint using Groq
- `/api/postprocess` - Text normalization and enhancement
- `/api/progress/[fileId]` - Real-time progress tracking

## Advanced Features

### Transcription Language System
The application includes a sophisticated multi-language transcription system with context-based language selection:

```typescript
// Available languages
type TranscriptionLanguage = 'chinese' | 'english' | 'japanese'

// Language configuration
const languageConfig = {
  chinese: { code: 'zh', name: 'Chinese', whisper: 'chinese' },
  english: { code: 'en', name: 'English', whisper: 'english' },
  japanese: { code: 'ja', name: 'Japanese', whisper: 'japanese' }
}
```

**Key Features**:
- **Dynamic Language Selection**: Users can change transcription language via context
- **Context Persistence**: Language preferences saved to local storage
- **Real-time Updates**: UI automatically updates when language changes
- **Groq Integration**: Language codes mapped to Groq Whisper model parameters
- **Localized UI**: Interface elements and labels adapt to selected language

**Context Provider**: `TranscriptionLanguageContext` in `/src/components/layout/contexts/TranscriptionLanguageContext.tsx`

### Advanced Error Handling System
The application implements a comprehensive error handling system with recovery strategies:

```typescript
// Error categorization and handling
class ErrorHandler {
  // Error types: Network, API, Transcription, FileProcessing, Database
  static handleError(error: Error, context: string): void
  static shouldRetry(error: Error, attemptCount: number): boolean
  static getRetryDelay(attemptCount: number): number
}
```

**Key Features**:
- **Error Categorization**: Intelligent classification of different error types
- **Automatic Retries**: Exponential backoff with configurable retry attempts
- **User-Friendly Messages**: Contextual error messages with recovery suggestions
- **Toast Notifications**: Real-time error feedback via react-hot-toast
- **Error Monitoring**: Centralized error logging and aggregation
- **Graceful Degradation**: Fallback mechanisms for AI service failures

**Implementation**: `/src/lib/utils/error-handler.ts`

### Rate Limiting System
Sophisticated API protection using sliding window algorithm:

```typescript
class RateLimiter {
  // Sliding window implementation
  static async checkLimit(key: string, limit: number, windowMs: number): Promise<boolean>
  static async getRemainingRequests(key: string, limit: number, windowMs: number): Promise<number>
}
```

**Key Features**:
- **Sliding Window Algorithm**: More accurate than fixed window limiting
- **Multiple Rate Limits**: Different limits for various API endpoints
- **Redis Integration**: Distributed rate limiting for production
- **Graceful Handling**: Proper HTTP status codes (429) and retry headers
- **Burst Protection**: Handles traffic spikes efficiently

**Implementation**: `/src/lib/utils/rate-limiter.ts`

### Memory Management
Optimized memory usage for audio processing and caching:

```typescript
// Audio URL caching with WeakMap to prevent memory leaks
const audioUrlCache = new WeakMap<Blob, string>()

// Automatic cleanup on component unmount
useEffect(() => {
  return () => {
    // Clean up audio URLs and revoke object URLs
    cleanupAudioResources()
  }
}, [])
```

**Key Features**:
- **WeakMap Caching**: Prevents memory leaks for audio URL references
- **Automatic Cleanup**: Resource cleanup on component unmount
- **Object URL Management**: Proper revocation of blob URLs
- **Memory Monitoring**: Tracking of memory usage patterns
- **Garbage Collection**: Optimized for browser garbage collection

**Implementation**: Audio URL management in `usePlayerDataQuery` and player components

## Component Architecture

### Player Components
- `PlayerPage` - Main player interface with automatic transcription
- `ScrollableSubtitleDisplay` - Time-synced subtitle display with highlighting
- `PlayerFooter` - Audio controls with playback rate and volume

### File Management
- `FileUpload` - Drag-and-drop file upload with validation
- `FileManager` - Simplified file management with search, filtering, and sorting (removed grid/list view toggle)
- `FileCard` - Individual file display with real-time transcription status
- `useFileList` - Custom hook for file filtering, sorting, and selection state management

### Data Management Components
- `QueryProvider` - TanStack Query provider with caching configuration
- `ApiKeyError` - Error handling for missing API keys

## State Management with TanStack Query

### Query Keys Structure
```typescript
export const transcriptionKeys = {
  all: ["transcription"] as const,
  forFile: (fileId: number) => [...transcriptionKeys.all, "file", fileId] as const,
  progress: (fileId: number) => [...transcriptionKeys.forFile(fileId), "progress"] as const,
};
```

### Key Hooks
- `useTranscriptionStatus(fileId)` - Query transcription status for a file
- `useTranscription()` - Mutation for starting transcription
- `usePlayerDataQuery(fileId)` - Complete player data management with auto-transcription
- `useTranscriptionSummary(fileIds)` - Batch status for multiple files
- `useFiles()` - Unified file management with real-time updates
- `useFileStatus(fileId)` - Individual file status management
- `useFileList()` - Advanced file filtering, sorting, and selection
- `useFileStatusManager(fileId)` - File status operations and transcription control

### Automatic Transcription Flow
1. User navigates to player page
2. `usePlayerDataQuery` automatically detects missing transcription
3. Auto-starts transcription via `useTranscription` mutation
4. Real-time status updates via query invalidation
5. UI automatically reflects new transcription status

## Key Patterns

### Error Handling
- Unified error handling via `/src/lib/error-utils.ts`
- Graceful degradation for AI service failures
- API key validation with user-friendly error messages

### Performance Optimization
- Intelligent caching with TanStack Query (5min staleTime, 10min gcTime)
- File chunking for large audio files handled server-side
- Automatic cache invalidation on data changes
- Lazy loading of components and routes
- Memory management with WeakMap for audio URL caching to prevent memory leaks
- Batch processing support for large segment datasets via DBUtils

### Development vs Production Configuration
- **Development**: Standard Next.js mode with hot reload
- **Production**: Standalone output mode for PWA deployment
- MIME type headers configured for both environments

## Environment Configuration

Required environment variables:
```env
GROQ_API_KEY=your_groq_api_key          # Primary AI service
```

Optional configuration:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000 # Used for metadata, robots, and sitemap
```

## Development Workflow

### Starting Development
1. Ensure `.env.local` contains `GROQ_API_KEY`
2. Run `pnpm dev` to start development server
3. Application will be available at http://localhost:3000

### Debugging State Management
- TanStack Query Devtools available in development
- Real-time query inspection and cache management
- Component-level state debugging through React DevTools

### Common Development Patterns

#### Adding New API Endpoints
1. Create route in `/src/app/api/[endpoint]/route.ts`
2. Use Zod for request/response validation
3. Implement error handling with proper HTTP status codes
4. Add corresponding TanStack Query hooks for state management

#### Database Schema Changes
1. Update version in `/src/lib/db.ts`
2. Add migration logic in version upgrade
3. Update TypeScript types in `/src/types/database.ts`
4. Test with existing data through Dexie's migration system

#### Database Operations Usage
1. Use `DBUtils` static methods for database operations: `DBUtils.add(db.files, fileData)`
2. Leverage batch operations for large datasets: `DBUtils.bulkAdd(db.segments, segments)`
3. Use query methods for data retrieval: `DBUtils.where(db.files, file => file.size > 1000000)`
4. Implement transaction blocks for complex operations
5. Use type-safe operations with TypeScript generics for type safety

#### Adding New Components with State
1. Create component in appropriate `/src/components/` subdirectory
2. Use TanStack Query hooks for server state
3. Implement proper loading and error states
4. Add real-time updates through query invalidation

## Deployment & CI

### Vercel Deployment (Recent Migration from Cloudflare Pages)
The application has been migrated from Cloudflare Pages to Vercel deployment for better performance and developer experience:

```bash
# Deploy to production
pnpm deploy           # Build and deploy to production

# Deploy to preview environment
pnpm deploy:preview   # Build and deploy to preview

# Manual deployment steps
pnpm build && vercel --prod
```

**Vercel Configuration**:
- Regions: Hong Kong, Singapore, San Francisco for global coverage
- Function timeout: 30 seconds for API routes
- Optimized caching headers for static assets and API endpoints
- Automatic HTTPS and CDN distribution

### CI Pipeline
The `ci:build` command runs the complete quality assurance pipeline:
1. **Dependency Installation**: `pnpm install --frozen-lockfile`
2. **Code Quality**: `pnpm lint` (Biome.js checks)
3. **Type Safety**: `pnpm type-check` (TypeScript compilation)
4. **Testing**: `pnpm test:run` (Vitest test suite - optional in current workflow)
5. **Build Validation**: `pnpm build` (Production build)

**Note**: While test infrastructure exists with Vitest and React Testing Library, the current development workflow focuses on type safety and code quality through automated linting and formatting.

### Build Configuration
- **Next.js Config**: Optimized for Vercel deployment with serverless functions
- **Bundle Analysis**: Available via `pnpm build:analyze`
- **Image Optimization**: Enabled with Vercel's Image Optimization API
- **Package Optimization**: Standard Next.js optimization for serverless deployment

### Performance Monitoring
- **Vercel Analytics**: Integrated analytics for performance monitoring
- **Speed Insights**: Real user performance data and Core Web Vitals
- **Web Vitals Monitoring**: Custom Web Vitals tracking in `/src/lib/web-vitals.ts`
- **Bundle Analysis**: Webpack bundle analyzer via `pnpm build:analyze`
- **Lighthouse Integration**: Automated performance audits in CI/CD
- **Production Optimization**: Standard Next.js optimization for Vercel serverless functions

### Performance Features
- **Real-time Monitoring**: Live performance data from production users
- **Core Web Vitals**: LCP, FID, CLS tracking and alerting
- **Resource Optimization**: Lazy loading and code splitting
- **Cache Strategies**: Optimized caching headers for static assets and API responses
- **Database Performance**: Indexed indexing and query optimization

## Styling System

### Design Tokens
- Complete CSS custom properties system in `/src/styles/globals.css`
- Comprehensive theme system with 4 distinct themes: Dark, Light, System, High Contrast
- WCAG AA compliant color contrast ratios
- Status-based color classes (`.status-success`, `.status-error`, etc.)

### Theme Architecture
- **Dark Theme**: Default dark mode with high contrast (AAA rating for primary text)
- **Light Theme**: Clean light interface with optimal readability
- **System Theme**: Automatically follows OS preference
- **High Contrast Theme**: Enhanced contrast for accessibility
- CSS custom properties with dynamic theme switching
- Local storage persistence for theme preferences
- Theme debugger available with `Ctrl+Shift+T`

### Component Styling
- Tailwind CSS utility classes with custom design tokens
- Consistent spacing and typography scales
- Player-specific styling variables for audio interface
- All shadcn/ui components are theme-aware

### Responsive Design
- Mobile-first approach with Tailwind responsive breakpoints
- Touch-friendly controls for mobile devices
- Adaptive layouts for different screen sizes

## Auto-Transcription Feature

The application includes intelligent auto-transcription:
- Automatically detects when files need transcription
- Starts transcription without user intervention
- Provides real-time progress updates
- Maintains state synchronization across components
- Handles errors gracefully with retry mechanisms

## Testing and Quality Assurance

The application maintains comprehensive test infrastructure with Vitest and React Testing Library, though the current development workflow emphasizes type safety and code quality through automated linting and formatting.

### Testing Framework Configuration
- **Test Runner**: Vitest with TypeScript support
- **Testing Library**: React Testing Library for component testing
- **Mock Browser APIs**: fake-indexeddb for IndexedDB testing
- **Coverage**: Available via `pnpm test:coverage`

### Available Test Commands
```bash
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Run tests with coverage report
pnpm test:ui          # Run tests with UI interface
```

### Test Structure
- **Database Tests**: `/src/lib/db/__tests__/db.test.ts` - Database operations and migrations
- **API Tests**: `/src/app/api/*/__tests__/` - API route testing
- **Utility Tests**: `/src/lib/utils/__tests__/` - Utility function testing
- **Component Tests**: Component-level tests in development

### Mock Configuration
```typescript
// Browser API mocks for testing
import { fakeIndexedDB } from 'fake-indexeddb'

// Mock implementations
global.indexedDB = fakeIndexedDB()
global.Blob = class MockBlob {}
global.URL.createObjectURL = jest.fn()
```

### Type Safety
- Strict TypeScript configuration
- Comprehensive type definitions in `/src/types/`
- Zod schemas for API request/response validation
- Type-safe database operations via DBUtils generics

### Code Quality
- Biome.js for linting and formatting
- Automatic import sorting and cleanup
- Consistent code style across the codebase
- Comprehensive error handling with unified error utilities

### Recent Cleanup and Optimization
- **Migration to Groq SDK**: Simplified AI integration by removing AI SDK abstraction layer
- **File Management Simplification**: Removed grid/list view toggle, implemented unified FileManager component
- **Database Utilities**: Replaced repository pattern with simplified DBUtils class for direct operations
- **Memory Management**: Added WeakMap for audio URL caching to prevent memory leaks
- **State Management Optimization**: Consolidated transcription hooks and removed redundant state management
- **Performance Optimization**: Streamlined database operations and improved indexing
- **Error Handling Enhancement**: Implemented comprehensive error handling system with retry mechanisms
- **Multi-language Support**: Added transcription language context for Chinese, English, and Japanese
- **Rate Limiting**: Implemented sophisticated API protection with sliding window algorithm

## Theme System & Debugging

### Theme Architecture
The application supports 4 distinct themes with WCAG AA compliance:
- **Dark Theme**: Default dark mode with high contrast
- **Light Theme**: Clean light interface with optimal readability
- **System Theme**: Automatically follows OS preference
- **High Contrast Theme**: Enhanced contrast for accessibility

### Theme Implementation
- **CSS Custom Properties**: Complete design token system in `/src/app/globals.css`
- **Dynamic Theme Switching**: Real-time theme changes without page reload
- **Local Storage Persistence**: Theme preferences automatically saved
- **Component Integration**: All shadcn/ui components theme-aware
- **Semantic Color Variables**: Status-based colors (`.status-success`, `.status-error`, etc.)

### Theme Development
- **Theme Debugging**: Press `Ctrl+Shift+T` to open the theme debugger
- **Design Token System**: Comprehensive CSS variable structure
- **Component Theming**: Consistent theming across all components
- **Responsive Theming**: Mobile-first theme breakpoints

### Code Quality Tools Configuration

#### Biome.js Configuration
```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": {
        "noUnknownAtRules": "off"
      }
    }
  }
}
```

#### Package Management
- **Package Manager**: pnpm (required version >=8.0.0)
- **Node Engine**: >=18.0.0
- **Frozen Lockfile**: Ensures reproducible builds
- **Husky**: Git hooks for pre-commit quality checks
