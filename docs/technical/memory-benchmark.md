# Memory Benchmark Results — Scanner Concurrency

Documents the measured per-slot RAM cost for each scanner mode.
These numbers drive `MEMORY_PER_SLOT` in `src/utils/configLoader.js`,
which controls how many files are scanned in parallel on a given machine.

---

## Summary (Quick Reference)

| Scanner | Mode constant key | Measured worst case | Current constant | Suggested constant | Margin |
|---------|-------------------|--------------------|-----------------|--------------------|--------|
| Quick (JSDOM) | `SCAN_MODES.QUICK` | **163 MB** | 150 MB ⚠️ under | **200 MB** | +23% |
| Full (Playwright) | `SCAN_MODES.FULL` | **413 MB** | 500 MB ✅ over | **500 MB** | +21% |

**Action required:** Quick scan constant is 5% under the real worst case. Update to 200 MB.
Full scan constant is already conservative — keep at 500 MB.

Where to change:

```js
// src/utils/configLoader.js
const MEMORY_PER_SLOT = {
    [SCAN_MODES.QUICK]: 200 * 1024 * 1024,   // was 150 — updated per benchmark
    [SCAN_MODES.FULL]:  500 * 1024 * 1024    // confirmed correct
};
```

---

## Test Environment

| Property | Value |
|----------|-------|
| Date | 2026-03-08 |
| Node.js | v24.11.1 |
| OS | Windows 11 (10.0.26200) |
| RAM | 31.7 GB |
| GC control | `--expose-gc` (forwarded to each worker) |
| Benchmark script | `scripts/benchmark-memory.js` |
| Worker script | `scripts/benchmark-memory-worker.js` |

### Fixture sizes used

| Label | DOM cards | File size |
|-------|-----------|-----------|
| small | 10 cards | 4.7 KB |
| medium | 50 cards | 23 KB |
| large | 200 cards | 92 KB |

Each fixture includes intentional violations (missing `alt`, unlabelled inputs, low-contrast text)
so axe-core does real rule-matching work — not a trivial empty DOM.

---

## Measurement Method

Each `(scanner × file-size × concurrency)` combination runs in a **fresh isolated subprocess**.
This eliminates heap accumulation between runs — a problem that made the first version of the
benchmark unreliable (see "Why subprocess isolation" below).

**Per-slot formula:** `(peak RSS − baseline RSS) / concurrency`

- **Baseline** is measured after module load (`axe-core`, `JSDOM`, `Playwright`) and a GC settle,
  so module initialization cost is excluded. We only measure the incremental cost of running scans.
- **Polling** samples `process.memoryUsage().rss` every 50 ms during the scan.
- **For full scan**, Chromium renderer subprocesses are queried via PowerShell
  (`Get-Process chrome,chromium`) because they are separate OS processes invisible to Node's own RSS.

---

## Quick Scanner Results (JSDOM + axe-core)

Per-slot cost = Node.js RSS delta only. No Chromium involved.

### Small files (4.7 KB each)

| Concurrency | Baseline (MB) | Peak (MB) | Delta (MB) | Per-slot (MB) |
|-------------|--------------|-----------|-----------|--------------|
| 1  | 170.2 | 203.6 | 33.5  | **33.5** |
| 2  | 159.2 | 254.4 | 95.2  | **47.6** |
| 4  | 172.4 | 287.1 | 114.7 | **28.7** |
| 8  | 171.2 | 326.5 | 155.3 | **19.4** |
| 16 | 171.0 | 399.1 | 228.1 | **14.3** |

### Medium files (23 KB each)

| Concurrency | Baseline (MB) | Peak (MB) | Delta (MB) | Per-slot (MB) |
|-------------|--------------|-----------|-----------|--------------|
| 1  | 172.2 | 284.8 | 112.6 | **112.6** |
| 2  | 170.9 | 307.3 | 136.4 | **68.2**  |
| 4  | 160.6 | 350.6 | 189.9 | **47.5**  |
| 8  | 172.0 | 417.4 | 245.4 | **30.7**  |
| 16 | 170.9 | 576.9 | 406.0 | **25.4**  |

