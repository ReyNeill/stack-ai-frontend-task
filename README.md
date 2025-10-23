# Stack AI Knowledge Base File Picker

A Next.js 16 application that mirrors Stack AI's Google Drive picker experience. It lets you browse a connected drive, select files or folders, and orchestrate indexing or de-indexing operations on an existing knowledge base with optimistic UI updates.

## Features

- **Drive navigation** – Lazy-load folder contents, breadcrumb navigation, and skeleton placeholders keep navigation responsive.
- **Selection intelligence** – Multi-select with duplicate prevention (parents remove nested selections) and quick clear actions.
- **Indexing workflow** – Optimistic status updates when adding resources to a knowledge base, including background sync triggers.
- **De-indexing** – Remove previously indexed files with instant UI rollback and connection source cleanup.
- **Status visibility** – Badge indicators for `indexed`, `processing`, `error`, and `not indexed` states per resource.
- **Productivity helpers** – Inline search, sort-by-name/date toggles, and keyboard-friendly controls keep the UI snappy.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS (utility-first, Tailwind v4 syntax)
- **Data & State**: TanStack Query for server state, Zustand for selection bookkeeping
- **UI**: Lightweight Shadcn-inspired primitives, Sonner toasts, Lucide icons
- **API layer**: Server-side proxy routes with Supabase-authenticated calls to the Stack AI REST API

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Description |
   | --- | --- |
   | `STACK_SUPABASE_URL` | Supabase auth base (`https://sb.stack-ai.com`). |
   | `STACK_SUPABASE_ANON_KEY` | Provided anon key for token exchange. |
   | `STACK_API_BASE_URL` | REST API root (`https://api.stack-ai.com`). |
   | `STACK_AUTH_EMAIL` | Provided Stack AI email (`stackaitest@gmail.com`). |
   | `STACK_AUTH_PASSWORD` | **Replace `changeme` with the supplied password** (`!z4ZnxkyLYs#vR`). |

   > **Note:** Keep `.env.local` out of version control. All server routes read from `process.env`, so the password never reaches the browser.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` to use the file picker.

## Useful Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run lint` | Lint the project with ESLint. |
| `npm run build` | Build for production (requires environment variables). |
| `npm run start` | Run the production build locally. |

To run `npm run build` locally without editing your shell environment, prefix the command with the necessary variables:

```bash
STACK_SUPABASE_URL=... STACK_SUPABASE_ANON_KEY=... STACK_API_BASE_URL=... \
STACK_AUTH_EMAIL=... STACK_AUTH_PASSWORD=... npm run build
```

## How It Works

- **Server-side proxy**: `/app/api/stack/*` routes fetch a Supabase access token, call Stack AI endpoints, and cache tokens with automatic refresh.
- **Client UI**: The `FilePicker` component consumes those API routes via TanStack Query, layering optimistic updates and background invalidation for a smooth experience.
- **Selection model**: A small Zustand store tracks selections across navigation, pruning descendants when a folder is selected to avoid redundant indexing payloads.
- **Index/de-index flows**: Indexing updates the knowledge base's `connection_source_ids`, triggers a sync, and marks UI rows as `processing`. De-indexing deletes resources and prunes the source list before re-syncing.

## Architecture & Design Decisions

### 1. Optimistic UI Pattern

**Problem**: Waiting for API responses creates a sluggish experience.

**Solution**: Implement optimistic updates using React Query's `onMutate`, `onError`, and `onSuccess` lifecycle:

```typescript
onMutate: async (variables) => {
  // 1. Cancel in-flight queries to prevent race conditions
  await queryClient.cancelQueries({ queryKey: ['resources'] });
  
  // 2. Save current state for rollback
  const previous = queryClient.getQueryData(['resources']);
  
  // 3. Optimistically update UI immediately
  queryClient.setQueryData(['resources'], (old) => [...old, newResource]);
  
  return { previous }; // Context for rollback
},
onError: (_error, _variables, context) => {
  // Rollback on error
  queryClient.setQueryData(['resources'], context.previous);
  toast.error('Failed to index. Please try again.');
},
onSuccess: () => {
  // Confirm and invalidate to fetch fresh data
  queryClient.invalidateQueries({ queryKey: ['resources'] });
}
```

