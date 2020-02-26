const FlexContract = require('flex-contract');
const BigNumber = require('bignumber.js');
const yargs = require('yargs');
const process = require('process');
const readline = require('readline');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const BUILD_ROOT = path.resolve(__dirname, '../build');
const ABIS = {
    TestBridgeTransferFrom: JSON.parse(fs.readFileSync(`${BUILD_ROOT}/TestBridgeTransferFrom.abi`)),
    TestERC20: JSON.parse(fs.readFileSync(`${BUILD_ROOT}/TestERC20.abi`)),
};

const BYTECODES = {
    TestBridgeTransferFrom: '0x' + fs.readFileSync(`${BUILD_ROOT}/TestBridgeTransferFrom.bin-runtime`),
    TestERC20: '0x' + fs.readFileSync(`${BUILD_ROOT}/TestERC20.bin-runtime`),
};

const GETH_WS = 'ws://localhost:8546';
const testContract = new FlexContract(
    ABIS.TestBridgeTransferFrom,
    { providerURI: GETH_WS },
);
const eth = testContract.eth;

(async () => {
    const fills = [];
    const rl = readline.createInterface({
        input: process.stdin,
    });
    rl.on('line', line => fills.push(JSON.parse(line)));
    rl.on('close', async () => {
        try {
            await runTests(fills);
            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    });
})();

function toHex(v) {
    return `0x${new BigNumber(v).integerValue().toString(16)}`;
}

async function runTests(fills) {
    const testContractAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
    const originalTakerTokenAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
    for (const fill of fills) {
        const takerToken = `0x${Buffer.from(fill.order.takerAssetData.slice(2), 'hex').slice(16).toString('hex')}`;
        const bridge = `0x${Buffer.from(fill.order.makerAssetData.slice(2), 'hex').slice(16, 16 + 20).toString('hex')}`;
        const makerToken = `0x${Buffer.from(fill.order.makerAssetData.slice(2), 'hex').slice(48, 48 + 20).toString('hex')}`;
        let originalTakerTokenBytecode;
        try {
            originalTakerTokenBytecode = await eth.rpc.getCode(takerToken);
        } catch (err) {
            console.error(err);
            continue;
        }
        try {
            const result = await eth.rpc._send(
                'eth_call',
                [
                    {
                        to: testContractAddress,
                        gas: toHex(fill.gas),
                        gasPrice: toHex(fill.gas_price),
                        value: '0x0',
                        data: await testContract.fill({
                            bridge,
                            makerToken,
                            takerToken,
                            makerAmount: fill.order.makerAssetAmount,
                            takerAmount: fill.order.takerAssetAmount,
                            originalTakerToken: originalTakerTokenAddress,
                        }).encode(),
                    },
                    toHex(fill.block_number),
                    {
                        [testContractAddress]: { code: BYTECODES.TestBridgeTransferFrom },
                        [originalTakerTokenAddress]: { code: originalTakerTokenBytecode },
                        [takerToken]: { code: BYTECODES.TestERC20 },
                    },
                ],
            );
        } catch (err) {
            console.error(err);
            continue;
        }
        console.log(result);
    }
}
