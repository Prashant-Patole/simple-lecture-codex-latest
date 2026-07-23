# Bug: Queue OFF freezes a running job until you click "ON"

## Root cause
In `src/components/admin/GapPatcherQueuePanel.tsx`, the orchestrator effect is gated entirely by `enabled`:

```ts
useEffect(() => {
  if (!enabled) return;   // <-- no polling AT ALL when OFF
  ...
  timer = setInterval(tick, 5000);
}, [enabled, queue]);
```

Consequences the user is seeing:
1. A job is picked up and `POST /api/patch` is fired → row moves to `running` with a `patch_run_id`.
2. User toggles **OFF**. The interval is cleared. Nothing ever polls `/api/patch/:id`, so the row stays `running` forever — even though the Gap Patcher server has actually finished.
3. User toggles **ON**. The effect re-mounts, `tick()` runs immediately, sees `status=done, exit_code=0` on the server, and *instantly* flips the row to `refreshing_cdn` → `completed` and triggers the CDN refresh. That's why it looks "instant" and "auto-fetches" on click.

Meaning of the toggle today is ambiguous: it's used both as "don't start new jobs" AND as "don't touch anything". The second meaning is the bug — we should always finish what we started.

## Fix plan

Change the semantics of the ON/OFF switch to:

- **ON**  = advance in-flight rows **and** start new `queued` rows.
- **OFF** = advance in-flight rows only; do **not** start new ones. A job already running on the Gap Patcher server will complete, refresh CDN, and close out normally.

### Edits (single file: `src/components/admin/GapPatcherQueuePanel.tsx`)

1. Remove the `if (!enabled) return;` early exit from the effect so the interval always runs.
2. Keep the effect dependency on `enabled` so the tick closure sees the latest value, but do not tear the interval down when it flips.
3. Inside `tick()`:
   - Always run the "advance in-flight row" branch (poll `/api/patch/:id`, handle done/failed, run CDN refresh).
   - Guard only the "pick next queued row" branch behind `if (!enabled) return;`. This is the sole thing the toggle should suppress.
4. Update the small helper text under the card title to reflect the new behavior: "OFF pauses starting new jobs. Any job already running will still finish and auto-refresh CDN."
5. Update the toast on toggle:
   - ON → "Queue started — new jobs will be picked up."
   - OFF → "Queue paused — running job will still finish."

### Not changing
- DB schema, edge functions, hooks, or any other page.
- Behavior when the tab is closed (browser-side orchestrator still needs the page open; that's a separate limitation, not this bug).

## Verification
1. Reload `/admin/coverage-analyzer`.
2. Toggle ON, queue 2 jobs. First one moves to `running`.
3. Toggle OFF while it's `running`. Wait — status should progress `running → refreshing_cdn → completed` on its own within the normal 5s polling.
4. Second job should stay `queued` (not started) until toggle is flipped ON again.
