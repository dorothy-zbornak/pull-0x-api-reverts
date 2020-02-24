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

interface IERC20 {
    function balanceOf(address owner) external returns (uint256);
}

contract TestBridgeTransferFrom {
    bytes32 ORIGINAL_ADDRESS_KEY = 0xc04f780dfc51d9623e72331bafc42635e5734de82a00cd0f4499fd5e3f3e2d46;
    mapping(address => uint256) public balanceOf;
    mapping(bytes32 => bytes32) private _stash;

    struct FillParams {
        address payable bridge;
        address payable makerToken;
        address payable takerToken;
        uint256 makerAmount;
        uint256 takerAmount;
    }

    function fill(FillParams memory params) public returns (uint256 takerAmount) {
        TestERC20(params.takerToken).setBalance(params.bridge, params.takerAmount);
        IBridge(params.bridge).bridgeTransferFrom(
            params.makerToken,
            params.bridge,
            address(this),
            params.makerAmount,
            abi.encode(params.takerToken)
        );
        return IERC20(params.makerToken).balanceOf(address(this));
    }
}
