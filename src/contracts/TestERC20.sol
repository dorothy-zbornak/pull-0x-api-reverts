pragma solidity ^0.6;

contract TestERC20 {
    bytes32 ORIGINAL_ADDRESS_KEY = 0xc04f780dfc51d9623e72331bafc42635e5734de82a00cd0f4499fd5e3f3e2d46;
    mapping(address => uint256) public balanceOf;
    mapping(bytes32 => bytes32) private _stash;

    fallback() payable external {
        address original = address(uint160(uint256(_stash[ORIGINAL_ADDRESS_KEY])));
        (bool success, bytes memory result) = original.delegatecall(msg.data);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
        assembly { return(add(result, 32), mload(result)) }
    }

    function setOriginal(address original) external {
        _stash[ORIGINAL_ADDRESS_KEY] = bytes32(uint256(uint160(original)));
    }

    function setBalance(address owner, uint256 amount) external {
        balanceOf[owner] = amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return transferFrom(msg.sender, to, amount);
    }

    function transferFrom(address owner, address to, uint256 amount) public returns (bool) {
        balanceOf[owner] = _sub(balanceOf[owner], amount);
        balanceOf[to] = _add(balanceOf[to], amount);
        return true;
    }

    function _add(uint256 a, uint256 b) private pure returns (uint256 c) {
        c = a + b;
        require(c > a, 'TestERC20/ADDITION_OVERFLOW');
    }

    function _sub(uint256 a, uint256 b) private pure returns (uint256 c) {
        c = a - b;
        require(c < a, 'TestERC20/SUBTRACTION_UNDERFLOW');
    }
}
