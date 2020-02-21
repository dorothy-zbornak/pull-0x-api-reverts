const BigNumber = require('bignumber.js');
const { BigQuery } = require('@google-cloud/bigquery');
const _ = require('lodash');
const abiEncoder = require('web3-eth-abi');
const fs = require('mz/fs');
const yargs = require('yargs');

const fetchRevertTraces = require('./fetch-traces');
const addresses = require('./addresses');
const artifacts = require('./artifacts');

const ARGV = yargs
    .string('since')
    .string('until')
    .number('limit')
    .argv;

const SEARCH_TARGETS = [
    {
        addresses: [addresses.exchange],
        selectors: [
            'marketSellOrdersFillOrKill',
            'marketBuyOrdersFillOrKill',
        ].map(f => getSelector(artifacts.Exchange, f)),
    },
    {
        addresses: addresses.forwarders,
        selectors: [
            'marketSellOrdersWithEth',
            'marketBuyOrdersWithEth',
        ].map(f => getSelector(artifacts.Forwarder, f))
    },
];

(async () => {
    const traces = await fetchTraces();
    console.log(JSON.stringify(extractRevertDataFromTraces(traces), null, '  '));
})();

async function fetchTraces() {
    return createTraces(await fetchRevertTraces({
        targets: SEARCH_TARGETS,
        limit: ARGV.limit,
        since: ARGV.since,
        until: ARGV.until,
    }));
}

function extractRevertDataFromTraces(traces) {
    const data = [];
    for (const [txHash, trace] of Object.entries(traces)) {
        const marketCall = findMarketCall(trace);
        if (!marketCall || !marketCall.error) {
            continue;
        }
        const affiliateBytes = marketCall.input.slice(-36 * 2)
        if (!affiliateBytes.startsWith('fbc019a7')) {
            continue;
        }
        const cause = blameRevert(marketCall);
        const fillOrderCalls = findFillOrderCalls(marketCall);
        data.push({
            height: trace.block_number,
            hash: txHash,
            name: marketCall.name,
            from: trace.from_address,
            to: trace.to_address,
            caller: marketCall.from_address,
            status: trace.receipt_status,
            affiliateId: affiliateBytes.slice((4 + 32 - 20) * 2),
            value: trace.value.toString(10),
            gasPrice: trace.gas_price,
            gas: trace.gas,
            params: marketCall.params,
            cause: {
                error: cause.error,
                callType: cause.call_type,
                caller: cause.from_address,
                callee: cause.to_address,
                input: cause.input,
                value: cause.value.toString(10),
                gas: cause.gas,
            },
            fills: fillOrderCalls.map(f => ({
                error: f.error,
                params: f.params,
                result: f.result,
                hint: (() => {
                    const makerAsset = f.params.order.makerAssetData;
                    if (makerAsset.indexOf(addresses.bridges.kyber.slice(2)) !== -1) {
                        return 'kyber';
                    }
                    if (makerAsset.indexOf(addresses.bridges.curve.slice(2)) !== -1) {
                        return 'curve';
                    }
                    if (makerAsset.indexOf(addresses.bridges.uniswap.slice(2)) !== -1) {
                        return 'uniswap';
                    }
                    if (makerAsset.indexOf(addresses.bridges.oasis.slice(2)) !== -1) {
                        return 'oasis';
                    }
                })(),
            })),
        });
    }
    return data;
}

function findMarketCall(root) {
    let params;
    let marketFn;
    return {
        ...findTraceCall(root, t => {
            const selector = t.input.slice(0, 10);
            // Find the market call.
            if (addresses.forwarders.includes(t.to_address)) {
                if (selector === getSelector(artifacts.Forwarder, 'marketSellOrdersWithEth')) {
                    marketFn = 'Forwarder.marketSellOrdersWithEth';
                    params = decodeMarketSellOrdersWithEthCallInput(t.input);
                    return true;
                }
                if (selector === getSelector(artifacts.Forwarder, 'marketBuyOrdersWithEth')) {
                    marketFn = 'Forwarder.marketBuyOrdersWithEth';
                    params = decodeMarketBuyOrdersWithEthCallInput(t.input);
                    return true;
                }
            } else if ([addresses.exchange].includes(t.to_address)) {
                if (selector === getSelector(artifacts.Exchange, 'marketSellOrdersFillOrKill')) {
                    marketFn = 'Exchange.marketSellOrdersFillOrKill';
                    params = decodeMarketSellOrdersFillOrKillCallInput(t.input);
                    return true;
                }
                if (selector === getSelector(artifacts.Exchange, 'marketBuyOrdersFillOrKill')) {
                    marketFn = 'Exchange.marketBuyOrdersFillOrKill';
                    params = decodeMarketBuyOrdersFillOrKillCallInput(t.input);
                    return true;
                }
            }
        }),
        params,
        name: marketFn,
    };
}

function blameRevert(root) {
    if (!root.error) {
        return;
    }
    // Find the deepest child that reverted.
    for (const child of root.children.slice().reverse()) {
        const cause = blameRevert(child);
        if (cause) {
            return cause;
        }
    }
    return root;
}

function findFillOrderCalls(root) {
    const calls = findTraceCalls(root, t => {
        if ([addresses.exchange].includes(t.to_address)) {
            const selector = t.input.slice(0, 10);
            return selector === getSelector(artifacts.Exchange, 'fillOrder');
        }
    });
    return calls.map(c => ({
        ...c,
        params: decodeFillOrderCallInput(c.input),
        ...(c.error
            ? {}
            : { result: decodeFillOrderCallOutput(c.output) }
        ),
    }));
}

