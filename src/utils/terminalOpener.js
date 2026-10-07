/**
 * Terminal Opener
 *
 * Opens a new terminal tab running a given command.
 * Cross-platform: Windows (wt.exe → cmd fallback), macOS (osascript), Linux (x-terminal-emulator).
 * Mirrors the pattern from browserOpener.js — detached, unref'd, swallows ENOENT.
 *
 * If no terminal can be launched, prints the command for the user to paste.
 *
 * @module utils/terminalOpener
 */

import { spawn } from 'child_process';

/**
 * Open a new terminal tab running `bin args...`.
 * Fails gracefully — if the terminal can't open, prints the command instead of crashing.
 *
 * @param {string} bin - Executable to run in the new tab (e.g. 'claude')
 * @param {string[]} args - Arguments for that executable
 * @param {{ cwd?: string }} [options]
 */
export function openInTerminal(bin, args, options = {}) {
    const resolved = resolveTerminalCommand(bin, args);
    if (!resolved) {
        printFallback(bin, args);
        return;
    }

    try {
        const child = spawn(resolved.bin, resolved.args, {
            detached: true,
            stdio: 'ignore',
            cwd: options.cwd,
        });
        child.on('error', () => printFallback(bin, args));
        child.unref();
    } catch {
        printFallback(bin, args);
    }
}

/**
 * Resolve the platform binary and argument list for opening a terminal tab.
 * Returns null on unsupported platforms.
 *
 * @param {string} bin
 * @param {string[]} args
 * @returns {{ bin: string, args: string[] } | null}
 */
function resolveTerminalCommand(bin, args) {
    switch (process.platform) {
        case 'win32':
            // wt.exe new-tab -- <bin> <args...>
            // The '--' separator tells Windows Terminal that everything after is the commandline.
            return { bin: 'wt.exe', args: ['new-tab', '--', bin, ...args] };
        case 'darwin': {
            const cmd = [bin, ...args].map(escapeForAppleScript).join(' ');
            const script = `tell application "Terminal" to do script "${cmd}"`;
            return { bin: 'osascript', args: ['-e', script] };
        }
        case 'linux':
            return { bin: 'x-terminal-emulator', args: ['-e', bin, ...args] };
        default:
            return null;
    }
}

function escapeForAppleScript(str) {
    return str.replace(/(["\\])/g, '\\$1');
}

function printFallback(bin, args) {
    const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
    console.log('\n  Could not open a new terminal tab automatically.');
    console.log('  Run this command manually:\n');
    console.log(`    ${bin} ${quoted}\n`);
}
