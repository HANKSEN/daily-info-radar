# 信息源策略

## 当前采集方案

采集器支持三类来源：

- `rss`：直接读取 RSS/Atom，适合官方博客、媒体、RSSHub。
- `api`：读取公开 JSON API，适合 V2EX、Hacker News、Hugging Face Daily Papers。
- `scrape`：轻量 HTML 抓取，当前用于 GitHub Trending，避免依赖第三方 Trending RSS。

单个来源失败不会中断日报。RSSHub 基础地址通过环境变量配置：

```bash
RSSHUB_BASE_URL=https://rsshub.app
```

建议长期改为自建 RSSHub 实例，减少公共实例不可用、限流或路由变化造成的影响。

## 已接入来源

| ID | 名称 | 类型 | 领域 | 子类 | 权重 | 说明 |
|---|---|---|---|---|---:|---|
| openai-blog | OpenAI Blog | rss | AI | 官方发布 | 1.20 | 一手官方发布 |
| deepmind-blog | DeepMind Blog | rss | AI | 官方研究 | 1.20 | 一手研究和产品信息 |
| huggingface-blog | Hugging Face Blog | rss | AI | 开源生态 | 1.10 | 开源模型与工程生态 |
| huggingface-daily-papers | Hugging Face Daily Papers | api | AI | 论文趋势 | 1.15 | 每日 AI 论文趋势 |
| qbitai | 量子位 | rss | AI | 中文 AI 资讯 | 1.15 | 中文 AI 资讯 |
| jiqizhixin | 机器之心 | rss | AI | 中文 AI 研究 | 1.15 | 中文 AI 研究和产业 |
| hacker-news-top | Hacker News Top | api | 科技 | 英文技术社区 | 1.00 | HN 官方 Firebase API |
| github-trending | GitHub Trending | scrape | 科技 | 开源趋势 | 1.00 | 直接抓取 GitHub Trending |
| v2ex-hot | V2EX 热门 | api | 科技 | 中文技术社区 | 1.00 | V2EX 热门主题 API |
| infoq-cn | InfoQ 中文 | rss | 科技 | 中文技术深度 | 1.05 | 中文工程和架构内容 |
| ifanr | 爱范儿 | rss | 科技 | 产品科技 | 1.00 | 产品和消费科技 |
| sspai | 少数派 | rss | 科技 | 数字工具 | 0.95 | 工具和效率产品 |
| latepost | 晚点 LatePost | rss | 科技 | 商业科技 | 1.20 | RSSHub 路由 |
| 36kr | 36氪 | rss | 科技 | 创投快讯 | 0.95 | RSSHub 路由，快讯权重较低 |
| huxiu | 虎嗅 | rss | 科技 | 商业科技评论 | 1.00 | RSSHub 路由 |

## 候选池控制

候选池使用“按来源公平抽样 + 每源上限”：

```bash
RADAR_CANDIDATE_POOL_MAX=80
RADAR_MAX_PER_SOURCE=8
```

这样可以避免单个高产快讯源挤掉深度文章或高质量社区信号。

## 市场 Watchlist

市场快照已从基础指数扩展为四组：

- `index`：纳斯达克 100、标普 500、沪深 300、上证指数、创业板指。
- `tech_stock`：NVDA、MSFT、AAPL、GOOGL、META、TSLA。
- `china_hk_stock`：BABA、BIDU、JD、腾讯控股、美团。
- `macro`：BTC、ETH、WTI 原油、黄金、美元指数。

## 当前还未做的来源类型

- 微信公众号：需要额外采集方案，不适合直接放入 RSS/API/scrape 通用采集器。
- X/Twitter、即刻、雪球：需要 API、RSSHub 或网页抓取策略，且要处理登录、限流和噪音。
- 研报和机构报告：可以后续接 arXiv、机构 RSS 或手工白名单。
- 网页正文抓取：阶段一暂不抓正文，只使用标题、链接、摘要和时间。

## 后续中文候选源

这些来源建议在能联网验证路由后再启用：

- 极客公园
- 雷峰网
- 钛媒体
- 品玩
- 甲子光年
- 财新科技
- 第一财经科技
- 证券时报科技
- 澎湃科技

## 质量控制规则

- 官方源和深度报道源权重更高。
- 快讯源权重较低，避免日报被碎片化短讯占满。
- RSSHub 源统一可替换基础地址，不在开源仓库中绑定私有实例。
- 单源失败降级跳过，避免每日任务被一个失效来源阻断。
