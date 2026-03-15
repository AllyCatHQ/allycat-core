#!/usr/bin/env node
/**
 * Memory Benchmark — Quick & Full Scanner
 *
 * Orchestrates isolated per-measurement subprocesses to get clean RSS numbers.
 * Each (scanner × file-size × concurrency) combination runs in a fresh Node.js
 * process so accumulated heap from prior runs never pollutes the next baseline.
 *
 * ─── Why subprocess isolation matters ────────────────────────────────────────
 * V8 rarely returns RSS to the OS between allocations. A long-lived process
 * accumulates fragmented heap — each baseline is higher than the last, making
 * deltas meaningless. A fresh process per measurement eliminates this.
 *
 * ─── Why file size matters ───────────────────────────────────────────────────
 * Memory per slot is NOT a fixed number. A small HTML file and a large
 * component file produce very different per-slot costs. The constant in
 * configLoader.js must cover the worst case (large/complex files), not the
 * average. This benchmark shows you the full spread so you can make that call.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *   node --expose-gc scripts/benchmark-memory.js           # quick + full
 *   node --expose-gc scripts/benchmark-memory.js --quick   # quick only
 *   node --expose-gc scripts/benchmark-memory.js --full    # full only
 *
 *   --expose-gc is forwarded automatically to each worker subprocess.
 */

import { spawnSync } from 'child_process';
import os   from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER    = path.resolve(__dirname, 'benchmark-memory-worker.js');

// ─── CLI flags ────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const RUN_QUICK = !args.includes('--full');
const RUN_FULL  = !args.includes('--quick');

// Forward --expose-gc to workers if parent was started with it
const EXPOSE_GC = process.execArgv.includes('--expose-gc');

// ─── Test matrix ─────────────────────────────────────────────────────────────
const QUICK_C = [1, 2, 4, 8, 16];
const FULL_C  = [1, 2, 3, 4];        // Playwright is slow — keep this short
const SIZES   = ['small', 'medium', 'large'];

// ─── Subprocess runner ────────────────────────────────────────────────────────
/**
 * Spawn a fresh worker process for one measurement.
 * Returns the parsed JSON result from the worker's stdout.
 */
function runWorker(scanner, size, concurrency) {
    const nodeFlags = EXPOSE_GC ? ['--expose-gc'] : [];

    const proc = spawnSync(
        process.execPath,
        [...nodeFlags, WORKER, scanner, size, String(concurrency)],
        { encoding: 'utf8', timeout: 180_000 }
    );

    if (proc.error) {
        return { ok: false, error: proc.error.message };
    }

    // Worker writes exactly one JSON line to stdout
    const lastLine = (proc.stdout || '').trim().split('\n').pop() || '';
    try {
        return JSON.parse(lastLine);
    } catch {
        return { ok: false, error: proc.stderr?.trim() || proc.stdout?.trim() || 'worker produced no output' };
    }
}

// ─── Output helpers ───────────────────────────────────────────────────────────
function printTable(title, rows, columns) {
    if (rows.length === 0) return;

    const widths = columns.map(c =>
        Math.max(c.label.length, ...rows.map(r => String(r[c.key] ?? '—').length))
    );

    const LINE = '─'.repeat(widths.reduce((s, w) => s + w + 3, 0));
    console.log(`\n┌ ${title}`);
    console.log(LINE);
    console.log(columns.map((c, i) => c.label.padEnd(widths[i])).join('   '));
    console.log(widths.map(w => '─'.repeat(w)).join('   '));
    rows.forEach(r => {
        console.log(columns.map((c, i) => String(r[c.key] ?? '—').padEnd(widths[i])).join('   '));
    });
    console.log(LINE);
}