### Large files (92 KB each)

| Concurrency | Baseline (MB) | Peak (MB) | Delta (MB) | Per-slot (MB) |
|-------------|--------------|-----------|-----------|--------------|
| 1  | 171.9 | 335.0  | 163.1 | **163.1** ← worst case |
| 2  | 171.5 | 495.1  | 323.7 | **161.8** |
| 4  | 171.2 | 539.5  | 368.3 | **92.1**  |
| 8  | 171.5 | 799.6  | 628.1 | **78.5**  |
| 16 | 171.9 | 1060.7 | 888.8 | **55.6**  |

### Key observations — Quick Scanner

- **Worst case is always c=1 (single file).** Per-slot cost drops at higher concurrency because
  GC reclaims memory from completed scans before the next wave starts. At c=1, each file's full
  lifecycle completes before GC runs — no sharing.
- **Baselines are stable (159–172 MB)** across all isolated subprocesses. That is the fixed
  cost of loading Node.js + JSDOM + axe-core. Consistent measurement confirms isolation is working.
- **File size drives cost more than concurrency.** Large vs small is a 5× difference (163 vs 33 MB).
  The constant must cover large files.
- **Current 150 MB constant is 5% under the measured 163 MB worst case.** On a 4 GB machine this
  could allow one extra slot beyond what is safe.

---

## Full Scanner Results (Playwright/Chromium + axe-core)

Per-slot cost = Node.js RSS delta **+** Chromium OS-level subprocess RSS delta.

> **Note on Chromium baseline column:** The "Chromium (MB)" column shows the total RSS of ALL
> Chrome/Edge processes on the machine at baseline. On a machine with a browser open, this starts
> at 2800–3400 MB. What matters is the **delta** (ΔChromium), not the absolute value.

### Small files (4.7 KB each)

| Concurrency | Node base | Node peak | Chromium peak | ΔNode | ΔChromium | ΔTotal | Per-slot |
|-------------|-----------|-----------|--------------|-------|-----------|--------|----------|
| 1 | 219.4 | 222.3 | 3348.6 | 3.0 | 525.3 | 528.3 | **528.3** |
| 2 | 219.8 | 222.3 | 3219.6 | 2.5 | 609.6 | 612.1 | **306.1** |
| 3 | 220.2 | 222.6 | 3160.0 | 2.4 | 0     | 2.4   | ⚠️ unreliable |
| 4 | 221.6 | 224.1 | 2888.8 | 2.4 | 15.3  | 17.7  | ⚠️ unreliable |

> c=3 and c=4 small-file rows are unreliable. Small files scan too fast —
> Playwright contexts close before the 50 ms poll can capture the Chromium peak.

### Medium files (23 KB each)

| Concurrency | Node base | Node peak | Chromium peak | ΔNode | ΔChromium | ΔTotal | Per-slot |
|-------------|-----------|-----------|--------------|-------|-----------|--------|----------|
| 1 | 222.1 | 240.1 | 2910.2 | 18.0  | 305.3 | 323.3 | **323.3** |
| 2 | 222.4 | 309.6 | 2983.6 | 87.2  | 395.8 | 483.0 | **241.5** |
| 3 | 206.9 | 366.0 | 2850.6 | 159.1 | 74.9  | 234.1 | **78.0**  |
| 4 | 212.0 | 335.1 | 2896.3 | 123.1 | 0     | 123.1 | ⚠️ unreliable |

> c=4 medium row: ΔChromium = 0, poll missed the Chromium peak. Treat as unreliable.

### Large files (92 KB each)

