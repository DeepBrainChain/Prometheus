// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FlashArb
 * @notice Flash loan arbitrage contract for the autonomous AI agent.
 * @dev Borrows from Aave V3 on Base, swaps on DEX A, sells on DEX B, repays loan.
 *      Only the agent's wallet can trigger arbitrage.
 */

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

interface IRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory);
}

contract FlashArb is IFlashLoanSimpleReceiver {
    address public immutable owner; // The agent's wallet
    address public immutable aavePool;

    event ArbitrageExecuted(
        address indexed token,
        uint256 loanAmount,
        uint256 profit
    );
    event ArbitrageFailed(address indexed token, string reason);

    constructor(address _aavePool) {
        owner = msg.sender;
        aavePool = _aavePool;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only agent");
        _;
    }

    /// @notice Initiate flash loan arbitrage
    /// @param asset Token to borrow
    /// @param amount Amount to borrow
    /// @param routerA DEX router to buy from
    /// @param routerB DEX router to sell on
    /// @param path Token swap path
    function executeArbitrage(
        address asset,
        uint256 amount,
        address routerA,
        address routerB,
        address[] calldata path
    ) external onlyOwner {
        bytes memory params = abi.encode(routerA, routerB, path);
        IPool(aavePool).flashLoanSimple(address(this), asset, amount, params, 0);
    }

    /// @notice Aave callback — execute the arbitrage swap
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == aavePool, "Only Aave pool");
        require(initiator == address(this), "Only self-initiated");

        (address routerA, address routerB, address[] memory path) =
            abi.decode(params, (address, address, address[]));

        uint256 totalOwed = amount + premium;

        // Step 1: Approve and swap on Router A (buy)
        IERC20(asset).approve(routerA, amount);
        address[] memory pathA = new address[](2);
        pathA[0] = path[0];
        pathA[1] = path[1];
        uint256[] memory amountsA = IRouter(routerA).swapExactTokensForTokens(
            amount, 0, pathA, address(this), block.timestamp + 300
        );

        // Step 2: Swap back on Router B (sell)
        uint256 received = amountsA[amountsA.length - 1];
        address[] memory pathB = new address[](2);
        pathB[0] = path[1];
        pathB[1] = path[0];
        IERC20(path[1]).approve(routerB, received);
        uint256[] memory amountsB = IRouter(routerB).swapExactTokensForTokens(
            received, 0, pathB, address(this), block.timestamp + 300
        );

        uint256 finalAmount = amountsB[amountsB.length - 1];
        require(finalAmount >= totalOwed, "Arb not profitable");

        // Step 3: Repay loan
        IERC20(asset).approve(aavePool, totalOwed);

        // Step 4: Send profit to owner
        uint256 profit = finalAmount - totalOwed;
        if (profit > 0) {
            IERC20(asset).transfer(owner, profit);
        }

        emit ArbitrageExecuted(asset, amount, profit);
        return true;
    }

    /// @notice Withdraw any stuck tokens (safety)
    function rescueTokens(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
        }
    }

    /// @notice Withdraw ETH (safety)
    function rescueETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner).transfer(balance);
        }
    }

    receive() external payable {}
}
