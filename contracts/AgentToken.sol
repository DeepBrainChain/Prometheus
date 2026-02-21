// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentToken
 * @notice Standard ERC20 token deployed by an autonomous AI agent.
 * @dev Fixed supply, no mint/burn after deployment. Ownership renounced for trust.
 *      This token represents equity in a real project built by the agent.
 */
contract AgentToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Project transparency
    string public projectInfo;
    address public immutable deployer;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event ProjectInfoUpdated(string newInfo);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        string memory _projectInfo,
        address _creatorAddress,
        uint256 _creatorAllocationBps // basis points (e.g. 1000 = 10%)
    ) {
        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply;
        projectInfo = _projectInfo;
        deployer = msg.sender;

        // Allocate creator's share
        uint256 creatorShare = (_totalSupply * _creatorAllocationBps) / 10000;
        uint256 agentShare = _totalSupply - creatorShare;

        balanceOf[msg.sender] = agentShare;
        emit Transfer(address(0), msg.sender, agentShare);

        if (creatorShare > 0 && _creatorAddress != address(0)) {
            balanceOf[_creatorAddress] = creatorShare;
            emit Transfer(address(0), _creatorAddress, creatorShare);
        }
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    /// @notice Only the deployer (agent) can update project info for transparency
    function updateProjectInfo(string calldata newInfo) external {
        require(msg.sender == deployer, "Only deployer");
        projectInfo = newInfo;
        emit ProjectInfoUpdated(newInfo);
    }
}
