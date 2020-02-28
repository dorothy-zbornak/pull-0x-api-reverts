pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import './TestERC20.sol';

interface IBridge {
    function bridgeTransferFrom(
        address tokenAddress,
        address from,
        address to,
        uint256 amount,
        bytes calldata bridgeData
    ) external returns (bytes4);
}

contract TestBridgeTransferFrom {
    address constant internal WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    bytes32 constant internal ORIGINAL_ADDRESS_KEY = 0xc04f780dfc51d9623e72331bafc42635e5734de82a00cd0f4499fd5e3f3e2d46;
    mapping(address => uint256) public balanceOf;
    mapping(bytes32 => bytes32) private _stash;

    struct FillParams {
        address payable bridge;
        address payable makerToken;
        address payable takerToken;
        uint256 makerAmount;
        uint256 takerAmount;
        address originalTakerToken;
    }

    receive() payable external {}

    function fill(FillParams memory params) public payable returns (uint256 takerAmount) {
        if (params.takerToken == WETH) {
            params.takerToken.transfer(msg.value);
        }
        TestERC20(params.takerToken).setOriginal(params.originalTakerToken);
        TestERC20(params.takerToken).setBalance(params.bridge, params.takerAmount);
        IBridge(params.bridge).bridgeTransferFrom(
            params.makerToken,
            params.bridge,
            address(this),
            params.makerAmount,
            abi.encode(params.takerToken)
        );
        return TestERC20(params.makerToken).balanceOf(address(this));
    }
}
