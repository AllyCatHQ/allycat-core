/**
 * Command On PATH
 *
 * Tells whether an executable can be found in the PATH folders, without
 * running `where`/`which` or the command itself. Used by `allycat fix` to
 * check that Claude Code is installed before opening a terminal.
 *
 * @module utils/commandOnPath
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * True when `name` is an executable in one of the PATH folders.
 * Windows: `name` + any PATHEXT extension (a bare `name` doesn't count).
 * Elsewhere: a regular file named `name` with execute permission.
 * Missing, empty or unreadable PATH entries are skipped. Windows: quotes
 * around an entry are ignored.
 *
 * @param {string} name - Command name, e.g. 'claude'
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {boolean}
 */
export function isCommandOnPath(name, env = process.env) {
    const dirs = (env.PATH || '').split(path.delimiter).map(unquote).filter(Boolean);
    const candidates = candidateNames(name, env);
    return dirs.some(dir => candidates.some(file => isExecutableFile(path.join(dir, file))));
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * PATH entry with its quotes removed on Windows, where `"C:\Tools"` is valid
 * and `"` can't appear in a real path. Elsewhere `"` is a legal file name
 * character, so the entry is returned as written.
 *
 * @param {string} entry
 * @returns {string}
 */
function unquote(entry) {
    return process.platform === 'win32' ? entry.replaceAll('"', '') : entry;
}

/**
 * File names that count as `name` on this platform.
 *
 * @param {string} name
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]}
 */
function candidateNames(name, env) {
    if (process.platform !== 'win32') return [name];
    const exts = (env.PATHEXT || DEFAULT_PATHEXT).split(';').filter(Boolean);
    return exts.map(ext => name + ext.toLowerCase());
}

/**
 * True for a regular file this process may execute. Never throws.
 * On Windows, existing as a file is enough (no execute bit there).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isExecutableFile(filePath) {
    try {
        if (!fs.statSync(filePath).isFile()) return false;
        if (process.platform !== 'win32') fs.accessSync(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}
