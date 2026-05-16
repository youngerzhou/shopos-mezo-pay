// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ShoposPullPayment {
    address public immutable musd;
    address public owner;

    mapping(address => bool) public operators;

    event PaymentPulled(address indexed customer, address indexed merchant, uint256 amount, address indexed operator);
    event OperatorUpdated(address indexed operator, bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ShoposPullPayment: not owner");
        _;
    }

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner || operators[msg.sender], "ShoposPullPayment: not operator");
        _;
    }

    constructor(address musdToken) {
        require(musdToken != address(0), "ShoposPullPayment: invalid MUSD");
        musd = musdToken;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        require(operator != address(0), "ShoposPullPayment: invalid operator");
        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ShoposPullPayment: invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function pullPayment(address customer, address merchant, uint256 amount) external onlyOwnerOrOperator returns (bool) {
        require(customer != address(0), "ShoposPullPayment: invalid customer");
        require(merchant != address(0), "ShoposPullPayment: invalid merchant");
        require(amount > 0, "ShoposPullPayment: invalid amount");

        bool success = IERC20(musd).transferFrom(customer, merchant, amount);
        require(success, "ShoposPullPayment: transfer failed");

        emit PaymentPulled(customer, merchant, amount, msg.sender);
        return true;
    }
}