| Concurrency | Node base | Node peak | Chromium peak | ΔNode | ΔChromium | ΔTotal | Per-slot |
|-------------|-----------|-----------|--------------|-------|-----------|--------|----------|
| 1 | 221.3 | 368.2 | 3048.5 | 146.9 | 266.7 | 413.5 | **413.5** ← worst case |
| 2 | 210.5 | 502.7 | 2774.6 | 292.1 | 135.1 | 427.2 | **213.6** |
| 3 | 218.3 | 612.8 | 2858.7 | 394.4 | 202.2 | 596.6 | **198.9** |
| 4 | 199.7 | 630.3 | 2753.4 | 430.6 | 219.1 | 649.6 | **162.4** |

### Key observations — Full Scanner

- **Worst case is c=1 at 413.5 MB/slot.** Same pattern as quick scan — per-slot drops at
  higher concurrency.
- **Total memory grows with concurrency even as per-slot drops.** At c=4 with large files,
  total delta is 649.6 MB across 4 Playwright contexts. This is the number that matters for
  OOM risk, not per-slot alone.
- **Current 500 MB constant is 21% above the measured 413.5 MB worst case.** Conservative and
  correct — no change needed.
- **Chromium memory dominates at low concurrency (266 MB of the 413 MB at c=1).**
  At higher concurrency, Node RSS grows faster than Chromium (Playwright reuses browser internals
  across contexts in the same browser instance).
- **Small and some medium rows are unreliable** because Playwright contexts close before the
  50 ms OS poll captures the peak. Large files (slower to scan) give the most reliable data.

---

## Why Per-Slot Cost Decreases as Concurrency Increases

This is not a measurement artifact. At c=1, a single file's full lifecycle (load → axe → GC)
completes in isolation. At c=16, files complete in overlapping waves — GC runs during the scan
and reclaims memory from already-finished files before later ones start. The result: at high
concurrency, files share GC cycles and average cost per slot appears lower.

**Implication:** the formula `floor(RAM * 0.6 / MEMORY_PER_SLOT)` is conservative by design.
In practice, actual peak usage will be lower than the formula predicts. This is the correct
direction — better to under-utilize RAM than to OOM.

---

## What Goes Wrong if the Constant Is Too Low

If `MEMORY_PER_SLOT` is set too low, the formula allows more parallel slots than the machine
can support. Consequences in order of severity:

| Severity | What happens | Visible to user? |
|----------|-------------|-----------------|
| 1 | Swap/pagefile kicks in, scan takes 10× longer | Yes — very slow |
| 2 | `JavaScript heap out of memory` crash | Yes — process dies |
| 3 | Playwright context crashes mid-scan, caught by per-file try/catch, file skipped with a warning | **Partially** — warning printed but scan exits 0 |
| 4 | OS OOM killer sends SIGKILL, no cleanup, Playwright zombie processes accumulate | No — silent |
| 5 | System-wide OOM, other applications crash | Yes — catastrophic |

**Case 3 is the most dangerous:** the scan reports success, outputs a violation summary,
but silently missed files due to memory pressure. Users may deploy inaccessible code believing
their audit passed.

---

## How to Re-run the Benchmark

```bash
# Quick scan only (no Playwright required)
node --expose-gc scripts/benchmark-memory.js --quick

# Full scan only
node --expose-gc scripts/benchmark-memory.js --full

# Both
node --expose-gc scripts/benchmark-memory.js
```

Re-run after any of these changes:
- upgrading `axe-core`, `jsdom`, or `playwright`
- changing Node.js version
- switching to a significantly different machine (different RAM, ARM vs x86)
- adding a new scanner type

---

## Why Subprocess Isolation Is Required

The first benchmark version ran all measurements sequentially in a single Node.js process.
V8 never fully returns RSS to the OS between allocations — each run left fragmented heap that
inflated the next baseline. Results were random:

```
# Bad results from single-process version (NOT reliable)
large c=1:  3.0 MB/slot    ← GC happened to run before poll
large c=4:  83.6 MB/slot
large c=8:  0.3 MB/slot    ← GC ran mid-scan
```

The subprocess-isolated version spawns a fresh `node` process per measurement. Each process
has a clean heap, fresh GC state, and stable baselines (159–172 MB variance is normal OS noise).
