from collections import namedtuple
from matplotlib import pyplot as plt

FORWARDERS = [
    '0x4aa817c6f383c8e8ae77301d18ce48efb16fd2be',
    '0x4ef40d1bf0983899892946830abf99eca2dbc5ce',
    '0xcd53c634e93fa1214d028acaaf6a12912ba26a2f',
]
EXCHANGE = '0x61935cbdd02287b511119ddb11aeb42f1593b7ef'
STAKING_PROXY = '0xa26e80e7dea86279c6d778d702cc413e6cffa777'
ERC20_PROXY = '0x95e6f48254609a6ee006f7d493c8e5fb97094cef'
BRIDGE_PROXY = '0x8ed95d1746bf1e4dab58d8ed4724f1ef95b20db0'
EXTERNAL_DEXES = [
    # Kyber
    '0x9ae49c0d7f8f9ef4b864e004fe86ac8294e20950',
    # Oasis
    '0x794e6e91555438afc3ccf1c5076a74f42133d08d',
    # Uniswap DAI
    '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667'
    # Uniswap USDC
    '0x97dec872013f6b5fb443861090ad931542878126'
]
EXCHANGE_FILL_ORDER_SELECTOR = '0x9b44d556'
ERC20_TRANSFER_FROM_SELECTOR = '0x23b872dd'
IS_VALID_SIGNATURE_SELECTORS = ['0x1626ba7e']
EXPECTED_GAS = int(5e9)

def _classify_fill_error(tx, fill):
    if int(tx['gasPrice']) < EXPECTED_GAS:
        return 'gas_price'
    if fill['error'] == 'Out of gas':
        return 'oog'
    if not fill['cause']:
        return 'unknown'
    cause = fill['cause']
    if cause['error'] == 'Out of gas':
        return 'oog'
    if cause['callee'] == EXCHANGE and \
        cause['input'].startswith(EXCHANGE_FILL_ORDER_SELECTOR):
        return 'unfillable'
    if cause['caller'] == EXCHANGE and cause['callType'] == 'staticcall' \
        and cause['input'][:10] in IS_VALID_SIGNATURE_SELECTORS:
        return 'unfillable'
    if cause['callee'] == tx['callee']:
        return 'incomplete'
    if cause['callee'] == BRIDGE_PROXY:
        return 'underpay'
    order = fill['params']['order']
    if cause['input'][:10] == ERC20_TRANSFER_FROM_SELECTOR:
        if cause['caller'] == STAKING_PROXY:
            return 'fee'
        if cause['caller'] == ERC20_PROXY:
            from_address = '0x' + cause['input'][2 + 16 * 2 : 2 + 36 * 2]
            if from_address == order['makerAddress']:
                return 'maker_funds'
            return 'taker_funds'
    return 'unknown'

class Fill:
    order = None
    tx = None
    block_number = None
    timestamp = None
    affiliate = None
    gas_price = None
    gas = None
    from_address = None
    to_address = None
    caller = None
    callee = None
    fn = None
    kind = None
    value = None
    error = None
    interfered = None

def classify_fills(txs):
    fills = []
    for tx in txs:
        for fill in filter(lambda f: f['error'], tx['fills']):
            f = Fill()
            f.order = fill['params']['order']
            f.signature = fill['params']['signature']
            f.taker_amount = fill['params']['takerAssetFillAmount']
            f.tx = tx['hash']
            f.block_number = tx['height']
            f.timestamp = tx['timestamp']
            f.affiliate = tx['affiliateId']
            f.gas_price = tx['gasPrice']
            f.gas = tx['gas']
            f.from_address = tx['from']
            f.to_address = tx['to']
            f.kind = fill.get('hint') or 'native'
            f.value = int(tx['value'])
            f.error = _classify_fill_error(tx, fill)
            f.caller = tx['caller']
            f.callee = tx['callee']
            f.fn = tx['name']
            f.interfered = len(set(tx['priorCallees']) & set(EXTERNAL_DEXES)) > 0
            fills.append(f)
    return fills