function decodeFillOrderCallInput(input) {
    const decoded = decodeCallInput(artifacts.Exchange, 'fillOrder', input);
    return {
        order: decodedToOrder(decoded.order),
        takerAssetFillAmount: decoded.takerAssetFillAmount,
        signature: decoded.signature,
    };
}

function decodedToOrder(decoded) {
    return {
        makerAddress: decoded[0].toLowerCase(),
        takerAddress: decoded[1].toLowerCase(),
        feeRecipientAddress: decoded[2].toLowerCase(),
        senderAddress: decoded[3].toLowerCase(),
        makerAssetAmount: decoded[4],
        takerAssetAmount: decoded[5],
        makerFee: decoded[6],
        takerFee: decoded[7],
        expirationTimeInSeconds: decoded[8],
        salt: decoded[9],
        makerAssetData: decoded[10],
        takerAssetData: decoded[11],
        makerFeeAssetData: decoded[12],
        takerFeeAssetData: decoded[13],
    };
}

function decodeFillOrderCallOutput(output) {
    const decoded = decodeCallOutput(artifacts.Exchange, 'fillOrder', output);
    return {
        makerAssetFilledAmount: decoded[0][0],
        takerAssetFilledAmount: decoded[0][1],
        makerFeePaid: decoded[0][2],
        takerFeePaid: decoded[0][3],
        protocolFeePaid: decoded[0][4],
    };
}

function decodeMarketSellOrdersWithEthCallInput(input) {
    const decoded = decodeCallInput(artifacts.Forwarder, 'marketSellOrdersWithEth', input);
    return {
        orders: decoded.orders.map(o => decodedToOrder(o)),
        signatures: decoded.signatures,
        ethFeeAmounts: decoded.ethFeeAmounts,
        feeRecipients: decoded.feeRecipients.map(a => a.toLowerCase()),
    };
}

function decodeMarketBuyOrdersWithEthCallInput(input) {
    const decoded = decodeCallInput(artifacts.Forwarder, 'marketBuyOrdersWithEth', input);
    return {
        orders: decoded.orders.map(o => decodedToOrder(o)),
        makerAssetBuyAmount: decoded.makerAssetBuyAmount,
        signatures: decoded.signatures,
        ethFeeAmounts: decoded.ethFeeAmounts,
        feeRecipients: decoded.feeRecipients.map(a => a.toLowerCase()),
    };
}

function decodeMarketSellOrdersFillOrKillCallInput(input) {
    const decoded = decodeCallInput(artifacts.Exchange, 'marketSellOrdersFillOrKill', input);
    return {
        orders: decoded.orders.map(o => decodedToOrder(o)),
        takerAssetFillAmount: decoded.takerAssetFillAmount,
        signatures: decoded.signatures,
    };
}

function decodeMarketBuyOrdersFillOrKillCallInput(input) {
    const decoded = decodeCallInput(artifacts.Exchange, 'marketBuyOrdersFillOrKill', input);
    return {
        orders: decoded.orders.map(o => decodedToOrder(o)),
        makerAssetFillAmount: decoded.makerAssetFillAmount,
        signatures: decoded.signatures,
    };
}

function findTraceCall(root, predicate) {
    if (predicate(root)) {
        return root;
    }
    for (const child of root.children) {
        const t = findTraceCall(child, predicate);
        if (t) {
            return t;
        }
    }
}

function findTraceCalls(root, predicate) {
    const calls = [];
    if (predicate(root)) {
        calls.push(root);
    }
    for (const child of root.children) {
        calls.push(...findTraceCalls(child, predicate));
    }
    return calls;
}

function createTraces(rows) {
    const traces = {};
    const rootRows = rows.filter(r => !r.trace_address);
    for (const rootRow of rootRows) {
        traces[rootRow.transaction_hash] = createTraceTree(undefined, rootRow, rows);
    }
    return traces;
}

function getPath(row) {
    return row.trace_address ? row.trace_address.split(',').map(s => parseInt(s)) : [];
}

function createTraceTree(parent, rootRow, rows) {
    const rootPath = getPath(rootRow);
    const children = rows.filter(r => {
        if (r.transaction_hash !== rootRow.transaction_hash) {
            return false;
        }
        const path = getPath(r);
        if (path.length === rootPath.length + 1) {
            for (let i = 0; i < rootPath.length; ++i) {
                if (path[i] !== rootPath[i]) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }).sort((a, b) => _.last(getPath(a)) - _.last(getPath(b)));
    const node = {
        ...rootRow,
        parent,
        children: [],
    };
    node.children = children.map(r => createTraceTree(node, r, rows));
    return node;
}

function decodeCallInput(artifact, functionName, callData) {
    for (const fn of artifact) {
        if (fn.type === 'function' && fn.name === functionName) {
            const selector = abiEncoder.encodeFunctionSignature(fn);
            if (callData.startsWith(selector)) {
                return abiEncoder.decodeParameters(fn.inputs, `0x${callData.slice(10)}`);
            }
        }
    }
    throw new Error(`Could not find function named "${functionName}" that matched selector in calldata.`);
}

function decodeCallOutput(artifact, functionName, resultData) {
    for (const fn of artifact) {
        if (fn.type === 'function' && fn.name === functionName) {
            return abiEncoder.decodeParameters(fn.outputs, resultData);
        }
    }
    throw new Error(`Could not find function named "${functionName}".`);
}

function getSelector(artifact, functionName) {
    for (const fn of artifact) {
        if (fn.type === 'function' && fn.name === functionName) {
            return abiEncoder.encodeFunctionSignature(fn);
        }
    }
    throw new Error(`Could not find function named "${functionName}".`);
}
