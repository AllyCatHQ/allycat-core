/**
 * Fake Claude Code install for `allycat fix` tests.
 *
 * `fix` refuses to launch when `claude` isn't on PATH, so tests that expect a
 * launch put a fake `claude` on PATH. It is never executed: tests always run
 * `fix` with ALLYCAT_NO_LAUNCH=1.
 *
 * Shared by fix.test.js, fix-freshness.test.js and fix-claude-check.test.js.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Create a fresh folder holding a fake `claude` executable:
 * `claude.cmd` on Windows, an executable `claude` script elsewhere.
 *
 * @returns {string} The folder, ready to put on PATH
 */
export function makeFakeClaudeDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-fake-claude-'));
    if (process.platform === 'win32') {
        fs.writeFileSync(path.join(dir, 'claude.cmd'), '@echo off\r\n', 'utf8');
    } else {
        fs.writeFileSync(path.join(dir, 'claude'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    }
    return dir;
}

/**
 * Copy of `env` with every PATH key removed (Windows uses `Path`).
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function withoutPath(env) {
    const copy = { ...env };
    for (const key of Object.keys(copy)) {
        if (key.toUpperCase() === 'PATH') delete copy[key];
    }
    return copy;
}
