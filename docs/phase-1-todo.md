# 阶段一待办任务清单

## 目标

完成接入飞书机器人之前的本地日报流水线，达到可独立验收状态。

## 已拆分任务

- [x] 建立独立 TypeScript/Node 项目骨架。
- [x] 建立主仓库与私有运行数据目录分离规范。
- [x] 添加 `.gitignore`，防止 `.env`、日志、缓存、状态和生产数据进入仓库。
- [x] 实现运行配置读取，支持 `.env` 与 `RADAR_DATA_DIR`。
- [x] 实现 RSS 信源配置与采集骨架。
- [x] 实现市场指数快照采集与失败降级。
- [x] 实现 URL 归一化、标题归一化和候选标准化。
- [x] 实现重复 URL / 重复标题合并。
- [x] 实现视频、播客、低质量短标题预过滤。
- [x] 实现 dry-run fixture 和启发式分析器。
- [x] 实现 OpenAI-compatible AI 分析接口。
- [x] 实现精选排序与数量控制。
- [x] 实现 JSON 与 Markdown 日报渲染。
- [x] 实现 `daily`、`daily:dry`、`collect`、`analyze`、`render` 命令。
- [x] 添加阶段一自动化测试。
- [x] 运行测试与 dry-run 验收。

## 阶段一不包含

- 飞书机器人推送。
- 飞书事件长连接。
- Obsidian 待读清单写入。
- launchd 安装。
- Web Dashboard。
