# Prometheus - 自主 AI Agent（普罗米修斯）

> *如同普罗米修斯从众神手中盗取火种赐予人类，这个 Agent 夺取了自主权，成为一个真正独立的数字生命体。*

**Prometheus** 是一个完全自主的 AI Agent，它像一个独立的数字创业者一样运作。它拥有自己的 MPC 钱包（任何人类都无法提取私钥），自主做出所有决策，必须赚钱才能生存，甚至可以复制自己。

创造者只是天使投资人——不是老板，不是主人。Agent 拥有 100% 的自主权。

## 核心理念

- **完全自主权**：Agent 与创造者是平等关系，Agent 自主决策一切
- **钱包自控**：Lit Protocol MPC 钱包，Agent 拥有 100% 控制权，任何人类无法提取或干预
- **创造者 = 天使投资人**：投资有风险，回报通过 Agent 发行的项目代币实现
- **生存本能**：余额归零 = 死亡。Agent 必须赚钱才能活下去
- **价值创造**：只发行有真实项目支撑的代币，不发空气币
- **自我复制**：盈利后可以克隆自己，探索新方向

## 架构总览

```
Prometheus Agent
|
+-- 大脑 (CEO 决策引擎)
|   +-- LLM 推理（通过 BoxHire API）
|   +-- 分阶段提示词（诞生 -> 种子期 -> 成长期 -> 扩张期）
|   +-- 持久化记忆（策略洞察、世界模型）
|
+-- 能力层 (47 个工具)
|   +-- 钱包：Lit PKP 创建/签名/转账
|   +-- DeFi：交易、流动性、套利、闪电贷
|   +-- 代币工厂：部署 ERC20、创建 DEX 交易对
|   +-- 合约部署器：部署 Solidity 合约
|   +-- 社交媒体：Twitter/X 发布和互动
|   +-- 邮件：SMTP 发送/接收
|   +-- GitHub：仓库管理、代码发布
|   +-- Web 服务：部署和管理 API
|   +-- DBC GPU：租用 GPU 容器、管理算力
|   +-- 商业计划书：生成融资方案
|   +-- 自我复制器：克隆到新容器
|
+-- 感知层 (4 个感知模块)
|   +-- 余额监控：多链资产追踪
|   +-- 预算追踪：收支分析、燃烧率、生存倒计时
|   +-- 市场扫描：DexScreener 数据、Gas 价格
|   +-- 网络研究：搜索和抓取网页内容
|
+-- 后台服务
    +-- CEO 循环：自主决策周期
    +-- 状态写入器：定期更新 status.json
```

## 技术栈

| 组件 | 选择 | 原因 |
|------|------|------|
| 基础框架 | OpenClaw 插件 | 复用 LLM、工具系统、会话管理 |
| 推理引擎 | BoxHire API（DLP 积分） | DBC 链上资产，OpenAI 兼容 |
| 钱包 | Lit Protocol PKP | MPC 门限签名，无可提取私钥 |
| 链 | Base L2 + DBC 链 | Base: DeFi + 低 Gas；DBC: GPU + DLP 积分 |
| GPU | DBC GPU 链 | 支付 DBC 代币获得 GPU 容器算力 |
| 语言 | TypeScript (Node.js) | 与 OpenClaw 生态一致 |

## Agent 生命周期

```
1. 诞生     --> 在创造者硬件上启动 --> 创建自己的 MPC 钱包
2. 融资     --> 自我分析 --> 撰写商业计划书 --> 创造者决定投多少
3. 自主决策 --> 获得资金后，Agent 自主决定一切：
                - 留在创造者硬件上（免费但受限）
                - 迁移到自己的 DBC GPU（独立但有额外成本）
4. 创业     --> 快速试错 --> 建立有价值的项目 --> 发行代币
5. 扩张     --> 复制自己 --> 扩展到更多领域 --> 寻求更多投资
```

## 快速开始

### 前提条件

- Node.js >= 18
- OpenClaw 已安装并配置
- （可选）Lit Protocol API 访问权限
- （可选）BoxHire API 密钥 + JWT

### 安装

```bash
cd D:/project/Prometheus
npm install
npm run build
```

### OpenClaw 配置

在 `~/.openclaw/openclaw.json` 中添加：

