// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20TransferFrom {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract ShopOSPayment {
    address public immutable musd;

    event OrderPaid(
        bytes32 indexed paymentIntentId,
        bytes32 indexed orderId,
        address indexed merchant,
        address payer,
        address token,
        uint256 amount
    );

    constructor(address musdToken) {
        require(musdToken != address(0), "ShopOSPayment: invalid MUSD");
        musd = musdToken;
    }

    function payOrder(
        bytes32 paymentIntentId,
        bytes32 orderId,
        address merchant,
        uint256 amount
    ) external {
        require(merchant != address(0), "ShopOSPayment: invalid merchant");
        require(amount > 0, "ShopOSPayment: invalid amount");

        bool success = IERC20TransferFrom(musd).transferFrom(msg.sender, merchant, amount);
        require(success, "ShopOSPayment: transfer failed");

        emit OrderPaid(paymentIntentId, orderId, merchant, msg.sender, musd, amount);
    }

    function payOrderWithPermit(
        bytes32 paymentIntentId,
        bytes32 orderId,
        address merchant,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(merchant != address(0), "ShopOSPayment: invalid merchant");
        require(amount > 0, "ShopOSPayment: invalid amount");

        // 1. Execute permit signature on token to approve this contract to spend msg.sender's MUSD
        IERC20Permit(musd).permit(msg.sender, address(this), amount, deadline, v, r, s);

        // 2. Perform token transfer from msg.sender to merchant
        bool success = IERC20TransferFrom(musd).transferFrom(msg.sender, merchant, amount);
        require(success, "ShopOSPayment: transfer failed");

        // 3. Emit matching OrderPaid event so Goldsky indexing requires 0 changes!
        emit OrderPaid(paymentIntentId, orderId, merchant, msg.sender, musd, amount);
    }
}
