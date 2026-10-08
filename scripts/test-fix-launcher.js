/**
 * test-fix-launcher.js
 *
 * Compares two approaches for launching `claude` from allycat fix:
 *   node scripts/test-fix-launcher.js same   → runs claude in the current terminal (stdio: inherit)
 *   node scripts/test-fix-launcher.js tab    → opens a new Windows Terminal tab with claude running
 *
 * Goal: see which UX we prefer before committing to one in fix.js.
 */

import { spawn } from 'child_process';

const mode = process.argv[2];

if (mode === 'same') {
    console.log('\n[same] Spawning claude in this terminal — stdio: inherit');
    console.log('[same] claude will take over. Press Ctrl+C or /exit to return.\n');

    const child = spawn('claude', ['hi'], {
        stdio: 'inherit',
        cwd: process.cwd(),
    });

    child.on('error', (err) => {
        if (err.code === 'ENOENT') {
            console.error('\n[same] Error: claude not found. Is Claude Code installed and on PATH?');
        } else {
            console.error('\n[same] Error:', err.message);
        }
    });

    child.on('exit', (code) => {
        console.log(`\n[same] claude exited (code ${code}). Back in allycat.`);
    });

} else if (mode === 'tab') {
    console.log('\n[tab] Opening a new Windows Terminal tab with claude running...');
    console.log('[tab] allycat exits immediately after launch.\n');

    const child = spawn('wt.exe', ['new-tab', '--', 'claude', 'hi'], {
        detached: true,
        stdio: 'ignore',
        cwd: process.cwd(),
    });

    child.on('error', (err) => {
        if (err.code === 'ENOENT') {
            console.error('[tab] Error: wt.exe not found. Windows Terminal is not installed.');
            console.error('[tab] Run manually: claude "hi"');
        } else {
            console.error('[tab] Error:', err.message);
        }
    });

    child.unref();
    console.log('[tab] Done — check your taskbar for the new terminal tab.');

} else {
    console.log(`
Usage:
  node scripts/test-fix-launcher.js same   → claude runs in THIS terminal
  node scripts/test-fix-launcher.js tab    → claude opens in a NEW Windows Terminal tab

Compare the two and pick which feel is right for allycat fix.
`);
}
