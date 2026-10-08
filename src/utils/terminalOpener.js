/**
 * Terminal Opener
 *
 * Opens a new terminal running a given command in a given folder.
 * Windows: a Windows Terminal tab (wt.exe). macOS: a Terminal.app window (osascript).
 * Linux: a window in the first terminal found (x-terminal-emulator, gnome-terminal,
 * konsole, xfce4-terminal, xterm).
 *
 * If no terminal can be opened (none installed, no desktop session, SSH on macOS,
 * or the launcher fails), prints a command the user can paste instead.
 *
 * @module utils/terminalOpener
 */

import { spawn as nodeSpawn } from 'child_process';
import { isCommandOnPath } from './commandOnPath.js';
import { quotePosix, quotePowerShell } from './shellQuote.js';

/** How long to watch the launcher for a failing exit code before trusting it. */
const LAUNCH_CHECK_MS = 1500;

/** Linux terminals in priority order, with the flag that runs a command (argv kept intact). */
const LINUX_TERMINALS = [
    ['x-terminal-emulator', '-e'],
    ['gnome-terminal',      '--'],
    ['konsole',             '-e'],
    ['xfce4-terminal',      '-x'],
    ['xterm',               '-e'],
];

/** sh script: cd to $1, then run the remaining args as the command. */
const CD_THEN_EXEC = 'cd -- "$1" && shift && exec "$@"';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Open a new terminal running `bin args...` in `cwd`.
 * Never throws. Falls back to printing a paste-able command.
 * Waits up to `waitMs` for the launcher to fail, so a denied permission or a
 * missing display is reported instead of failing silently.
 *
 * @param {string} bin - Executable to run (e.g. 'claude')
 * @param {string[]} args - Arguments for that executable
 * @param {{ cwd?: string, platform?: string, env?: NodeJS.ProcessEnv,
 *           spawn?: Function, hasCommand?: Function, waitMs?: number }} [options]
 *        Everything but `cwd` is for tests.
 * @returns {Promise<'launched' | 'fallback'>}
 */
export function openInTerminal(bin, args, options = {}) {
    const {
        cwd = process.cwd(),
        platform = process.platform,
        env = process.env,
        spawn = nodeSpawn,
        hasCommand = isCommandOnPath,
        waitMs = LAUNCH_CHECK_MS,
    } = options;

    const manual = () => formatManualCommand(bin, args, { platform, cwd });
    const launch = buildLaunch(bin, args, { platform, cwd, env, hasCommand });

    if (!launch) {
        printFallback(manual());
        return Promise.resolve('fallback');
    }

    return new Promise((resolve) => {
        let child;
        let timer;
        let settled = false;

        const settle = (outcome) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (outcome === 'fallback') printFallback(manual());
            child?.unref();
            resolve(outcome);
        };

        try {
            child = spawn(launch.bin, launch.args, { detached: true, stdio: 'ignore', cwd });
        } catch {
            settle('fallback');
            return;
        }

        child.on('error', () => settle('fallback'));
        child.on('exit', (code) => settle(code === 0 ? 'launched' : 'fallback'));
        timer = setTimeout(() => settle('launched'), waitMs);
    });
}

/**
 * The launcher command that opens a terminal running `bin args...` in `cwd`.
 * Returns null when no terminal can be opened here.
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {{ platform: string, cwd: string, env: NodeJS.ProcessEnv, hasCommand: Function }} context
 * @returns {{ bin: string, args: string[] } | null}
 */
export function buildLaunch(bin, args, { platform, cwd, env, hasCommand }) {
    switch (platform) {
        case 'win32':
            return { bin: 'wt.exe', args: ['new-tab', '-d', escapeForWt(cwd), '--', bin, ...args.map(escapeForWt)] };
        case 'darwin': {
            if (env.SSH_CONNECTION || env.SSH_TTY) return null;
            const shell = `cd ${quotePosix(cwd)} && ${[bin, ...args].map(quotePosix).join(' ')}`;
            return { bin: 'osascript', args: ['-e', `tell application "Terminal" to do script "${escapeForAppleScript(shell)}"`] };
        }
        case 'linux': {
            if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return null;
            const found = LINUX_TERMINALS.find(([terminal]) => hasCommand(terminal, env));
            if (!found) return null;
            const [terminal, flag] = found;
            return { bin: terminal, args: [flag, 'sh', '-c', CD_THEN_EXEC, 'sh', cwd, bin, ...args] };
        }
        default:
            return null;
    }
}

/**
 * The command the user can paste to do the same thing by hand.
 * PowerShell on Windows, POSIX sh elsewhere.
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {{ platform: string, cwd: string }} context
 * @returns {string}
 */
export function formatManualCommand(bin, args, { platform, cwd }) {
    if (platform === 'win32') {
        return `Set-Location -LiteralPath ${quotePowerShell(cwd)}; ${bin} ${args.map(quotePowerShell).join(' ')}`;
    }
    return `cd ${quotePosix(cwd)} && ${bin} ${args.map(quotePosix).join(' ')}`;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** wt.exe splits its command line on `;`, even after `--`. `\;` keeps it literal. */
function escapeForWt(str) {
    return str.replaceAll(';', '\\;');
}

function escapeForAppleScript(str) {
    return str.replace(/(["\\])/g, '\\$1');
}

function printFallback(command) {
    console.log('\n  Could not open a new terminal tab automatically.');
    console.log('  Run this command manually:\n');
    console.log(`    ${command}\n`);
}
