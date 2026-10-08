/**
 * terminal-opener.test.js
 *
 * Tests for how `allycat fix` opens Claude Code in a terminal on Windows, macOS and Linux.
 * Written from the approved spec BEFORE the implementation (test-first).
 *
 * Spec summary:
 *   A  Claude starts in the project folder (Windows `wt -d`, macOS `cd`, Linux `sh -c 'cd …'`).
 *   B  The prompt reaches Claude as ONE argument; shell metacharacters stay literal.
 *   C  Linux: first terminal found, in order x-terminal-emulator, gnome-terminal,
 *      konsole, xfce4-terminal, xterm. None → print the command.
 *   D  No desktop (Linux without DISPLAY/WAYLAND_DISPLAY), macOS over SSH, spawn error,
 *      or launcher exiting non-zero within ~1.5s → print the command, exactly once.
 *   E  The printed command includes the cd step and is quoted for its shell
 *      (POSIX sh on macOS/Linux, PowerShell on Windows).
 *   G1 The module header no longer claims a cmd fallback or that ENOENT is swallowed.
 *
 * Every platform branch runs on every OS: platform, env, spawn and the PATH lookup
 * are injected. No real terminal is ever opened: `spawn` is always a fake, and this
 * process runs with PATH removed as a safety net.
 *
 * Real-shell round trips: PowerShell on Windows, sh elsewhere. The other shell's
 * round trip is skipped (the exact-string checks still run).
 *
 * Not automated: F1 (Windows Terminal launching an npm-installed `claude.cmd`) and
 * launching real terminals on macOS/Linux — verify manually (docs/private/fix-release-gate.md).
 *
 * Usage:
 *   node tests/e2e/terminal-opener.test.js
 */

import { spawnSync } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT        = path.join(__dirname, '../..');
const OPENER_FILE = path.join(ROOT, 'src', 'utils', 'terminalOpener.js');
const IS_WINDOWS  = process.platform === 'win32';

// Safety net: with no PATH, even a buggy opener that ignores the injected
// spawn can't find wt.exe / osascript / a Linux terminal.
const ORIGINAL_PATH = process.env.PATH;
delete process.env.PATH;
const SHELL_ENV = { ...process.env, PATH: ORIGINAL_PATH };

const quoting = await tryImport('../../src/utils/shellQuote.js');
const opener  = await tryImport('../../src/utils/terminalOpener.js');

/** The large-scan prompt `allycat fix` ships: base text plus the subagent hint. */
const PROMPT_TAIL = 'an accessibility scanner. Make targeted fixes to each violation it lists. Do not rewrite whole files. ' +
    'Violations of the same rule usually need the same fix, so work rule by rule. ' +
    'This touches 12 files. Split the work by file across subagents, never giving the same file to two agents. ' +
    'Before starting, tell the user how you split it.';
const POSIX_PROMPT = 'Read /var/folders/xy/T/allycat-last-scan.json — it lists 60 violations found by AllyCat, ' + PROMPT_TAIL;
const WIN_PROMPT = 'Read C:\\Users\\a\\AppData\\Local\\Temp\\allycat-last-scan.json — it lists 60 violations found by AllyCat, ' + PROMPT_TAIL;

/** Everything a shell might try to interpret. */
const NASTY = `x; rm -rf ~ $(whoami) \`id\` $HOME "dq" it's \\ & | > < * ? ! # ‘smart’ — end`;

