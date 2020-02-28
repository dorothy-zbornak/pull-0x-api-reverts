pragma solidity ^0.6;

contract TestERC20 {
    bytes32 ORIGINAL_ADDRESS_KEY = 0xc04f780dfc51d9623e72331bafc42635e5734de82a00cd0f4499fd5e3f3e2d46;
    mapping(address => uint256) private _balances;
    mapping(bytes32 => bytes32) private _stash;

    fallback() payable external {
        _forwardCall();
    }

    receive() payable external {}

    function balanceOf(address owner) external returns (uint256) {
        if (_balances[owner] == 0) {
            _forwardCall();
        }
        return _balances[owner];
    }

    function setOriginal(address original) external {
        _stash[ORIGINAL_ADDRESS_KEY] = bytes32(uint256(uint160(original)));
    }

    function setBalance(address owner, uint256 amount) external {
        _balances[owner] = amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (_balances[msg.sender] == 0) {
            _forwardCall();
        }
        return transferFrom(msg.sender, to, amount);
    }

    function withdraw(uint256 amount) external {
        if (_balances[msg.sender] == 0) {
            _forwardCall();
        }
        _balances[msg.sender] = _sub(_balances[msg.sender], amount);
        msg.sender.transfer(amount);
    }

    function transferFrom(address owner, address to, uint256 amount) public returns (bool) {
        if (_balances[owner] == 0) {
            _forwardCall();
        }
        _balances[owner] = _sub(_balances[owner], amount);
        _balances[to] = _add(_balances[to], amount);
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

    function _forwardCall() private {
        address original = address(uint160(uint256(_stash[ORIGINAL_ADDRESS_KEY])));
        (bool success, bytes memory result) = original.delegatecall(msg.data);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
        assembly { return(add(result, 32), mload(result)) }
    }
}