**Benefits**:
- Instant visual feedback
- Graceful error handling with automatic rollback
- Users can continue working immediately

### 2. Duplicate Prevention Strategy

**Problem**: Re-indexing a resource created duplicate entries showing "Error" badges.

**Solution**: Check for existing resources before optimistic update:

```typescript
// Check what already exists
const existingIds = new Set(previous.data.map(item => item.resource_id));

// Update existing resources (change status)
const updatedData = previous.data.map(item => {
  const updated = resourcesToIndex.find(r => r.resource_id === item.resource_id);
  return updated || item;
});

// Only add truly new resources
const newResources = resourcesToIndex.filter(r => !existingIds.has(r.resource_id));
```

### 3. Non-Blocking Sync Endpoint

**Problem**: Stack AI's `/knowledge_bases/sync/trigger` endpoint returns 500 errors intermittently.

**Solution**: Make sync call non-blocking:

```typescript
try {
  await triggerKnowledgeBaseSync(knowledgeBaseId, org.org_id);
} catch (error) {
  console.error('Sync failed:', error);
  // Continue anyway - resources are already in connection_source_ids
  // Stack AI's backend will pick them up automatically
}
```

**Why this works**:
- Resources are already added to `connection_source_ids` (the important part)
- Stack AI has automatic background syncing
- Users can continue working without interruption
- Demonstrates graceful degradation

### 4. Folders-First Sorting

**Problem**: Mixed folders and files make navigation confusing.

**Solution**: Two-tier sorting algorithm:

```typescript
sort((a, b) => {
  // Tier 1: Directories always first (like Finder/Explorer)
  if (a.type === 'directory' && b.type !== 'directory') return -1;
  if (a.type !== 'directory' && b.type === 'directory') return 1;
  
  // Tier 2: Sort by user's selected field within each tier
  return sortByField(a, b);
});
```

This mimics native file explorer behavior for intuitive navigation.

### 5. Prefetching Strategy

**Problem**: Clicking folders shows loading states, breaking flow.

**Solution**: Prefetch folder contents on hover:

```typescript
<div onMouseEnter={() => startPrefetch(folder)}>
  {/* Folder item */}
</div>
```

### 6. Sticky Table Headers

**Challenge**: Shadcn's `<Table>` wraps content in a div with `overflow-x-auto`, breaking sticky positioning.

**Solution**: Override with `containerClassName="overflow-visible"`:

```tsx
<Table containerClassName="overflow-visible">
  <TableHeader className="sticky top-0 z-30 bg-white">
```

The scroll container is moved to a parent div, allowing headers to stick properly.

## Edge Cases Handled

1. **De-indexing while processing**: Updates status immediately, backend reconciles
2. **Network failures**: Automatic rollback with error toasts
3. **Stale data**: React Query auto-invalidates after mutations
4. **Large folders**: Lazy loading prevents fetching entire tree
5. **Concurrent mutations**: Query cancellation prevents race conditions
6. **Token expiration**: Automatic refresh with retry logic

## Performance Optimizations

- ✅ **Lazy loading**: Only fetch current folder (not entire tree)
- ✅ **Memoization**: `useMemo` for expensive computations (sorting, filtering)
- ✅ **Prefetching**: Load folder contents on hover
- ✅ **Optimistic updates**: No waiting for API responses
- ✅ **Skeletons over spinners**: Better perceived performance
- ✅ **Component splitting**: Reduced bundle size and faster initial load
- ✅ **Debounced search**: Prevents excessive API calls

## Future Enhancements

- Create or rename knowledge bases directly from the picker
- Surface richer metadata (owners, share status) and column customization
- Add tests (unit + playthrough) around selection logic and optimistic flows
- Support additional providers beyond Google Drive
- Virtual scrolling for folders with 1000+ items
- Keyboard navigation (arrow keys, shortcuts)

## License

The provided credentials and assets belong to Stack AI for take-home evaluation. Please do not redistribute.
