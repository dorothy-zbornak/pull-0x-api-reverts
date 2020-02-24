const FlexContract = require('flex-contract');
const BigNumber = require('bignumber.js');
const yargs = require('yargs');
const process = require('process');
const readline = require('readline');

const GETH_WS = 'ws://localhost:8546';

(async () => {
    const fills = [];
    const rl = readline.createInterface({
        input: process.stdin,
    });
    rl.on('line', line => fills.push(JSON.parse(line)));
    rl.on('close', () => {
        runTests(fills);
    });
})();

async function runTests(fills) {
    for (const fill of fills) {
        
    }
}
