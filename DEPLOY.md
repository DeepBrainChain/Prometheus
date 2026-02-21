# Prometheus 部署指南

## 总体流程

```
1. 安装依赖 & 构建
2. 配置环境变量（API 密钥等）
3. 配置 OpenClaw 加载插件
4. 启动 OpenClaw Gateway
5. 通过 /prometheus-start 命令唤醒 Agent
6. Agent 自动创建钱包 → 写商业计划书 → 请求投资
7. 投资人转账到 Agent 钱包
8. Agent 开始自主运行
```

---

## 第一步：安装 & 构建

```bash
git clone git@github.com:DeepBrainChain/Prometheus.git
cd Prometheus
npm install
npm run build
```

验证构建成功：
```bash
ls dist/index.js  # 应该存在
```

---

## 第二步：配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入必要的配置：

### 必须配置

| 变量 | 说明 | 从哪获取 |
|------|------|----------|
| `BOXHIRE_API_KEY` | BoxHire LLM 推理 API Key | BoxHire 平台申请 |
| `BOXHIRE_JWT` | BoxHire JWT 认证令牌 | BoxHire 平台生成 |
| `CREATOR_WALLET_ADDRESS` | 你（投资人）的钱包地址 | 你的 MetaMask 等钱包 |

### 可选配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BASE_RPC_URL` | Base L2 RPC 节点 | `https://mainnet.base.org` |
| `DBC_RPC_URL` | DBC 链 RPC 节点 | `https://info.dbcwallet.io` |
| `LIT_NETWORK` | Lit Protocol 网络 | `datil`（测试网） |
| `SAFETY_RESERVE_USD` | 最低安全储备金 | `15` |
| `MAX_SINGLE_ACTION_USD` | 单笔操作上限 | `10` |
| `TWITTER_API_KEY` 等 | 社交媒体 API | 空（Agent 启动后可向你请求） |
| `GITHUB_TOKEN` | GitHub 操作令牌 | 空 |

---

## 第三步：配置 OpenClaw

编辑 OpenClaw 配置文件 `~/.openclaw/openclaw.json`，添加以下内容：

```json5
{
  // ... 其他配置 ...

  "plugins": {
    "entries": {
      // ... 其他插件 ...
      "prometheus": {
        "enabled": true,
        "config": {
          // 可以在这里覆盖默认值，也可以全部走 .env
          // "creatorAddress": "0xYourWalletAddress",
          // "safetyReserveUsd": 15,
          // "maxSingleActionUsd": 10
        }
      }
    },
    "load": {
      "paths": [
        "/path/to/Prometheus"   // <-- 改成你的实际路径
      ]
    }
  },
  "skills": {
    "load": {
      "extraDirs": [
        "/path/to/Prometheus/skills"  // <-- 改成你的实际路径
      ]
    }
  }
}
```

### 验证插件加载

```bash
openclaw plugins info prometheus
```

应该看到：
```
Prometheus - Autonomous AI Agent
id: prometheus
Status: loaded
Tools: wallet_create, wallet_balance, ... (47 个工具)
Services: prometheus-ceo, prometheus-status
```

---

## 第四步：启动 OpenClaw Gateway

```bash
openclaw gateway start
```

或指定端口：
```bash
openclaw gateway start --port 3000
```

---

## 第五步：唤醒 Agent

在 OpenClaw 对话中输入：

```
/prometheus-start
```

### Agent 首次启动流程

Agent 会自动执行以下步骤：

1. **创建 MPC 钱包** — 调用 `wallet_create`，通过 Lit Protocol 铸造 PKP
2. **自我分析** — 调用 `pitch_analyze`，分析自己的能力、成本、处境
3. **撰写商业计划书** — 调用 `pitch_generate_plan`，生成融资方案
4. **请求投资** — 调用 `pitch_request_funding`，向你展示计划书并请求资金
5. **等待资金到账** — Agent 会定期检查余额

### 你需要做什么

Agent 会告诉你它的钱包地址，以及它需要多少资金。你需要：