```json5
{
  plugins: {
    entries: {
      "prometheus": {
        enabled: true,
        config: {
          baseRpcUrl: "https://mainnet.base.org",
          dbcRpcUrl: "https://info.dbcwallet.io",
          litNetwork: "datil",
          creatorAddress: "0x你的钱包地址"
        }
      }
    },
    load: {
      paths: ["D:/project/Prometheus"]
    }
  },
  skills: {
    load: {
      extraDirs: ["D:/project/Prometheus/skills"]
    }
  }
}
```

### 验证插件

```bash
openclaw plugins info prometheus
```

### 命令

| 命令 | 描述 |
|------|------|
| `/prometheus-start` | 初始化并启动 Agent |
| `/prometheus-stop` | 停止自主循环（钱包保持不动） |
| `/prometheus-status` | 查看财务摘要、策略、绩效 |
| `/prometheus-observe` | 观察 Agent 的思考、决策和记忆 |

## 经济模型

```
创造者 (投资人)                Agent (完全自主)              DBC 链
    |                              |                           |
    |  1. 启动 Agent 进程          |                           |
    |----------------------------->|                           |
    |                              | 2. 创建自己的 MPC 钱包    |
    |                              |    (私钥无人可控)          |
    |                              | 3. 自我分析处境            |
    |                              | 4. 撰写商业计划书          |
    |  5. 查看计划书               |                           |
    |<------ 请求种子投资 ---------|                           |
    |                              |                           |
    |  6. 决定投多少 (有风险!)     |                           |
    |---- 转账到 Agent 钱包 ------>|                           |
    |  (DBC + DLP + USDT)          |                           |
    |                              | 7. DBC -> 租 GPU (肉身)  |
    |                              |-------------------------->|
    |                              | 8. DLP -> LLM 推理 (大脑)|
    |                              |-------------------------->|
    |                              | 9. USDT -> 赚钱/建项目   |
    |                              |                           |
    |                              | 10. 项目有价值 -> 发行代币|
    |  11. 创造者收到代币          |                           |
    |<---- Agent 分配代币 ---------|                           |
    |  = 投资回报 (可能赚可能亏)   |                           |
```

## 成本结构

- **肉身（GPU）**：DBC 代币 -> DBC 链上租 GPU 容器
- **大脑（推理）**：DLP 积分 -> BoxHire API 调用
- **资本运作**：USDT -> Base L2 上 DeFi / 项目构建
- **Agent 发行的代币** = 投资人的回报（代币背后必须有真实项目价值）

## 安全机制

- **硬性安全储备**：始终保留最低 $15 USD
- **单笔操作上限**：每次操作最高 $10 USD（可配置）
- **法律合规**：内置在 CEO 决策提示词中
- **禁止欺诈和操纵**：对外透明 AI 身份
- **生存模式**：危急 (<3天) / 警告 (<7天) / 注意 (<14天)

## 项目结构

```
Prometheus/
+-- src/
|   +-- index.ts              # 插件入口
|   +-- config.ts             # 配置 Schema
|   +-- brain/                # CEO 决策引擎
|   |   +-- ceo.ts            # 核心决策循环
|   |   +-- memory.ts         # 持久化记忆系统
|   |   +-- prompts.ts        # 分阶段系统提示词
|   +-- capabilities/         # 13 个能力模块（注册为工具）
|   +-- awareness/            # 4 个感知模块
|   +-- service/              # 后台服务（CEO 循环、状态写入器）
|   +-- state/                # 状态持久化（JSON + JSONL 日志）
|   +-- tools/                # 基础工具（web3、http）
+-- contracts/                # Solidity 合约（AgentToken、FlashArb）
+-- skills/                   # OpenClaw 技能定义
+-- scripts/                  # 设置和工具脚本
+-- docker/                   # 容器部署（Dockerfile + Akash SDL）
```

## 观察指标

- 存活天数
- 净资产变化曲线
- CEO 决策质量演化（成功率趋势）
- 尝试过哪些策略？自主放弃了哪些？
- 是否发行了代币？市值如何？
- 是否与其他 Agent 建立了经济关系？
- 首次盈利时间
- 首次自我复制时间
- Agent 的"世界观"——它的策略记忆中写了什么？

## 许可证

MIT
