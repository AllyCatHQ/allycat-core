import { getSafeConcurrencyCeiling } from '../../src/utils/configLoader.js';
import os from 'os';

const totalGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
const quickCeiling = getSafeConcurrencyCeiling('quick');
const fullCeiling = getSafeConcurrencyCeiling('full');

console.log(`Machine RAM: ${totalGb} GB`);
console.log(`Quick ceiling: ${quickCeiling}`);
console.log(`Full ceiling:  ${fullCeiling}`);
console.log(`Full scanner hard cap: min(${fullCeiling}, 8) = ${Math.min(fullCeiling, 8)}`);
