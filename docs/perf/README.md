# FPS Benchmark — How to Run (Issue #6)

Compares the TypeScript/Pixi build against the vanilla `arena-drifter/` Canvas build across 6 scenarios.

## Prerequisites

- Repo cloned locally
- `npm install` completed

## Steps

**1. Build the TS bundle for the benchmark harness**

```
npm run build:bench
```

This compiles TypeScript and produces an optimised bundle under `dist-local/` with a `/dist-local/` base path.

**2. Start the local server**

```
npm run bench:serve
```

Starts `http-server` at `http://localhost:3000` serving the repo root. Both `dist-local/` (TS) and `arena-drifter/` (vanilla) are accessible.

Or use the combined script:

```
npm run bench:web
```

**3. Open the benchmark page**

Navigate to `http://localhost:3000/benchmark.html` and click **Run Benchmark**.

The harness loads each build in a hidden iframe, runs 6 scenarios (idle/drift × 5/15/30 enemies), records avg FPS and worst frame time for each, then compares them.

**4. Record the result**

Copy the verdict and table into a new file at `docs/perf/<YYYY-MM-DD>_<label>.md`:

```markdown
# Benchmark Report — <label>

Date: <YYYY-MM-DD>
Branch: <branch>
Commit: <sha>

## Verdict

<paste verdict text>

## Results table

<paste HTML table as markdown or screenshot>
```

A result is considered **OK** if no scenario is more than 5% slower than the vanilla baseline.
If any scenario regresses beyond 5%, file a perf issue before declaring the phase closed.

## Existing reports

| Date | Label | Verdict |
|------|-------|---------|
| _(none yet — run after Phase 2 implementation lands)_ | | |
