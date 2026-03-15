# Technical Session Summary — BOM-Aware File Reading
**Date:** 04.03.2026 | **Project:** AllyCat Core | **Session type:** Defensive fix (ISSUE-001 / ENHANCE-001)

---

## 1. Executive Summary

Both scanners previously called `fs.readFile(filePath, 'utf8')` with a hardcoded encoding.
If a file was encoded as UTF-16 LE or UTF-16 BE (with a BOM), Node.js would misread the
2-byte characters as garbled UTF-8 — the HTML or source content passed to JSDOM/Playwright
was corrupt before scanning began. The failure was completely silent: no error, no warning,
just wrong violations and broken line numbers.

This session introduced a shared `readSourceFile()` utility that detects BOMs on the raw
byte level and decodes accordingly, with a UTF-8 fallback for all normal files.

---

## 2. Problem

### Why UTF-16 matters for HTML files

JSX, Vue, and Angular files are almost always written in VS Code or similar modern editors
that default to UTF-8. HTML files are different — they frequently originate from:

- Windows Notepad ("Unicode" mode = UTF-16 LE with BOM)
- Legacy CMS exports (SharePoint, Drupal, older Dreamweaver)
- Corporate and government tooling (relevant to IS 5568 target audience)

### Failure mode

When `fs.readFile(filePath, 'utf8')` reads a UTF-16 LE file, each 2-byte character pair is
decoded as two separate UTF-8 bytes. The resulting string is garbage. JSDOM attempts to parse
it and produces a broken DOM. axe-core runs on that DOM and produces incorrect results:

| Symptom | Cause |
|---|---|
| `html-has-lang` fires despite `lang` being set | `lang` attribute was garbled |
| `image-alt` not detected | `<img>` tag could not be parsed |
| Line numbers resolve to `null` | Source mapper cannot match broken content |
| No error shown | `fs.readFile` succeeded — the bug was semantic, not thrown |

### Affected call sites (before fix)

| File | Line | Call |
|---|---|---|
| `src/engine/scanners/quickScanner.js` | 152 | `fs.readFile(filePath, 'utf8')` — main source read |
| `src/engine/scanners/fullScanner.js` | 255 | `fs.readFile(filePath, 'utf8')` — main source read |
| `src/engine/scanners/fullScanner.js` | 279 | `fs.readFile(companionTs, 'utf8')` — Angular `.ts` companion |

---

## 3. Solution

### New utility: `src/utils/fileUtils.js`

```js
export async function readSourceFile(filePath) {
    const buf = await fs.readFile(filePath);           // raw bytes, no encoding

    if (buf[0] === 0xFF && buf[1] === 0xFE)            // UTF-16 LE BOM
        return buf.toString('utf16le');

    if (buf[0] === 0xFE && buf[1] === 0xFF)            // UTF-16 BE BOM
        return buf.swap16().toString('utf16le');

    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF)  // UTF-8 BOM
        return buf.slice(3).toString('utf8');

    return buf.toString('utf8');                        // standard case
}
```

**Key design decisions:**

- **Read raw bytes first** — no encoding parameter means Node returns a `Buffer`, not a string.
  The first 2–3 bytes are inspected before any decoding happens.
- **BOM-only detection** — UTF-16 without a BOM is theoretically possible but undetectable
  (bytes are ambiguous). BOM-present UTF-16 covers 100% of realistic cases (Notepad, CMS exports).
- **UTF-8 BOM strip** — Node's `'utf8'` decoder would leave the BOM as `\uFEFF` at the start
  of the string. JSDOM may fail to recognize `<!DOCTYPE html>` if a stray character precedes it.
  We strip the 3 BOM bytes before decoding.
- **Zero regression risk** — files with no BOM fall through to the UTF-8 path, identical to
  the previous hardcoded behavior.

### Scanner changes

Both scanners now import `readSourceFile` and drop the `fs/promises` import entirely (it is
no longer used after the replacement):

- `src/engine/scanners/quickScanner.js` — 1 call replaced, `fs` import removed
- `src/engine/scanners/fullScanner.js` — 2 calls replaced, `fs` import removed

---

## 4. Scope

| File | Change |
|---|---|
| `src/utils/fileUtils.js` | **New** — `readSourceFile()` utility |
| `src/engine/scanners/quickScanner.js` | Import changed, 1 `readFile` replaced |
| `src/engine/scanners/fullScanner.js` | Import changed, 2 `readFile` calls replaced |

No other files touched. No CLI flags, no config changes, no output changes.

---

## 5. Testing

Three fixtures created and scanned in sequence:

| Fixture | Encoding | BOM bytes |
|---|---|---|
| `test-utf8.html` | UTF-8 (standard) | none |
| `test-utf8bom.html` | UTF-8 with BOM | `EF BB BF` |
| `test-utf16le.html` | UTF-16 LE with BOM | `FF FE` |

All three produced identical output: 2 violations (`image-alt`, `region`), same line numbers.
Fixtures were removed after verification.

---

## 6. Why Node.js does not auto-detect encoding

Node.js treats files as raw bytes at the systems level. Auto-detection would require statistical
analysis of byte patterns (as libraries like `chardet` do), which is probabilistic — not
acceptable for a tool reporting violations at specific line numbers. Node's explicit-encoding
design ensures predictable, deterministic behavior. `readSourceFile()` implements the minimal
deterministic detection needed for real-world inputs.

---