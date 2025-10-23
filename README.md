# stack ai knowledge base file picker

this is the requested little app, a take on stack ai’s google drive picker. next.js 16, react 19 with activity based pre-fetches, previews, custom indexing, etc

## why it feels the way it does

- drive navigation stays light: lazy folder fetches, breadcrumbs, skeletons, and hover prefetching keep you moving without waiting.
- selection is smarter than it looks: picking a parent folder quietly drops any nested picks so we don’t spam the api.
- indexing and de-indexing are optimistic: the ui flips to “processing” instantly, then reconciles with the backend after a short poll.
- local “files” mode is playful: team photo, readme.txt, and the demo .mov preview inline so you can double-click and smile.

## stack under the hood

- **framework**: next.js 16 (app router) + react 19
- **styling**: tailwind css v4 classes layered with a few custom utility flourishes
- **data/state**: tanstack query manages server state; zustand keeps selection tidy
- **ui glue**: shadcn-flavored primitives, sonner toasts, lucide icons, and a bit of motion
- **api proxy**: next.js route handlers fetch supabase tokens, call stack ai’s rest api, and cache tokens defensively


## how the ui ticks

- **proxy routes** (`/app/api/stack/*`) fetch a supabase access token, call stack ai, and quietly refresh tokens before they expire.
- **filepicker** consumes those routes via tanstack query, layering optimistic cache updates, polling, and invalidation.
- **selection store** (zustand) makes sure picking a folder prunes its children so payloads stay small.
- **index/de-index loops** update `connection_source_ids`, flip items into a local “processing” set, and poll the knowledge base until the backend agrees.

## design decisions that matter

### optimistic ui everywhere

waiting for a roundtrip is a buzzkill. each mutation uses `onMutate` to stash previous state, updates the cache instantly, then rolls back if the api complains. to avoid flicker we also keep a `pendingResourceIds` set so anything mid-flight still shows as “processing”.

### no duplicate ghosts

before we touch the cache we check existing resource ids. if something is already there we update its status instead of pushing a duplicate row. fewer “error” badges, calmer users.

### non-blocking sync

stack ai’s sync endpoint occasionally throws a 500, so we treat it as “best effort”: wrap it in `try/catch`, log the failure, but keep going since the important bit—updating `connection_source_ids`—already happened.

### folders first, always

sorting keeps directories on top, then applies your chosen field (name or modified date). it mirrors the muscle memory from finder/explorer.

### prefetch on hover

hovering a folder kicks off a background fetch. by the time you click, data is ready and the ui stays snappy. there’s even a subtle toast to let you know we’re preloading.

### local previews that feel like macos

double-clicking a local file opens a glassy preview window with the familiar three dots. the red one closes, the yellow/green stay disabled. text pulls content via `fetch`, images/video render inline (the .mov autoplays, muted, with controls).


thanks for reading—have fun indexing!