const LINUX_TERMINALS = [
    ['x-terminal-emulator', '-e'],
    ['gnome-terminal',      '--'],
    ['konsole',             '-e'],
    ['xfce4-terminal',      '-x'],
    ['xterm',               '-e'],
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function tryImport(relPath) {
    try {
        return await import(relPath);
    } catch {
        return {};
    }
}

/** Call an export that may not exist yet. Returns { value } or { error }. */
function call(mod, name, ...args) {
    if (typeof mod[name] !== 'function') return { error: `${name} is not implemented` };
    try {
        return { value: mod[name](...args) };
    } catch (err) {
        return { error: `${name} threw: ${err.message}` };
    }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const show  = (v) => JSON.stringify(v);
const has   = (...names) => (name) => names.includes(name);

/**
 * Split a POSIX sh command into words. Supports bare words, '…' quoting,
 * backslash escapes and `&&`. Throws on any other unquoted metacharacter,
 * so an unquoted `;`, `$`, backtick, etc. fails the test (spec B2).
 */
function parsePosix(s) {
    const tokens = [];
    let cur = null;
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === ' ') {
            if (cur !== null) { tokens.push(cur); cur = null; }
            i++;
        } else if (c === "'") {
            const end = s.indexOf("'", i + 1);
            if (end < 0) throw new Error(`unterminated quote at ${i}`);
            cur = (cur ?? '') + s.slice(i + 1, end);
            i = end + 1;
        } else if (c === '\\') {
            cur = (cur ?? '') + s[i + 1];
            i += 2;
        } else if (c === '&' && s[i + 1] === '&' && cur === null) {
            tokens.push('&&');
            i += 2;
        } else if (/[A-Za-z0-9_\-./=:,@%+]/.test(c)) {
            cur = (cur ?? '') + c;
            i++;
        } else {
            throw new Error(`unquoted shell metacharacter ${show(c)} at ${i}`);
        }
    }
    if (cur !== null) tokens.push(cur);
    return tokens;
}

/** The shell command inside `tell application "Terminal" to do script "<S>"`, un-escaped. */
function shellFromAppleScript(script) {
    const m = /^tell application "Terminal" to do script "((?:[^"\\]|\\.)*)"$/.exec(script);
    if (!m) throw new Error(`not a Terminal do-script AppleScript: ${script}`);
    return m[1].replace(/\\(.)/g, '$1');
}

/** Run a PowerShell script (Windows only). Returns the last stdout line, parsed as JSON. */
function runPowerShell(script) {
    const full = `[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ErrorActionPreference = 'Stop'; ${script}`;
    const encoded = Buffer.from(full, 'utf16le').toString('base64');
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
        { encoding: 'utf8', env: SHELL_ENV });
    const lines = (r.stdout || '').trim().split(/\r?\n/);
    try {
        return JSON.parse(lines[lines.length - 1]);
    } catch {
        return { psError: (r.stderr || r.stdout || '').trim() };
    }
}

/** Run a sh script (non-Windows only). Returns the NUL-separated words it printed. */
function runSh(script, args = []) {
    const r = spawnSync('sh', ['-c', script, 'sh', ...args], { encoding: 'utf8', env: SHELL_ENV });
    if (r.status !== 0) return { shError: (r.stderr || '').trim() };
    return r.stdout.split('\0').slice(0, -1);
}

/** A folder whose name is hard to quote. Windows forbids " < > | ? * : in names. */
function makeNastyDir() {
    const name = IS_WINDOWS ? "allycat it's $x ;a ‘b’ `c [1] &" : "allycat it's $x ;a \"b\" `c [1] &";
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-term-')), name);
    fs.mkdirSync(dir);
    return dir;
}

/**
 * A fake child_process.spawn. `scenario(child)` schedules what the launcher does.
 * Never starts a process.
 */
function makeSpawn(scenario = () => {}) {
    const calls = [];
    const spawn = (bin, args, opts) => {
        const child = new EventEmitter();
        child.unrefCalls = 0;
        child.unref = () => { child.unrefCalls++; };
        child.ref = () => {};
        child.emitSafely = (event, ...rest) => {
            try {
                child.emit(event, ...rest);
            } catch (err) {
                child.unhandled = err;   // 'error' with no listener would crash the CLI
            }
        };
        calls.push({ bin, args, opts, child });
        scenario(child);
        return child;
    };
    return { spawn, calls };
}

const NOT_IMPLEMENTED = { notImplemented: true };

