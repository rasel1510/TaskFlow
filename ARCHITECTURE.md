# FlowSync — High-Scale Architecture & Engineering Standards

> **Target Audience:** Staff / Principal Engineers, AI Agents, and Core Contributors  
> **System Target:** Millions of Concurrent Active Users  
> **Core Mandate:** Lowest Possible Time & Space Complexity, Noise-Free Minimalist UI, Resilient & Highly Scalable API Layer

---

## 1. Core Engineering Tenets

Every architectural decision and line of code in FlowSync must strictly adhere to these four core tenets:

1. **Optimal Computational & Space Complexity ($O(1)$ / $O(\log N)$ First)**:
   - Minimize CPU cycles and heap memory allocations.
   - Eliminate all accidental quadratic operations ($O(N^2)$), unbounded memory buffers, and table scans.
2. **Simple, Noise-Free User Interface**:
   - Zero cognitive clutter. High-signal, low-noise typography and layout inspired by Linear, Stripe, and Supabase.
   - Sub-100ms perceived latency with optimistic updates and zero Cumulative Layout Shift (CLS = 0).
3. **Enterprise-Grade Scalable API Tier**:
   - Separation of transport bridge (`src/app/api/`) and canonical business logic (`src/api/`).
   - Standardized API envelopes, deterministic cursor-based pagination, resilient fallback mechanisms, and strict input validation.
4. **Resilience & Production Hardening**:
   - Defensive programming, graceful degradation (database failure fallbacks), idempotency, connection pooling, and multi-tier caching.

---

## 2. Computational Complexity & Performance Budgets

To reliably support millions of users across thousands of concurrent organizations, developers must treat CPU cycles and RAM as finite, budgeted resources.

### 2.1 Time Complexity Standards

| Operation | Target Complexity | Forbidden Patterns | Mandatory Alternative |
| :--- | :--- | :--- | :--- |
| **Collection Lookups** | $O(1)$ | Iterating arrays via `.find()` or `.filter()` inside loops ($O(N^2)$). | Pre-index datasets into `Map<K, V>` or `Set<T>`. |
| **Data Deduplication / Merging** | $O(N)$ | Nested iteration (`arr1.filter(a => !arr2.some(b => b.id === a.id))`). | Use key-hashed `Map` or composite key sets. |
| **Sorting** | $O(N \log N)$ | Re-sorting already sorted records on every render/request. | Leverage DB indexes (`ORDER BY`) or memoized sort passes (`useMemo`). |
| **Pagination** | $O(1)$ / $O(\log N)$ | Deep offset pagination (`OFFSET 100000 LIMIT 20` requires scanning $N$ rows). | Keyset / Cursor-based pagination (`WHERE id > cursor LIMIT 20`). |
| **Search / Filtering** | $O(K)$ | In-memory regex filtering across hundreds of thousands of records. | Database GIN / Full-Text indexes or edge search indexes. |

### 2.2 Space Complexity & Memory Budgets

1. **Selective Field Projections ($O(K)$ columns)**:
   - **Never** perform `SELECT *` or unrestricted Prisma queries without explicit `select` blocks.
   - Only request the exact fields required by the presentation or calculation layer to prevent V8 heap bloat.
   ```typescript
   // ✅ RECOMMENDED: Precise projection, minimal memory footprint
   const users = await prisma.user.findMany({
     select: { id: true, name: true, email: true, avatar: true },
     take: 50,
   });

   // ❌ FORBIDDEN: Pulls unindexed JSON blobs, password hashes, and relations into memory
   const users = await prisma.user.findMany();
   ```

2. **Bounded Heap Footprint**:
   - Keep in-memory arrays strictly bounded ($K \le 100$ items per page).
   - For batch jobs, exports, or data migrations, process records in streaming batches (`cursor` iteration) rather than accumulating entire tables into RAM.

3. **Client-Side Memory Leak Prevention**:
   - Clean up event listeners, WebSocket subscriptions, timers, and abort controllers inside `useEffect` return blocks.
   - Avoid creating closures that retain references to large task trees or unmounted DOM nodes.

---

## 3. UI/UX Philosophy: Simple & Noise-Free

A high-scale productivity tool must respect user attention and cognitive bandwidth.

```
+-------------------------------------------------------------+
|                      FlowSync Workspace                     |
|  +---------+---------------------------------------------+  |
|  | Sidebar | Main View: Focused, Calm, High Information   |  |
|  | Minimal | Density without Clutter                     |  |
|  | Low-    | - Sub-100ms Interactions                    |  |
|  | chrome  | - Optimistic State Transitions              |  |
|  | Nav     | - Zero Visual Jitter (CLS = 0)              |  |
|  +---------+---------------------------------------------+  |
+-------------------------------------------------------------+
```

### 3.1 Design Guidelines
- **Zero Visual Noise**: Eliminate unnecessary borders, aggressive gradients, decorative badges, and high-frequency animations. Use subtle monochromatic palettes with singular, high-contrast semantic accents (e.g. status indicators).
- **Typography & Rhythm**: Inter-based typography scale with rigid line-height harmony. Use subdued neutrals (`text-muted-foreground`) for secondary metadata to let primary task titles breathe.
- **Fast Micro-Interactions**: Hover states, dropdown menus, and sheet drawers must transition smoothly under 150ms using CSS `ease-out`. Avoid heavy runtime animation libraries when standard CSS transforms suffice.
- **Optimistic UI Updates**:
  - Drag-and-drop kanban movements and checkbox toggles must immediately reflect in local UI state ($O(1)$ update).
  - Background network requests dispatch concurrently; in the rare event of an API error, gracefully roll back state and display an unobtrusive toast notification.

