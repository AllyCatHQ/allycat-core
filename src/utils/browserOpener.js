/**
 * Browser Opener
 *
 * Opens a local file in the system's default browser.
 * Cross-platform: macOS, Windows, Linux.
 * Zero external dependencies — uses Node.js built-in child_process.
 *
 * @module utils/browserOpener
 */

import { exec } from 'child_process';

/**
 * Open a file path in the default browser.
 * Fails silently — if the browser can't open, the scan still succeeds.
 *
 * @param {string} filePath - Absolute path to the HTML file
 */
export function openInBrowser(filePath) {
    const command = resolveOpenCommand(filePath);
    if (!command) return;

    exec(command, (error) => {
        // Intentionally silent — opening the browser is best-effort
        // The file path is always printed to terminal as fallback
    });
}

/**
 * Resolve the correct open command for the current platform.
 *
 * @param {string} filePath
 * @returns {string|null}
 */
function resolveOpenCommand(filePath) {
    const escaped = `"${filePath.replace(/"/g, '\\"')}"`;

    switch (process.platform) {
        case 'darwin':  return `open ${escaped}`;
        case 'win32':   return `start "" ${escaped}`;
        case 'linux':   return `xdg-open ${escaped}`;
        default:        return null;
    }
}