/**
 * Run openInTerminal with injected dependencies, capturing what it prints.
 * Only runs once the new API exists: the old openInTerminal ignores the
 * injected spawn and would try to open a real terminal.
 */
async function runOpen(options, { bin = 'claude', args = [WIN_PROMPT] } = {}) {
    if (typeof opener.buildLaunch !== 'function' || typeof opener.openInTerminal !== 'function') {
        return NOT_IMPLEMENTED;
    }
    const logs = [];
    const realLog = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    let result;
    const start = Date.now();
    try {
        result = await Promise.race([
            Promise.resolve(opener.openInTerminal(bin, args, options)),
            delay(4000).then(() => 'timeout'),
        ]);
    } catch (err) {
        result = `threw: ${err.message}`;
    } finally {
        console.log = realLog;
    }
    return { result, output: logs.join('\n'), elapsed: Date.now() - start };
}

const fallbackCount = (output) => (output.match(/Could not open a new terminal/g) || []).length;

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(label, ok, detail = '') {
    console.log(`  ${ok ? '✓' : '✗'}  ${label}`);
    if (!ok && detail) console.log(`       ${detail}`);
    ok ? passed++ : failed++;
}

function assertEqual(label, actual, expected) {
    assert(label, show(actual) === show(expected), `expected ${show(expected)}\n       got      ${show(actual)}`);
}

/** Assert on a { value } | { error } result from call(). */
function assertValue(label, res, expected) {
    if (res.error) return assert(label, false, res.error);
    assertEqual(label, res.value, expected);
}

function skip(label, reason) {
    console.log(`  -  ${label} (skipped: ${reason})`);
    skipped++;
}

function assertRan(label, run) {
    if (run === NOT_IMPLEMENTED) {
        assert(label, false, 'openInTerminal with injected spawn is not implemented');
        return false;
    }
    return true;
}

// =============================================================================
// B: shell quoting helpers (src/utils/shellQuote.js)
// =============================================================================

console.log('\n-- B: quotePosix exact output -------------------------------------');
{
    const cases = [
        ['plain word',      'abc',                        "'abc'"],
        ['spaces',          'a b',                        "'a b'"],
        ['empty string',    '',                           "''"],
        ['single quote',    "it's",                       "'it'\\''s'"],
        ['metacharacters',  '$HOME `id` "q" \\ ; & | —',  "'$HOME `id` \"q\" \\ ; & | —'"],
    ];
    for (const [name, input, expected] of cases) {
        assertValue(`quotePosix: ${name}`, call(quoting, 'quotePosix', input), expected);
    }
}

console.log('\n-- B: quotePowerShell exact output --------------------------------');
{
    const cases = [
        ['plain word',      'abc',                       "'abc'"],
        ['spaces',          'a b',                       "'a b'"],
        ['empty string',    '',                          "''"],
        ['single quote',    "it's",                      "'it''s'"],
        ['smart quotes',    'a‘b’c‚d‛e',                 "'a‘‘b’’c‚‚d‛‛e'"],
        ['metacharacters',  '$x `y` "z" \\ ; & | —',     "'$x `y` \"z\" \\ ; & | —'"],
    ];
    for (const [name, input, expected] of cases) {
        assertValue(`quotePowerShell: ${name}`, call(quoting, 'quotePowerShell', input), expected);
    }
}

console.log('\n-- B: quoting round-trips through a real shell -------------------');
{
    const values = ['plain', 'a b', '', "it's", NASTY, WIN_PROMPT];
    if (IS_WINDOWS) {
        const quoted = values.map((v) => call(quoting, 'quotePowerShell', v));
        if (quoted.some((q) => q.error)) {
            assert('PowerShell: every value comes back unchanged', false, 'quotePowerShell is not implemented');
        } else {
            const out = runPowerShell(
                `function show { ConvertTo-Json -InputObject @($args) -Compress }; show ${quoted.map((q) => q.value).join(' ')}`);
            assertEqual('PowerShell: every value comes back unchanged', out, values);
        }
        skip('sh round trip', 'Windows');
    } else {
        const quoted = values.map((v) => call(quoting, 'quotePosix', v));
        if (quoted.some((q) => q.error)) {
            assert('sh: every value comes back unchanged', false, 'quotePosix is not implemented');
        } else {
            assertEqual('sh: every value comes back unchanged',
                runSh(`printf '%s\\0' ${quoted.map((q) => q.value).join(' ')}`), values);
        }
        skip('PowerShell round trip', 'not Windows');
    }
}

