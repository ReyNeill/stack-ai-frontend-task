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

## Future Enhancements

- Create or rename knowledge bases directly from the picker.
- Surface richer metadata (owners, share status) and column customization.
- Add tests (unit + playthrough) around selection logic and optimistic flows.
- Support additional providers beyond Google Drive.

## License

The provided credentials and assets belong to Stack AI for take-home evaluation. Please do not redistribute.
