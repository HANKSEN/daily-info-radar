# 信源与市场架构优化验收标准

验收日期：2026-06-14

## 验收范围

- `SourceKind` 支持 `rss / api / scrape`。
- 信源配置支持 `subcategory / lang / locales / notes / useCurl`。
- CLI 支持 `npm run sources` 和 `npm run sources:check`。
- API fetcher 支持 V2EX、Hacker News、Hugging Face Daily Papers。
- Scrape fetcher 支持 GitHub Trending，移除第三方 Trending RSS 依赖。
- 候选池使用按来源公平抽样与每源上限。
- 市场 watchlist 覆盖指数、科技股、中概/港股、宏观信号。

## 必须通过的验收命令

```bash
npm test
npm run sources
npm run sources:check
npm run collect
npm run daily:dry
```

## 判定标准

- `npm test` 全部通过。
- `npm run sources` 能列出默认信源，且包含 `rss / api / scrape` 三类。
- `npm run sources:check` 即使外部网络不可用，也能输出每个来源的诊断结果并正常退出。
- `npm run collect` 能运行完整采集入口，单源失败不阻断。
- `npm run daily:dry` 能生成 10-20 条本地验收日报，并继续写入私有数据目录。

## 本次验收结果

- `npm test`：20/20 通过。
- `npm run sources`：列出 15 个默认来源，覆盖 `rss / api / scrape`。
- `npm run sources:check`：检查 15 个来源，当前网络环境下 `okCount=0`，但命令正常退出并输出逐源诊断。
- `npm run collect`：正常退出并写入私有数据目录。
- `npm run daily:dry`：生成 2026-06-14 日报，包含 13 条精选信息。
- 市场快照：21 个标的，覆盖 `index / tech_stock / china_hk_stock / macro`。
- 数据隔离：主仓库未生成 `data / logs / cache / state / local-data` 运行数据目录。
