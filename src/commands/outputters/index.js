/**
 * Scan Outputters — index
 *
 * Routes completed scan results to the appropriate output handler
 * based on CLI flags. This is the only public export from this module.
 *
 * Output modes:
 *   --json-file <name>  → write JSON report to file
 *   --output json       → print JSON to stdout
 *   --summary           → print counts only
 *   --fail-on-new       → terminal with NEW / BASELINE labels
 *   (default)           → full terminal output
 *
 * AI report is appended in terminal mode when ai.enabled is true.
 *
 * @module commands/outputters
 */

import { outputTerminal, outputTerminalWithBaseline } from './terminalOutputter.js';
import { outputSummaryOnly } from './summaryOutputter.js';
import { outputJson, outputJsonFile } from './jsonOutputter.js';
import { outputAiReport } from './reportOutputter.js';

/**
 * Route results to the appropriate output handler.
 *
 * @param {Array}       violations     - Scan violations
 * @param {Object}      config         - User configuration
 * @param {string}      scanMode       - Current scan mode
 * @param {Object}      options        - CLI options
 * @param {Array}       warnings       - Scan warnings
 * @param {Object|null} baselineResult - Classified violations from baselineManager, or null
 */
export function outputResults(violations, config, scanMode, options, warnings = [], baselineResult = null) {
    if (options.jsonFile) {
        outputJsonFile(violations, config, scanMode, options.jsonFile, warnings);
    } else if (options.output === 'json') {
        outputJson(violations, config, scanMode, warnings);
    } else if (options.summary) {
        outputSummaryOnly(violations, scanMode, warnings, options.summaryStyle);
    } else if (baselineResult) {
        outputTerminalWithBaseline(baselineResult, scanMode, options);
    } else {
        outputTerminal(violations, scanMode, options);
    }
    // AI report: terminal mode only — not in json, json-file, or summary modes
    if (!options.jsonFile && options.output !== 'json' && !options.summary) {
        if (config?.ai?.enabled && violations.length > 0) {
            outputAiReport(violations, config, scanMode);
        }
    }
}
