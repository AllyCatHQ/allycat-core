/**
 * Browser Opener
 *
 * Opens a local file in the system's default browser.
 * Cross-platform: macOS, Windows, Linux.
 * Zero external dependencies — uses Node.js built-in child_process.
 *
 * NOTE: only pass trusted targets (APP_LINKS constants or local report
 * paths). On Windows, `cmd /c start` mangles targets containing & or %.
 *
 * @module utils/browserOpener
 */

import { spawn } from 'child_process';

/**
 * Open a file path or URL in the default browser.
 * Fails silently — if the browser can't open, the scan still succeeds.
 * The child is detached and unref'd so it never keeps the CLI alive
 * (xdg-open can otherwise block the event loop until the browser closes).
 *
 * @param {string} target - Absolute path or URL to open
 */
export function openInBrowser(target) {
    const resolved = resolveOpenCommand(target);
    if (!resolved) return;

    try {
        const child = spawn(resolved.bin, resolved.args, {
            detached: true,
            stdio: 'ignore',
        });
        // Without a listener, a spawn 'error' event (e.g. binary missing)
        // would crash the process — swallow it, the link is already printed.
        child.on('error', () => {});
        child.unref();
    } catch {
        // Best-effort by design.
    }
}

/**
 * Resolve the platform binary and argument list for opening a target.
 * Returns null on unsupported platforms.
 *
 * @param {string} target
 * @returns {{ bin: string, args: string[] } | null}
 */
function resolveOpenCommand(target) {
    switch (process.platform) {
        case 'darwin':  return { bin: 'open',     args: [target] };
        case 'win32':   return { bin: 'cmd.exe',  args: ['/c', 'start', '', target] };
        case 'linux':   return { bin: 'xdg-open', args: [target] };
        default:        return null;
    }
}