// =============================================================================
// A1, B3: Windows (wt.exe)
// =============================================================================

console.log('\n-- A1/B3 (win32): new tab in the project folder, prompt intact ---');
{
    const cwd = 'C:\\Users\\a\\my project';
    const res = call(opener, 'buildLaunch', 'claude', [WIN_PROMPT], { platform: 'win32', cwd, env: {}, hasCommand: () => true });
    assertValue('wt.exe new-tab -d <cwd> -- claude <prompt>', res,
        { bin: 'wt.exe', args: ['new-tab', '-d', cwd, '--', 'claude', WIN_PROMPT] });
    if (res.value) {
        const a = res.value.args;
        assert('-d comes before --', a.indexOf('-d') > -1 && a.indexOf('-d') < a.indexOf('--'));
        assert('prompt is a single argument', a.filter((x) => x === WIN_PROMPT).length === 1);
    }
}

console.log('\n-- B3 (win32): ";" is escaped so wt does not split the command ---');
{
    const cwd = 'C:\\proj;a';
    const res = call(opener, 'buildLaunch', 'claude', ['fix a; then b'], { platform: 'win32', cwd, env: {}, hasCommand: () => true });
    assertValue('";" in cwd and prompt becomes "\\;"', res,
        { bin: 'wt.exe', args: ['new-tab', '-d', 'C:\\proj\\;a', '--', 'claude', 'fix a\\; then b'] });
}

// =============================================================================
// A2, B1, B2, D2: macOS (osascript + Terminal.app)
// =============================================================================

console.log('\n-- A2/B1 (darwin): cd to the project, prompt is one argument -----');
{
    const cwd = '/Users/a/my app';
    const res = call(opener, 'buildLaunch', 'claude', [POSIX_PROMPT], { platform: 'darwin', cwd, env: {}, hasCommand: () => true });
    if (res.error) {
        assert('builds an osascript command', false, res.error);
    } else {
        const { bin, args } = res.value ?? {};
        assertEqual('runs osascript -e <script>', [bin, args?.[0], args?.length], ['osascript', '-e', 2]);
        let shell;
        try { shell = shellFromAppleScript(args[1]); } catch (err) { assert('script is a Terminal "do script"', false, err.message); }
        if (shell !== undefined) {
            assert('shell command starts with cd to the project', shell.startsWith("cd '/Users/a/my app' &&"), `got: ${shell}`);
            let words;
            try { words = parsePosix(shell); } catch (err) { assert('shell command is fully quoted', false, `${err.message} in: ${shell}`); }
            if (words) assertEqual('shell sees [cd, cwd, &&, claude, prompt]', words, ['cd', cwd, '&&', 'claude', POSIX_PROMPT]);
        }
    }
}

console.log('\n-- B2 (darwin): injection attempts stay literal ------------------');
{
    const cwd = "/tmp/it's $HOME; rm -rf ~";
    const res = call(opener, 'buildLaunch', 'claude', [NASTY], { platform: 'darwin', cwd, env: {}, hasCommand: () => true });
    if (res.error) {
        assert('nasty cwd and prompt arrive unchanged', false, res.error);
    } else {
        let words;
        try { words = parsePosix(shellFromAppleScript(res.value.args[1])); }
        catch (err) { assert('nasty cwd and prompt arrive unchanged', false, err.message); }
        if (words) assertEqual('nasty cwd and prompt arrive unchanged', words, ['cd', cwd, '&&', 'claude', NASTY]);
    }
}

