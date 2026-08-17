# Agent 配置执行指南

用户可以把 GitHub URL 和下面这句话交给拥有终端、文件和浏览器协作能力的本地 Agent：

> 请克隆并配置 https://github.com/HANKSEN/daily-info-radar 。完整阅读仓库的 AGENTS.md、docs/setup-guide/agent-setup.md 和 docs/setup-guide/beginner-guide.md，完成所有可自动化步骤。先确认我是否已有飞书企业账号和管理员权限，缺少时按零基础手册逐页引导我完成。不要让我在聊天里发送任何密钥；需要密钥时让我在本机安全输入。需要飞书浏览器授权或给机器人发送测试消息时暂停提示我，完成后继续，直到四项 readiness 全部通过并验证定时任务正常。

## Agent 的状态机

1. `feishu-account-checkpoint`：确认用户已拥有飞书企业账号和管理员权限。缺少时按零基础手册第 3 章逐页引导用户。
2. `bootstrap`：克隆仓库，检查工作区，验证 Node.js，运行测试和 `npm run setup`。
3. `local-secret-input`：用户只在本机 `.env` 输入 AI 密钥；Agent 不读取或回显密钥，只验证变量是否已配置。
4. `feishu-local-credential-checkpoint`：Agent 启动 `lark-cli config init --new`，由用户在本机输入 App ID 和 App Secret，然后运行 `lark-cli auth login --recommend`。
5. `feishu-browser-checkpoint`：Agent 把授权链接交给用户，引导用户添加机器人能力和最小权限。Agent 先启动长连接监听，用户再保存长连接订阅、添加事件并发布版本。
6. `feishu-message-checkpoint`：用户给机器人发一条私聊消息，Agent 提取 `chat_id` 与 `sender_id` 并写入非敏感配置。
7. `pipeline-verification`：检查信源、运行 doctor、生成真实日报。
8. `send-confirmation`：先 dry-run，得到用户确认后首次真实发送。
9. `automation`：安装对应平台的 scheduler 并检查两个任务。
10. `handoff`：运行 `npm run verify`，输出 readiness、失败信源、计划时间、数据目录、日志路径和休眠限制。

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

定时任务必须指向 `npm run daily:scheduled`，以启用失败日志、飞书告警和自然语言恢复。更新旧版本后重新运行 `npm run scheduler:install`。不要通过机器人收集密钥；鉴权问题只提供安全处理指引。
