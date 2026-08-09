# Agent 配置执行指南

用户可以把 GitHub URL 和下面这句话交给拥有终端、文件和浏览器协作能力的本地 Agent：

> 请克隆并配置 https://github.com/HANKSEN/daily-info-radar 。完整阅读仓库的 AGENTS.md 和 docs/setup-guide/agent-setup.md，完成所有可自动化步骤。不要让我在聊天里发送任何密钥；需要密钥时让我在本机安全输入。需要飞书浏览器授权或给机器人发送测试消息时暂停提示我，完成后继续，直到四项 readiness 全部通过并验证定时任务正常。

## Agent 的状态机

1. `bootstrap`：克隆仓库，检查工作区，验证 Node.js，运行测试和 `npm run setup`。
2. `local-secret-input`：用户只在本机 `.env` 输入 AI 密钥；Agent 不读取或回显密钥，只验证变量是否已配置。
3. `feishu-browser-checkpoint`：Agent 启动 `lark-cli config init --new`，把原始授权链接交给用户，等待用户完成浏览器操作。
4. `feishu-message-checkpoint`：Agent 启动单事件监听，用户给机器人发一条消息，Agent 提取 `chat_id` 与 `sender_id` 并写入非敏感配置。
5. `pipeline-verification`：检查信源、运行 doctor、生成真实日报。
6. `send-confirmation`：先 dry-run，得到用户确认后首次真实发送。
7. `automation`：安装对应平台的 scheduler 并检查两个任务。
8. `handoff`：运行 `npm run verify`，输出 readiness、失败信源、计划时间、数据目录、日志路径和休眠限制。

## Agent 不得自行越过的边界

- 不得要求用户把 API Key 或 App Secret 发到聊天。
- 不得在首次真实飞书推送前跳过用户确认。
- 不得因某个非关键源失败而擅自删除信源。
- 不得扩大飞书权限或移除聊天/发送者白名单。
- 不得把 `.env`、日志、本地数据或 RSSHub 运行目录提交到 Git。
- 不得在用户未明确授权时执行 `git push`。

## 可恢复执行

每次恢复配置先运行：

```bash
npm run setup:check
```

只处理返回结果中未通过的阶段。`npm run setup`、scheduler 安装和飞书发送都设计为可重复执行；`.env` 不会被 setup 覆盖，日报发送默认使用日期幂等键。