console.log('\n-- D2 (darwin): over SSH → no launch command ----------------------');
for (const key of ['SSH_CONNECTION', 'SSH_TTY']) {
    assertValue(`${key} set → null`,
        call(opener, 'buildLaunch', 'claude', [POSIX_PROMPT], { platform: 'darwin', cwd: '/p', env: { [key]: 'x' }, hasCommand: () => true }),
        null);
}

// =============================================================================
// A3, B4, C1, C2, D1: Linux
// =============================================================================

const LINUX_ENV = { DISPLAY: ':0' };
const LINUX_CWD = '/home/a/my app';

function linuxLaunch(hasCommand, env = LINUX_ENV, args = [POSIX_PROMPT]) {
    return call(opener, 'buildLaunch', 'claude', args, { platform: 'linux', cwd: LINUX_CWD, env, hasCommand });
}

console.log('\n-- C1/B4 (linux): each terminal gets its own flag ----------------');
for (const [terminal, flag] of LINUX_TERMINALS) {
    const res = linuxLaunch(has(terminal));
    if (res.error) { assert(`${terminal}: uses ${flag}`, false, res.error); continue; }
    const { bin, args = [] } = res.value ?? {};
    assertEqual(`${terminal}: runs ${terminal} ${flag} sh -c …`, [bin, args[0], args[1], args[2]], [terminal, flag, 'sh', '-c']);
    assertEqual(`${terminal}: cwd and prompt passed as separate argv items`, args.slice(-4), ['sh', LINUX_CWD, 'claude', POSIX_PROMPT]);
    if (terminal === 'gnome-terminal') assert('gnome-terminal: never uses -e', !args.includes('-e'), show(args));
}

console.log('\n-- C1 (linux): priority order ------------------------------------');
{
    const cases = [
        [LINUX_TERMINALS.map(([t]) => t),            'x-terminal-emulator'],
        [['xterm', 'gnome-terminal'],                'gnome-terminal'],
        [['xterm', 'xfce4-terminal', 'konsole'],     'konsole'],
        [['xterm', 'xfce4-terminal'],                'xfce4-terminal'],
    ];
    for (const [available, expected] of cases) {
        const res = linuxLaunch(has(...available));
        assertValue(`${available.join(' + ')} → ${expected}`, res.error ? res : { value: res.value?.bin }, expected);
    }
}

console.log('\n-- C2 (linux): no known terminal → no launch command -------------');
assertValue('nothing on PATH → null', linuxLaunch(() => false), null);

console.log('\n-- D1 (linux): no desktop session → no launch command ------------');
assertValue('no DISPLAY or WAYLAND_DISPLAY → null', linuxLaunch(() => true, {}), null);
{
    const res = linuxLaunch(has('xterm'), { WAYLAND_DISPLAY: 'wayland-0' });
    assertValue('WAYLAND_DISPLAY alone is a desktop session', res.error ? res : { value: res.value?.bin }, 'xterm');
}

console.log('\n-- A3/B4 (linux): the sh wrapper really cds and keeps argv -------');
if (IS_WINDOWS) {
    skip('wrapper run through real sh', 'Windows');
} else {
    const res = linuxLaunch(has('xterm'), LINUX_ENV, [NASTY]);
    if (res.error || !res.value) {
        assert('wrapper runs claude in the project with the prompt intact', false, res.error ?? 'got null');
    } else {
        const dir = makeNastyDir();
        const fake = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-fake-')), 'claude');
        fs.writeFileSync(fake, '#!/bin/sh\nprintf \'%s\\0\' "$PWD" "$@"\n', { mode: 0o755 });
        // Drop the terminal flag; swap in our cwd and the fake claude.
        const [, sh, ...rest] = res.value.args;
        const argv = rest.map((a) => (a === LINUX_CWD ? dir : a === 'claude' ? fake : a));
        const r = spawnSync(sh, argv, { encoding: 'utf8', env: SHELL_ENV });
        assertEqual('wrapper runs claude in the project with the prompt intact',
            r.stdout.split('\0').slice(0, -1), [fs.realpathSync(dir), NASTY]);
    }
}