---

## 4. Scalable & Efficient API Architecture

All backend and edge route interactions must follow a predictable, multi-layered architecture.

### 4.1 Layer Separation Contract

```
Client / View Layer (React 19 / Client Components)
       ↓  typed fetch call
Client Service Layer (`src/api/services/*.service.ts`)
       ↓  HTTP request
Next.js App Router Bridge (`src/app/api/.../route.ts`)
       ↓  delegates directly
Canonical Business Logic Layer (`src/api/.../route.ts`)
       ↓  executes
Prisma ORM Client / Database Pooling (`src/lib/prisma.ts`)
```

- **`src/app/api/` (Bridge Files Only)**:
  - Must contain zero business logic.
  - Sole purpose is to satisfy Next.js App Router route discovery and re-export the canonical handler:
    ```typescript
    export { GET, POST } from '@/api/tasks/route';
    ```
- **`src/api/` (Canonical Business Logic)**:
  - Contains all input validation (Zod schemas), authorization checks, query planning, deduplication, and database mutations.
  - Reusable, testable, and completely independent of the framework routing layer.

### 4.2 Standard API Response Envelope

All API endpoints must return a standardized JSON envelope to guarantee predictable error handling, metadata transport, and client-side typing:

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;       // E.g., 'UNAUTHORIZED', 'NOT_FOUND', 'VALIDATION_ERROR'
    message: string;    // Human-readable message
    details?: unknown;  // Granular field-level validation errors
  };
  meta?: {
    page?: number;
    limit?: number;
    totalCount?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
    processingTimeMs?: number;
  };
}
```

### 4.3 Scalable Endpoint Conventions

1. **Deterministic Cursor Pagination**:
   ```typescript
   GET /api/tasks?limit=30&cursor=cm1q2w3e4...&projectId=proj_123
   ```
2. **Status Codes**:
   - `200 OK`: Successful read or idempotent update.
   - `201 Created`: Resource successfully created.
   - `400 Bad Request`: Validation failure (includes field errors).
   - `401 Unauthorized`: Missing or invalid session token.
   - `403 Forbidden`: Authenticated user lacks access to resource.
   - `404 Not Found`: Resource does not exist.
   - `409 Conflict`: Concurrency conflict (e.g. optimistic lock mismatch).
   - `429 Too Many Requests`: Rate limit reached.
   - `500 Internal Server Error`: Unhandled failure with sanitized error message (never leak raw stack traces to client).

---

## 5. Database Optimization & High-Concurrency Standards

### 5.1 Query Discipline
- **Indexed Access Paths**: Every query must filter or join against an indexed column (`@id`, `@unique`, or compound `@@index`).
- **Compound Indexes**: For high-volume multi-column queries (such as listing tasks by project and status):
  ```prisma
  @@index([projectId, status])
  @@index([assigneeId, dueDate])
  ```
- **N+1 Query Prevention**: Never execute Prisma calls inside iteration loops. Use `findMany({ where: { id: { in: ids } } })` or Prisma's relation `include`/`select` constructs.

### 5.2 Connection Management
- Utilize database connection pooling (PgBouncer, Supabase Pooler, or Prisma Accelerate) to support thousands of parallel serverless connections without exhausting PostgreSQL connection slots.
- Global singleton client initialization pattern in `src/lib/prisma.ts` to prevent hot-reload socket leaks during development and edge runtime warmups.

---

## 6. Multi-Tier Caching & Invalidation

When scaling to millions of users, the fastest database query is the query that never hits the database.

1. **L1 (Client / React SWR/Query Cache)**:
   - Cache immutable project metadata and user profiles client-side.
   - Stale-While-Revalidate pattern with deduplicated fetch requests.
2. **L2 (Edge / CDN Caching)**:
   - Cache public or read-heavy assets using appropriate headers:
     ```http
     Cache-Control: public, s-maxage=60, stale-while-revalidate=300
     ```
3. **L3 (Application Redis Cache)**:
   - High-throughput distributed key-value store for session validation, real-time presence, and aggregated sprint metrics.

---

## 7. Developer Pre-Merge Checklist

Before writing or submitting any pull request, verify:

- [ ] **Complexity**: Is any operation $O(N^2)$? Can it be reduced to $O(1)$ or $O(N)$ with a `Map`/`Set`?
- [ ] **Memory**: Are queries selecting only needed fields? Are large lists paginated?
- [ ] **UI Noise**: Is the interface clutter-free, responsive, and visually consistent with zero jarring shifts?
- [ ] **API Architecture**: Does business logic live strictly under `src/api/`? Are response envelopes normalized?
- [ ] **Resilience**: Are database failures gracefully caught with sensible fallbacks?
- [ ] **Type Safety**: Are there zero TypeScript `any` annotations and zero unresolved lint warnings?
