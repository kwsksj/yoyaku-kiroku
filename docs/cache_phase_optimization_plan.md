## Cache Optimization Plan (Revised)

### Phase 1 — Cache Optimization Rebuild (High Priority)

- **Scope**  
  Switch the backend entirely to the lessonId/reservationIds fast path from `cache-phase1-fixes`, including the reliability fixes required for production. Legacy lookup paths will be removed so validation targets only the new logic.

- **Tasks**  
  - Update `src/backend/07_CacheManager.js` helpers to provide lesson lookups, reservation lookups, and cache synchronization with rebuild fallbacks for expired caches.  
  - Update `src/backend/05-3_Backend_AvailableSlots.js` / `src/backend/05-2_Backend_Write.js` to depend solely on the new helpers (legacy fallbacks removed).  
  - Regenerate backend declarations with `npm run types:refresh` and confirm all call sites use the updated signatures.

- **Validation**  
  - Manual: create, cancel, and waitlist reservations; verify availability views update and notifications fire.  
  - Automated: `npm run lint`, `npm run types:refresh`, `npm run types:check`.  
  - Performance: capture comparative timings (Logger or other instrumentation) before and after to ensure the intended speedup remains.  
  - Cache integrity: test warm cache, cold cache rebuild, and cache mutation after reservation add/remove to ensure lesson/reservation IDs stay consistent.

- **Exit Criteria**  
  - Lesson and reservation lookups succeed against cold/warm caches.  
  - Availability counts and waitlist behavior match expectations on representative data after the full switch.  
  - No regressions in reservation flows or API responses.

### Phase 2 — Follow‑Up Optimizations (Medium Priority)

- **Targets**  
  - Convert remaining full-scan code paths (e.g., `updateReservationDetails`, `notifyAvailabilityToWaitlistedUsers`) to the new cache helpers.  
  - Add timing logs or lightweight benchmarks to verify measurable improvements per feature.

- **Validation**  
  - Re-run Phase 1 validation for each increment.  
  - Confirm cache consistency after each optimization.

### Process & Communication

- Work continues on branch `cache-phase1-fixes`.  
- Obtain approval for this revised plan before implementing Phase 1.  
- Once Phase 1 passes validation, create a PR against `main`.  
- Begin Phase 2 only after Phase 1 is merged and stable in production.