console.log('\n-- (any): unsupported platform → no launch command --------------');
assertValue('aix → null', call(opener, 'buildLaunch', 'claude', ['x'], { platform: 'aix', cwd: '/p', env: {}, hasCommand: () => true }), null);

// =============================================================================
// E1, E2: the command printed for the user to paste
// =============================================================================

console.log('\n-- E1 (POSIX): printed command cds to the project ----------------');
for (const platform of ['darwin', 'linux']) {
    assertValue(`${platform}: cd '<cwd>' && claude '<prompt>'`,
        call(opener, 'formatManualCommand', 'claude', [POSIX_PROMPT], { platform, cwd: '/Users/a/my app' }),
        `cd '/Users/a/my app' && claude '${POSIX_PROMPT}'`);
}

console.log('\n-- E1 (win32): printed command is PowerShell with Set-Location ----');
assertValue("Set-Location -LiteralPath '<cwd>'; claude '<prompt>'",
    call(opener, 'formatManualCommand', 'claude', [WIN_PROMPT], { platform: 'win32', cwd: 'C:\\Users\\a\\my project' }),
    `Set-Location -LiteralPath 'C:\\Users\\a\\my project'; claude '${WIN_PROMPT}'`);

console.log('\n-- E2 (POSIX): nasty cwd and prompt stay literal -----------------');
{
    const cwd = "/tmp/it's $HOME; rm -rf ~";
    const res = call(opener, 'formatManualCommand', 'claude', [NASTY], { platform: 'linux', cwd });
    if (res.error) {
        assert('sh sees [cd, cwd, &&, claude, prompt]', false, res.error);
    } else {
        let words;
        try { words = parsePosix(res.value); } catch (err) { assert('sh sees [cd, cwd, &&, claude, prompt]', false, `${err.message} in: ${res.value}`); }
        if (words) assertEqual('sh sees [cd, cwd, &&, claude, prompt]', words, ['cd', cwd, '&&', 'claude', NASTY]);
    }
}

console.log('\n-- E2: pasting the printed command into a real shell works -------');
{
    const dir = makeNastyDir();
    if (IS_WINDOWS) {
        const res = call(opener, 'formatManualCommand', 'claude', [NASTY], { platform: 'win32', cwd: dir });
        if (res.error) {
            assert('PowerShell: runs claude in the project with the prompt intact', false, res.error);
        } else {
            const out = runPowerShell(
                'function claude { ConvertTo-Json -Compress -InputObject ([ordered]@{ dir =(Split-Path -Leaf (Get-Location).ProviderPath); args = @($args) }) }; ' +
                res.value);
            assertEqual('PowerShell: runs claude in the project with the prompt intact', out, { dir: path.basename(dir), args: [NASTY] });
        }
        skip('sh paste round trip', 'Windows');
    } else {
        const res = call(opener, 'formatManualCommand', 'claude', [NASTY], { platform: 'linux', cwd: dir });
        if (res.error) {
            assert('sh: runs claude in the project with the prompt intact', false, res.error);
        } else {
            const out = runSh(`claude() { printf '%s\\0' "$PWD" "$@"; }; ${res.value}`);
            assertEqual('sh: runs claude in the project with the prompt intact', out, [fs.realpathSync(dir), NASTY]);
        }
        skip('PowerShell paste round trip', 'not Windows');
    }
}

// =============================================================================
// D: openInTerminal — no launch, spawn errors, launcher exit codes
// =============================================================================

console.log('\n-- D1 (linux): no desktop → prints the command, spawns nothing ---');
{
    const fake = makeSpawn();
    const run = await runOpen({ platform: 'linux', cwd: LINUX_CWD, env: {}, spawn: fake.spawn, hasCommand: () => true, waitMs: 50 },
        { args: [POSIX_PROMPT] });
    if (assertRan('runs', run)) {
        assertEqual('nothing spawned', fake.calls.length, 0);
        assertEqual('resolves "fallback"', run.result, 'fallback');
        assertEqual('fallback printed once', fallbackCount(run.output), 1);
        assert('printed command cds to the project', run.output.includes(`cd '${LINUX_CWD}' && claude '`), run.output);
    }
}

