/**
 * Per-file timeout wrapper — races a promise against a timer.
 * On timeout, rejects into the caller's existing catch block.
 * Does NOT cancel the losing promise (accepted v1 trade-off).
 */

export function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Scan timed out after ${ms / 1000}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