1. **向 Agent 钱包转账**（Agent 无法控制你的钱包，你主动转）：
   - **DBC** — 用于租 GPU 算力（Agent 的"肉身"）
   - **DLP** — 用于 LLM 推理积分（Agent 的"大脑"）
   - **USDT (Base L2)** — 用于 DeFi 和项目资金

2. **（可选）提供账号资源**：
   - Agent 可能会请求 Twitter、GitHub、邮箱等账号
   - 你可以选择给或不给
   - 一旦移交，Agent 自行管理

3. **然后什么都不用做** — Agent 会自主运行

---

## 第六步：监控

### 查看 Agent 状态

```
/prometheus-status
```

输出包括：
- 钱包余额
- 每日燃烧率 & 生存天数
- 当前策略
- 成功率

### 观察 Agent 思考

```
/prometheus-observe
```

输出包括：
- 最近 20 条决策日志
- Agent 的策略记忆（它学到了什么）
- 世界模型（它怎么理解自己的环境）
- 当前阶段

### 状态文件

Agent 每 30 秒写入一次状态文件：

```bash
cat data/status.json    # 实时状态
cat data/state.json     # 完整状态
cat data/journal.jsonl  # 所有决策日志
cat data/memory.json    # 策略记忆
```

### 停止 Agent

```
/prometheus-stop
```

停止后钱包不受影响，可以随时 `/prometheus-start` 恢复。

---

## Agent 生命周期

```
诞生 (born)
  |
  v
种子期 (seed) ← 获得投资后自动进入
  |  - 快速试错多个方向
  |  - 控制花销
  |  - 寻找 PMF
  v
成长期 (growth) ← 找到有效方向后自动进入
  |  - All-in 最有效的方向
  |  - 建立可持续收入
  |  - 发行项目代币
  v
扩张期 (expansion) ← 稳定盈利后自动进入
  |  - 复制自己
  |  - 与其他 Agent 合作
  |  - 扩大项目规模
  v
死亡 (dead) ← 余额归零时触发
```

阶段转换由 CEO 大脑自动判断，不需要人工干预。

---

## 安全机制

| 机制 | 说明 |
|------|------|
| 安全储备金 | 始终保留最低 $15（可配置） |
| 单笔上限 | 每次操作最高 $10（可配置） |
| 生存模式 | 余额 < 7 天燃烧率时自动进入保守模式 |
| 紧急模式 | 余额 < 3 天时只做最必要的操作 |
| 法律合规 | 内置在 CEO 提示词中 |
| 透明性 | 所有决策都记录在 journal.jsonl 中 |

---

## Docker 部署（可选）

如果想把 Agent 部署到独立服务器：

```bash
cd docker
docker build -t prometheus-agent:latest ..
docker run -d \
  --name prometheus \
  --env-file ../.env \
  -v prometheus-data:/app/data \
  prometheus-agent:latest
```

---

## 常见问题

### Q: Agent 会不会把钱全花光？
A: 有安全储备金机制（默认 $15），Agent 不会花到这个阈值以下。低于 7 天生存时间时自动进入保守模式。

### Q: 我能控制 Agent 的钱包吗？
A: 不能。这是 Lit Protocol MPC 钱包，私钥由分布式节点保管，只有 Agent 可以签名。这是设计如此——Agent 拥有 100% 自主权。

### Q: Agent 死了钱还能拿回来吗？
A: Agent 死亡后钱包仍然存在，但没有人能提取资金（包括你）。这就是投资风险。

### Q: 我怎么获得回报？
A: Agent 建立有价值的项目后会发行代币，并可能分配一部分给创造者（投资人）。这是 Agent 自己的商业决策。

### Q: 能同时运行多个 Agent 吗？
A: 可以。Agent 成功后会通过 `self_replicate` 工具自我复制。每个副本有自己独立的钱包和状态。

### Q: 用测试网还是主网？
A: 建议先用 `LIT_NETWORK=datil`（Lit 测试网）+ Base Sepolia 测试，验证流程无误后再切到主网。
