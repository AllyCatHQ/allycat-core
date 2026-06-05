#!/usr/bin/env node
/**
 * benchmark-memory-worker.js
 *
 * Runs ONE measurement: a single (scanner, size, concurrency) combination.
 * Spawned as a fresh subprocess by benchmark-memory.js for each data point.
 *
 * Why subprocess isolation?
 *   V8 never fully returns RSS to the OS between scans inside a long-lived
 *   process. Each run leaves fragmented heap that inflates the next baseline.
 *   A fresh process gives us a clean heap and predictable GC state every time.
 *
 * Args:  <scanner: quick|full>  <size: small|medium|large>  <concurrency: int>
 * Stdout: one JSON line with the measurement result
 */

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const [,, scannerType, size, concurrencyStr] = process.argv;
const concurrency = parseInt(concurrencyStr, 10);

if (!scannerType || !size || isNaN(concurrency)) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'usage: worker.js <quick|full> <small|medium|large> <int>' }) + '\n');
    process.exit(1);
}

// ─── HTML Fixture Generator ───────────────────────────────────────────────────
function generateHtml(size, index) {
    const counts = { small: 10, medium: 50, large: 200 };
    const n = counts[size] ?? 10;

    const cards = Array.from({ length: n }, (_, i) => `  <article>
    <img src="img-${i}.jpg">
    <h${(i % 3) + 2}>Section ${i} — copy ${index}</h${(i % 3) + 2}>
    <p>${'Lorem ipsum dolor sit amet. '.repeat(4)}</p>
    <button>Action ${i}</button>
    <a href="#">Link ${i}</a>
    <input type="text" placeholder="Field ${i}">
    <div role="button" tabindex="-1">Custom ${i}</div>
  </article>`).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Bench ${size} #${index}</title></head>
<body><main>
  <h1>Fixture ${size} copy ${index} (${n} cards)</h1>
${cards}
</main></body>
</html>`;
}

// ─── Memory helpers ───────────────────────────────────────────────────────────
const rss = () => process.memoryUsage().rss / 1024 / 1024;

/**
 * Query Chromium subprocess RSS from the OS.
 * Playwright renderers are separate OS processes — invisible to Node's own RSS.
 * Returns 0 if Playwright isn't running or the query fails.
 */
function chromiumMb() {
    try {
        if (os.platform() === 'win32') {
            const raw = execSync(
                'powershell -Command "(Get-Process -Name chrome,chromium -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum"',
                { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 }
            ).trim();
            const v = parseInt(raw, 10);
            return isNaN(v) ? 0 : v / 1024 / 1024;
        }
        const raw = execSync(
            'ps -o rss= -C chrome -C chromium 2>/dev/null || echo 0',
            { encoding: 'utf8', shell: '/bin/bash', timeout: 3000 }
        ).trim();
        return raw.split('\n').reduce((s, v) => s + (parseInt(v.trim(), 10) || 0), 0) / 1024;
    } catch {
        return 0;
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const FIXTURE_DIR = path.resolve(ROOT, 'scripts', `.bench-worker-${process.pid}`);
    mkdirSync(FIXTURE_DIR, { recursive: true });

    // Generate concurrency × 2 files so the queue is always full
    const files = [];
    for (let i = 0; i < concurrency * 2; i++) {
        const fp = path.join(FIXTURE_DIR, `${size}-${i}.html`);
        writeFileSync(fp, generateHtml(size, i), 'utf8');
        files.push(fp);
    }

    const config = {
        selectedStandard: 'wcag-aa',
        rules:       { rtl: false, level: 'AA' },
        scan:        { defaultMode: 'quick' },
        ai:          { enabled: false },
        performance: { concurrency },
    };

    try {
        // Import scanner module BEFORE taking baseline.
        // Module load (axe-core ~1MB, JSDOM, Playwright) is a fixed one-time cost —
        // not a per-slot cost. We want to measure only the incremental scan cost.
        const scanner = scannerType === 'full'
            ? (await import('../src/engine/scanners/fullScanner.js')).runFullAudit
            : (await import('../src/engine/scanners/quickScanner.js')).runQuickAudit;

        // Let V8 settle after module load
        if (global.gc) global.gc();
        await new Promise(r => setTimeout(r, 400));

        // ── Baseline ─────────────────────────────────────────────────────────
        const baselineNode     = rss();
        const baselineChromium = chromiumMb();

        // ── Poll during scan ──────────────────────────────────────────────────
        let peakNode     = baselineNode;
        let peakChromium = baselineChromium;

        const timer = setInterval(() => {
            const n = rss();
            if (n > peakNode) peakNode = n;

            if (scannerType === 'full') {
                const c = chromiumMb();
                if (c > peakChromium) peakChromium = c;
            }
        }, 50);

        // ── Run scan ──────────────────────────────────────────────────────────
        await scanner(config, null, files, /*silent*/ true);

        clearInterval(timer);

        // Final sample after scan completes (catches late-peaking allocations)
        const finalNode = rss();
        if (finalNode > peakNode) peakNode = finalNode;

        // ── Compute results ───────────────────────────────────────────────────
        const deltaNode     = Math.max(0, peakNode - baselineNode);
        const deltaChromium = Math.max(0, peakChromium - baselineChromium);
        const totalDelta    = deltaNode + deltaChromium;

        process.stdout.write(JSON.stringify({
            ok:              true,
            scanner:         scannerType,
            size,
            concurrency,
            baselineRss:     +baselineNode.toFixed(1),
            peakNode:        +peakNode.toFixed(1),
            peakChromium:    +peakChromium.toFixed(1),
            deltaNode:       +deltaNode.toFixed(1),
            deltaChromium:   +deltaChromium.toFixed(1),
            totalDelta:      +totalDelta.toFixed(1),
            perSlot:         +(totalDelta / concurrency).toFixed(1),
        }) + '\n');

    } catch (err) {
        process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
    } finally {
        rmSync(FIXTURE_DIR, { recursive: true });
    }
}

main().catch(err => {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
    process.exit(1);
});
