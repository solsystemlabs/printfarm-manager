# Engineering Backlog

This backlog collects cross-cutting or future action items that emerge from reviews and planning.

Routing guidance:

- Use this file for non-urgent optimizations, refactors, or follow-ups that span multiple stories/epics.
- Must-fix items to ship a story belong in that story’s `Tasks / Subtasks`.
- Same-epic improvements may also be captured under the epic Tech Spec `Post-Review Follow-ups` section.

| Date | Story | Epic | Type | Severity | Owner | Status | Notes |
| ---- | ----- | ---- | ---- | -------- | ----- | ------ | ----- |
| 2025-10-16 | N/A | N/A | Bug | Medium | Developer | Open | Fix hydration warning in route test - `src/__tests__/routes/index.test.tsx:18` HTML structure issue (pre-existing, found during Story 1.1 review) |
| 2025-10-16 | 1.2 | 1 | Security | High | Developer | Resolved | Add `.dev.vars`, `.xata/`, `.xatarc` to `.gitignore` - FIXED: Added to .gitignore lines 10-12 |
| 2025-10-16 | 1.2 | 1 | Bug | High | Developer | Resolved | Implement Prisma Client singleton pattern - FIXED: Created `src/lib/db.ts` with singleton implementation |
| 2025-10-16 | 1.2 | 1 | Bug | High | Developer | Resolved | Fix connection pool leak in error paths - FIXED: Singleton pattern manages pool lifecycle |
| 2025-10-16 | 1.2 | 1 | DevOps | Medium | Developer | Resolved | Add `restart: unless-stopped` to Docker Compose - FIXED: Added to docker-compose.yml:7 |
| 2025-10-16 | 1.2 | 1 | TechDebt | Medium | Developer | Resolved | Replace `process.env` with `getContext('cloudflare').env` - ACCEPTED: process.env works in both local and Workers runtimes per TanStack Start design |
