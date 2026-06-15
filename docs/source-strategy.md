# 信息源策略

## 当前采集方案

采集器支持三类来源：

- `rss`：直接读取 RSS/Atom，适合官方博客、媒体、RSSHub。
- `api`：读取公开 JSON API，适合 V2EX、Hacker News、Hugging Face Daily Papers、知乎热榜、华尔街见闻、财联社。
- `scrape`：轻量 HTML 抓取，当前用于 GitHub Trending 和微博热搜，避免依赖第三方 Trending RSS。

单个来源失败不会中断日报。RSSHub 基础地址通过环境变量配置：

```bash
RSSHUB_BASE_URL=https://rsshub.app
```

本机运行建议改为自建 RSSHub 实例，减少公共实例不可用、限流或路由变化造成的影响：

```bash
RSSHUB_BASE_URL=http://127.0.0.1:1200
```

当前本机 RSSHub 运行配置放在仓库旁边的 `../daily-info-radar.local-rsshub/`，不属于可开源主仓库资产。

关键降级策略：

- GitHub Trending：页面抓取失败时，自动使用 GitHub Search API 查询近 48 小时内活跃且高 star 的仓库。
- RSS：Node `fetch` 失败或被本机网络重置时，自动降级到 `curl`，复用本机可用的代理/证书链路。
- Hugging Face Blog：官方 RSS 不通时，补充 BestBlogs 官方 AI 高分 RSS 作为替代 AI 信号，条目会标记为 `BestBlogs AI 高分内容`，避免误标为 Hugging Face。

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
| xinzhiyuan | 新智元 | rss | AI | 中文 AI 资讯 | 1.10 | BestBlogs WeChat2RSS |
| ai-frontier | AI 前线 | rss | AI | 中文 AI 工程 | 1.05 | BestBlogs WeChat2RSS |
| zhipu | 智谱 | rss | AI | 国产模型官方 | 1.15 | BestBlogs WeChat2RSS |
| modelscope | 魔搭 ModelScope | rss | AI | 模型社区 | 1.10 | BestBlogs WeChat2RSS |
| dify | Dify | rss | AI | AI 应用开发 | 1.10 | BestBlogs WeChat2RSS |
| llamaindex-blog | LlamaIndex Blog | scrape | AI | AI 应用开发 | 1.10 | RAG/Agent 工程，页面抓取 |
| qdrant-blog | Qdrant Blog | rss | AI | 向量数据库 | 1.05 | 检索和向量数据库工程 |
| google-cloud-blog | Google Cloud Blog | rss | 科技 | 云与 AI 平台 | 1.05 | 云、AI 平台和基础设施 |
| github-blog | The GitHub Blog | rss | 科技 | 开发者平台 | 1.05 | GitHub、Copilot、安全和开发者工作流 |
| last-week-in-ai | Last Week in AI | rss | AI | AI 周报 | 0.95 | 二级汇总信号 |
| tencent-cloud-dev | 腾讯云开发者 | rss | 科技 | 中文云与工程 | 1.00 | BestBlogs WeChat2RSS |
| google-developers-cn | 谷歌开发者 | rss | 科技 | 中文开发者生态 | 1.00 | BestBlogs WeChat2RSS |
| redtech | 小红书技术 REDtech | rss | 科技 | 中文工程实践 | 1.00 | BestBlogs WeChat2RSS |
| thoughtworks-insights | Thoughtworks 洞见 | rss | 科技 | 工程与组织洞察 | 1.00 | BestBlogs WeChat2RSS |
| bytebytego | ByteByteGo Newsletter | rss | 科技 | 系统设计 | 1.00 | 系统设计与架构 |
| martin-fowler | Martin Fowler | rss | 科技 | 软件工程深度 | 1.05 | 软件设计、架构和交付 |
| aws-architecture-blog | AWS Architecture Blog | rss | 科技 | 云架构 | 1.00 | 云架构和生产工程 |
| zhihu-hot | 知乎热榜 | api | 科技 | 中文热点社区 | 0.65 | 泛热点信号，低权重 |
| wallstreetcn-news | 华尔街见闻 | api | 市场 | 宏观与科技市场 | 0.80 | 宏观、资本市场和科技市场 |
| cls-telegraph | 财联社电报 | api | 市场 | 财经快讯 | 0.75 | 高频短讯，低权重 |
| weibo-hot | 微博热搜 | scrape | 科技 | 中文社会热点 | 0.55 | 泛社会热点，极低权重 |

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

- 非公开微信公众号：当前只接入可公开访问的 WeChat2RSS 源；私有或不稳定公众号仍需要额外采集方案。
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

## 扩展批次记录

第一批已接入 AI 和开发者高信号源：新智元、AI 前线、智谱、魔搭 ModelScope、Dify、LlamaIndex、Qdrant、Google Cloud Blog、GitHub Blog、Last Week in AI。

第二批已接入工程深度和中文热点补充源：腾讯云开发者、谷歌开发者、小红书技术 REDtech、Thoughtworks 洞见、ByteByteGo、Martin Fowler、AWS Architecture Blog、知乎热榜、华尔街见闻、财联社电报、微博热搜。

热榜和快讯源只做低权重补充，不作为主质量来源；最终仍受 24 小时时效窗口、AI `selected=true && valueScore>=3` 质量门槛，以及负面推荐理由保护约束。

## 质量控制规则

- 官方源和深度报道源权重更高。
- 快讯源权重较低，避免日报被碎片化短讯占满。
- RSSHub 源统一可替换基础地址，不在开源仓库中绑定私有实例。
- 单源失败降级跳过，避免每日任务被一个失效来源阻断。
- `sources:check` 会输出 `checkedUrl / fallback / viaCurl`，用于区分主源可用、备用源可用、curl 兜底可用三种状态。