console.log('\n-- D2 (darwin): over SSH → prints the command, spawns nothing ----');
{
    const fake = makeSpawn();
    const run = await runOpen({ platform: 'darwin', cwd: '/p', env: { SSH_TTY: '/dev/ttys001' }, spawn: fake.spawn, hasCommand: () => true, waitMs: 50 },
        { args: [POSIX_PROMPT] });
    if (assertRan('runs', run)) {
        assertEqual('nothing spawned', fake.calls.length, 0);
        assertEqual('resolves "fallback"', run.result, 'fallback');
        assertEqual('fallback printed once', fallbackCount(run.output), 1);
    }
}

console.log('\n-- C2 (linux): no terminal on PATH → prints the command ----------');
{
    const fake = makeSpawn();
    const run = await runOpen({ platform: 'linux', cwd: LINUX_CWD, env: LINUX_ENV, spawn: fake.spawn, hasCommand: () => false, waitMs: 50 },
        { args: [POSIX_PROMPT] });
    if (assertRan('runs', run)) {
        assertEqual('nothing spawned', fake.calls.length, 0);
        assertEqual('fallback printed once', fallbackCount(run.output), 1);
    }
}

const WIN_OPTS = { platform: 'win32', cwd: 'C:\\proj', env: {}, hasCommand: () => true, waitMs: 50 };

console.log('\n-- A3/D (win32): spawn options ------------------------------------');
{
    const fake = makeSpawn((child) => setTimeout(() => child.emitSafely('exit', 0, null), 5));
    const run = await runOpen({ ...WIN_OPTS, spawn: fake.spawn });
    if (assertRan('runs', run)) {
        const opts = fake.calls[0]?.opts ?? {};
        assertEqual('spawned wt.exe once', fake.calls.map((c) => c.bin), ['wt.exe']);
        assertEqual('detached, stdio ignored, cwd = project', [opts.detached, opts.stdio, opts.cwd], [true, 'ignore', 'C:\\proj']);
    }
}

console.log('\n-- A3 (linux): spawn cwd is the project folder -------------------');
{
    const fake = makeSpawn((child) => setTimeout(() => child.emitSafely('exit', 0, null), 5));
    const run = await runOpen({ platform: 'linux', cwd: LINUX_CWD, env: LINUX_ENV, spawn: fake.spawn, hasCommand: has('xterm'), waitMs: 50 },
        { args: [POSIX_PROMPT] });
    if (assertRan('runs', run)) assertEqual('spawn cwd = project', fake.calls[0]?.opts?.cwd, LINUX_CWD);
}

console.log('\n-- D4: launcher missing (spawn error) → fallback once ------------');
{
    const fake = makeSpawn((child) => setTimeout(() => {
        child.emitSafely('error', Object.assign(new Error('spawn wt.exe ENOENT'), { code: 'ENOENT' }));
        child.emitSafely('exit', -4058, null);   // Node may also report an exit
    }, 5));
    const run = await runOpen({ ...WIN_OPTS, spawn: fake.spawn });
    if (assertRan('runs', run)) {
        assert('error event is handled (no crash)', !fake.calls[0]?.child.unhandled, String(fake.calls[0]?.child.unhandled));
        assertEqual('resolves "fallback"', run.result, 'fallback');
        assertEqual('fallback printed exactly once', fallbackCount(run.output), 1);
        assert('printed command is PowerShell', run.output.includes("Set-Location -LiteralPath 'C:\\proj'; claude '"), run.output);
    }
}

