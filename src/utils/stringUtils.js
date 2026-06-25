/**
 * General-purpose string utilities.
 * No domain knowledge — safe to import from any module.
 *
 * @module utils/stringUtils
 */

/**
 * Compute the Levenshtein edit distance between two strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

/**
 * Return the closest key from a Set of known keys, or null if no key is
 * within the typo-correction threshold (max(1, 40% of unknown length)).
 *
 * @param {string} unknown
 * @param {Set<string>} knownKeys
 * @returns {string|null}
 */
export function closestKey(unknown, knownKeys) {
    let best = null, bestDist = Infinity;
    for (const key of knownKeys) {
        const d = editDistance(unknown, key);
        if (d < bestDist) { bestDist = d; best = key; }
    }
    const threshold = Math.max(1, Math.floor(unknown.length * 0.4));
    return bestDist <= threshold ? best : null;
}