function printRecommendation(label, allRows) {
    const largeRows = allRows.filter(r => r.size === 'large');
    if (largeRows.length === 0) return;

    const worst = Math.max(...largeRows.map(r => r.perSlot));
    const rec   = Math.ceil(worst * 1.2);

    console.log(`\n  Worst-case per-slot (large files, all concurrency levels): ${worst} MB`);
    console.log(`  Recommended constant (+20% safety margin): ${rec} MB`);
    console.log(`  Update src/utils/configLoader.js:`);
    console.log(`    MEMORY_PER_SLOT[SCAN_MODES.${label}] = ${rec} * 1024 * 1024`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
    const totalMb = (os.totalmem() / 1024 ** 3).toFixed(1);

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(  '║     AllyCat Core — Memory Benchmark v2             ║');
    console.log(  '║     Each row = isolated fresh subprocess             ║');
    console.log(  '╚══════════════════════════════════════════════════════╝');
    console.log(`  Node.js : ${process.version}`);
    console.log(`  OS      : ${os.platform()} ${os.release()}`);
    console.log(`  RAM     : ${totalMb} GB total`);
    console.log(`  GC ctrl : ${EXPOSE_GC ? 'YES — forwarded to workers' : 'NO  — add --expose-gc for cleaner results'}`);

    // ── Quick Scanner ─────────────────────────────────────────────────────────
    if (RUN_QUICK) {
        console.log('\n\n══ QUICK SCANNER (JSDOM + axe-core) ══════════════════');
        console.log('  Current constant : MEMORY_PER_SLOT[quick] = 150 MB');
        console.log('  Baseline         : measured after module load + GC settle');
        console.log('  Delta            : peak RSS − baseline (Node process only)');
        console.log('  Per-slot         : delta / concurrency\n');

        const allRows = [];

        for (const size of SIZES) {
            const rows = [];
            for (const c of QUICK_C) {
                process.stdout.write(`  ${size.padEnd(6)} c=${String(c).padStart(2)} … `);
                const r = runWorker('quick', size, c);

                if (!r.ok) {
                    console.log(`ERROR: ${r.error}`);
                    continue;
                }

                process.stdout.write(`${r.perSlot} MB/slot\n`);
                rows.push(r);
                allRows.push(r);
            }

            printTable(`Quick — ${size} files`, rows, [
                { key: 'concurrency', label: 'Concurrency'   },
                { key: 'baselineRss', label: 'Baseline (MB)' },
                { key: 'peakNode',    label: 'Peak (MB)'     },
                { key: 'deltaNode',   label: 'Delta (MB)'    },
                { key: 'perSlot',     label: 'Per-slot (MB)' },
            ]);
        }

        console.log('\n  ── Quick Scanner Recommendation ──');
        printRecommendation('QUICK', allRows);
    }

    // ── Full Scanner ──────────────────────────────────────────────────────────
    if (RUN_FULL) {
        console.log('\n\n══ FULL SCANNER (Playwright/Chromium + axe-core) ══════');
        console.log('  Current constant : MEMORY_PER_SLOT[full] = 500 MB');
        console.log('  ΔNode            : Node.js process RSS delta');
        console.log('  ΔChromium        : OS-level Chromium subprocess RSS delta');
        console.log('                     (invisible to Node — queried via OS)');
        console.log('  Per-slot total   : (ΔNode + ΔChromium) / concurrency\n');

        const allRows = [];

        for (const size of SIZES) {
            const rows = [];
            for (const c of FULL_C) {
                process.stdout.write(`  ${size.padEnd(6)} c=${c} … `);
                const r = runWorker('full', size, c);

                if (!r.ok) {
                    console.log(`ERROR: ${r.error}`);
                    continue;
                }

                process.stdout.write(`${r.perSlot} MB/slot  (ΔNode ${r.deltaNode}  ΔChromium ${r.deltaChromium})\n`);
                rows.push(r);
                allRows.push(r);
            }

            printTable(`Full — ${size} files`, rows, [
                { key: 'concurrency',   label: 'Concurrency'     },
                { key: 'baselineRss',   label: 'Node base (MB)'  },
                { key: 'peakNode',      label: 'Node peak (MB)'  },
                { key: 'peakChromium',  label: 'Chromium (MB)'   },
                { key: 'deltaNode',     label: 'ΔNode (MB)'      },
                { key: 'deltaChromium', label: 'ΔChromium (MB)'  },
                { key: 'totalDelta',    label: 'ΔTotal (MB)'     },
                { key: 'perSlot',       label: 'Per-slot (MB)'   },
            ]);
        }

        console.log('\n  ── Full Scanner Recommendation ──');
        printRecommendation('FULL', allRows);
    }

    // ── Interpretation Guide ──────────────────────────────────────────────────
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  HOW TO READ THESE RESULTS                               ║
╠══════════════════════════════════════════════════════════╣
║  Each row is a completely isolated fresh process.        ║
║  Baselines should be stable — any spike is real.         ║
║                                                          ║
║  1. Per-slot varies by file size. Small → low, large →   ║
║     high. This is real, not noise. The constant in       ║
║     configLoader.js must cover the large file row.       ║
║                                                          ║
║  2. If per-slot GROWS as concurrency increases, GC       ║
║     pressure is real at high concurrency. Use the        ║
║     highest-concurrency value as your upper bound.       ║
║                                                          ║
║  3. If ΔChromium = 0 on all full-scan rows, the OS      ║
║     query failed. Try running with admin rights.         ║
║                                                          ║
║  4. Baselines may differ slightly between rows — that    ║
║     is normal OS variance in a fresh process.            ║
╚══════════════════════════════════════════════════════════╝`);

    console.log('\n  Done.\n');
}

main();