console.log('\n-- D4: spawn throws synchronously → fallback once ----------------');
{
    const spawn = () => { throw new Error('EACCES'); };
    const run = await runOpen({ ...WIN_OPTS, spawn });
    if (assertRan('runs', run)) {
        assertEqual('resolves "fallback"', run.result, 'fallback');
        assertEqual('fallback printed exactly once', fallbackCount(run.output), 1);
    }
}

console.log('\n-- D3: launcher exits non-zero (e.g. permission denied) ----------');
{
    const fake = makeSpawn((child) => setTimeout(() => child.emitSafely('exit', 1, null), 10));
    const run = await runOpen({ ...WIN_OPTS, spawn: fake.spawn });
    if (assertRan('runs', run)) {
        assertEqual('resolves "fallback"', run.result, 'fallback');
        assertEqual('fallback printed exactly once', fallbackCount(run.output), 1);
    }
}

console.log('\n-- D3: launcher exits 0 → launched, nothing printed --------------');
{
    const fake = makeSpawn((child) => setTimeout(() => child.emitSafely('exit', 0, null), 10));
    const run = await runOpen({ ...WIN_OPTS, spawn: fake.spawn });
    if (assertRan('runs', run)) {
        assertEqual('resolves "launched"', run.result, 'launched');
        assertEqual('no fallback printed', fallbackCount(run.output), 0);
    }
}

console.log('\n-- D3: launcher still running after waitMs → unref, launched -----');
{
    let unrefBeforeWait;
    const fake = makeSpawn((child) => setTimeout(() => { unrefBeforeWait = child.unrefCalls; }, 10));
    const run = await runOpen({ ...WIN_OPTS, spawn: fake.spawn });
    if (assertRan('runs', run)) {
        const child = fake.calls[0]?.child;
        assertEqual('not unref\'d before waitMs (so the exit code can be seen)', unrefBeforeWait, 0);
        assert('unref\'d once waitMs passed', (child?.unrefCalls ?? 0) >= 1, `unref calls: ${child?.unrefCalls}`);
        assertEqual('resolves "launched"', run.result, 'launched');
        assertEqual('no fallback printed', fallbackCount(run.output), 0);
    }
}

console.log('\n-- D3: exit after waitMs is ignored ------------------------------');
{
    const fake = makeSpawn((child) => setTimeout(() => child.emitSafely('exit', 1, null), 120));
    const run = await runOpen({ ...WIN_OPTS, waitMs: 30, spawn: fake.spawn });
    if (assertRan('runs', run)) {
        await delay(150);
        assertEqual('resolves "launched"', run.result, 'launched');
        assertEqual('no fallback printed, even after the late exit', fallbackCount(run.output), 0);
    }
}

console.log('\n-- D3: error then non-zero exit → fallback printed once ----------');
{
    const fake = makeSpawn((child) => setTimeout(() => {
        child.emitSafely('error', new Error('boom'));
        child.emitSafely('exit', 1, null);
    }, 10));
    const run = await runOpen({ ...WIN_OPTS, spawn: fake.spawn });
    if (assertRan('runs', run)) assertEqual('fallback printed exactly once', fallbackCount(run.output), 1);
}

console.log('\n-- D3: default wait is about 1.5s --------------------------------');
{
    const fake = makeSpawn();
    const { waitMs, ...opts } = WIN_OPTS;
    const run = await runOpen({ ...opts, spawn: fake.spawn });
    if (assertRan('runs', run)) {
        assertEqual('resolves "launched"', run.result, 'launched');
        assert('waited between 1.2s and 2.5s', run.elapsed >= 1200 && run.elapsed <= 2500, `waited ${run.elapsed}ms`);
    }
}

// =============================================================================
// G1: header comment matches the code
// =============================================================================

console.log('\n-- G1: header comment no longer promises what the code lacks -----');
{
    const source = fs.readFileSync(OPENER_FILE, 'utf8');
    assert('no "cmd fallback" claim', !/cmd fallback/i.test(source));
    assert('no "swallows ENOENT" claim', !/swallows ENOENT/i.test(source));
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
process.exit(failed > 0 ? 1 : 0);
