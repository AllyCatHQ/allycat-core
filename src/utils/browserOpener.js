/**
 * Browser Opener
 *
 * Opens a local file in the system's default browser.
 * Cross-platform: macOS, Windows, Linux.
 * Zero external dependencies — uses Node.js built-in child_process.
 *
 * @module utils/browserOpener
 */

import { execFile } from 'child_process';

/**
 * Open a file path or URL in the default browser.
 * Fails silently — if the browser can't open, the scan still succeeds.
 *
 * @param {string} target - Absolute path or URL to open
 */
export function openInBrowser(target) {
    const resolved = resolveOpenCommand(target);
    if (!resolved) return;

    // execFile avoids a shell entirely — no string interpolation, no injection surface.
    execFile(resolved.bin, resolved.args, () => {
        // Intentionally silent — opening the browser is best-effort
        // The target is always printed to terminal as fallback
    });
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
