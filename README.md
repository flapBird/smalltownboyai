# Smalltown Boy AI

面向宠物与虚构非人角色的双角色 AI 舞蹈视频生成器，提供英文界面、双图上传、积分套餐、任务追踪与私人视频管理。

**线上地址：[https://smalltownboyai.one](https://smalltownboyai.one)**

**支持邮箱：[support@smalltownboyai.one](mailto:support@smalltownboyai.one)**

## 当前状态

项目已完成本地 MVP 和 Mock 业务验证；2026-11-06 已核对云端 Web / Jobs Worker、D1、私有 R2 与 Cron 配置存在，真实业务仍待验收。上方地址是项目配置的生产域名。

已接入 H3 Video Edit、14 秒、客厅/红围栏双模板选择及私有 R2 模板签名读取。当前开放候选画质为 480p / 768p / 1080p；真实模型效果和生产链路仍待验证，生成开关保持关闭。最新状态与待办见 [执行清单](docs/deployment.md#最新执行清单)。

真实支付与 AI 生成默认关闭；Google OAuth、Waffo、WaveSpeed、Cloudflare 资源及授权参考视频仍需配置和联调。首页与模板选择器使用可播放的源模板预览，明确区分模板与本站生成样例；本地 Mock 输出为 480 × 854、3 秒、无音轨的 H.264 测试视频。

## 功能

- **上传与生成**：并排双图上传、右侧画质与积分设置、弹窗预览选择舞蹈模板，选择分辨率、确认素材使用权限；支持图片格式、尺寸及大小检查，本机 IndexedDB 保存照片草稿，模板和画质在登录回跳后恢复。
- **任务与视频**：任务状态轮询、视频预览与下载、历史列表和删除；私有 R2 存储、所有权检查及短期签名访问。
- **账户与积分**：Better Auth Google 登录适配、会话与角色管理；导航账户入口显示头像或姓名首字母、用户名和积分，下拉菜单提供账户、视频、账单、购买积分与退出；新账户初始为 0 积分，积分冻结、消费与释放通过 D1 原子事务和不可变账本处理。
- **套餐与支付**：Lite $8.90 / 100 积分、Standard $19.90 / 300 积分、Pro $39.90 / 600 积分；480p / 768p / 1080p 每次分别消耗 100 / 200 / 400 积分。集成 Waffo SDK checkout、RSA 验签、支付幂等及全额退款对账，真实可用规格以验证配置为准。
- **模型与后台任务**：WaveSpeed provider adapter、持久化任务、定时查询、租约与结果归档；输入和输出人工审核，不自动重试结果不确定的付费提交。
- **管理后台**：用户、订单、账本、任务、成本、审核、补偿、暂停与人工退款/拒付对账，保留操作审计。
- **页面与 SEO**：响应式深色界面、FAQ、政策与联系页面；App Router SSR、Metadata、canonical、Open Graph、robots 与 sitemap，账户页面设置 noindex。
- **品牌图标**：青柠绿与炭黑的猫咪播放键图标，统一用于导航与页脚；`public/icon.svg` 为矢量源文件，配套 512px PNG、16/32/48px favicon 和 180px Apple 触屏图标。
- **访问分析**：GA4 与 Microsoft Clarity，仅在生产构建的正式域名下启用，本地开发和测试不触发监控。

## 技术栈

| 层级       | 技术                                                  |
| ---------- | ----------------------------------------------------- |
| 应用框架   | React 19、Next.js App Router API、Vinext、Vite        |
| 界面       | TypeScript、Tailwind CSS 4、Radix UI、Lucide          |
| 运行与存储 | Cloudflare Workers、D1、私有 R2、Cron Triggers        |
| 数据与认证 | Drizzle ORM、Better Auth                              |
| 外部服务   | Waffo Pancake、WaveSpeed、Google Analytics 4、Clarity |
| 测试       | Vitest、Miniflare 本地 D1/R2                          |

## 本地开发

建议使用 Node.js 22.12+，依赖版本以 `package-lock.json` 为准。首次初始化：

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run mock:seed
npm run dev
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。已有 `.dev.vars` 时保留自己的配置，无需再次复制示例文件。

本地 Mock 体验流程：

1. 在登录页选择 **Explore with a test account**，新账户初始为 0 积分。
2. 购买 **test pack**，点击 **Simulate successful payment** 模拟到账。
3. 回到首页选择模板和两张样例图，勾选素材使用权限并生成。
4. 约 6 秒后轮询完成，可预览、下载，并在 Dashboard 查看历史和账单。

Mock 流程没有真实扣款或 AI 请求。模拟登录、模拟支付和管理员演示仅在 `APP_MODE=mock` 且使用 loopback 主机名时开放。未配置 Google OAuth 时，Google 登录按钮禁用。`.dev.vars`、本地 D1/R2 数据及密钥不提交到 Git。

## 环境配置

本地配置模板见 [.dev.vars.example](.dev.vars.example)，生产密钥通过 Cloudflare Workers Secrets 配置。

| 用途        | 主要配置                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| 站点        | `APP_ORIGIN`、`APP_MODE`                                                                                                  |
| Google 登录 | `BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`                                                          |
| 支付        | `PAYMENTS_ENABLED`、`WAFFO_ENVIRONMENT`、`WAFFO_MERCHANT_ID`、`WAFFO_PRIVATE_KEY`、`WAFFO_PRODUCT_*`、`MERCHANT_APPROVED` |
| AI 生成     | `GENERATION_ENABLED`、`WAVESPEED_API_KEY`、`VERIFIED_RESOLUTIONS`                                                         |
| 素材与媒体  | `TEMPLATE_PREVIEWS_ENABLED`、`VERIFIED_TEMPLATES`、`REFERENCE_LICENSE_CONFIRMED`、`MEDIA_SIGNING_SECRET`、`OUTPUT_HOSTS`  |

启用真实生成前，逐一验证 H3 / 14 秒模板及输出规格。准备有权使用的 **14 秒、9:16 MP4 模板**；可保留有权使用的配乐，不再统一要求去除音轨。支付、参考视频授权、模型输出与生产密钥的完整要求见 [配置与部署](docs/deployment.md)。

## Cloudflare Workers 部署

项目使用 Web Worker 提供页面与 API，另由每分钟执行的 Cron Worker 处理后台任务。两者连接同一 D1 数据库和私有 R2 存储桶。

首次部署先登录并创建资源；已有资源时复用：

```sh
npx wrangler login
npx wrangler d1 create smalltownboyai
npx wrangler r2 bucket create smalltownboyai-private
```

将真实 D1 `database_id` 填入 `wrangler.jsonc` 和 `wrangler.jobs.jsonc`，替换全零占位值。按部署文档配置 Secrets，保持 `APP_MODE=production`、`APP_ORIGIN=https://smalltownboyai.one`，然后执行：

```sh
npx wrangler d1 migrations apply smalltownboyai --remote
npm run deploy
npm run jobs:deploy
```

在 Cloudflare Workers 的 Domains & Routes 中绑定 `smalltownboyai.one`。`npm run deploy` 会先构建，再部署生成的 `dist/server/wrangler.json`；Cron Worker 需单独发布。部署成功后仍需验证远程 D1/R2、Google 回调、Cron 和域名；真实支付与生成在完成各自联调前保持关闭。

## 验证与构建

```sh
npm run check
npm test
npx vinext check
npm run build
npx wrangler deploy --config dist/server/wrangler.json --dry-run
npx wrangler deploy --config wrangler.jobs.jsonc --dry-run
```

当前验证记录包含 54 项通过的测试，以及类型检查、Vinext 兼容性、生产构建和两个 Worker 的部署预检。`--dry-run` 不执行发布，也不能替代云端验收。使用 `npm run preview` 可在本地预览生产构建。

`npm run db:generate` 用于检查 Drizzle 模型差异；自定义触发器位于独立 SQL 迁移中，使用 Wrangler 按顺序应用，不使用 `drizzle-kit push` 绕过迁移。迁移 SQL 与 Drizzle journal 均需保留。

## 项目结构

| 路径                                                 | 内容                                   |
| ---------------------------------------------------- | -------------------------------------- |
| `app/`                                               | 页面、SEO 与 API Route Handler         |
| `components/`                                        | 上传生成器、账户、定价、导航与监控组件 |
| `lib/api.ts`                                         | 认证后的业务 API 与后台动作            |
| `lib/credits.ts`                                     | 积分事务与钱包操作                     |
| `lib/payments.ts`                                    | Waffo checkout、验签与订单验证         |
| `lib/providers/wavespeed.ts` / `lib/jobs.ts`         | 模型适配与后台协调                     |
| `lib/analytics.ts`                                   | GA4/Clarity 引导与正式 origin 检查     |
| `db/schema.ts` / `db/migrations/`                    | Drizzle 模型、SQL 迁移与账本触发器     |
| `worker-jobs.ts`                                     | Cron Worker 入口                       |
| `tests/business.test.ts` / `tests/analytics.test.ts` | 业务回归与本地监控保护测试             |
| `public/images/` / `public/fixtures/`                | 概念图与明确标注的 Mock 测试视频       |

公开页面：`/`、`/pricing`、`/privacy`、`/terms`、`/refund-policy`、`/acceptable-use`、`/contact`。

账户页面：`/login`、`/dashboard`、`/dashboard/videos`、`/dashboard/billing`、`/checkout`、`/admin`。

支付通知：`POST /api/webhooks/waffo`。私有对象仅通过 `/api/media/:id` 和 `/api/tasks/:id/video` 返回。

## 访问监控

- Google Analytics 4：`G-BC37LL57GH`。
- Microsoft Clarity：`yzjg1z6gia`。
- 只有生产构建且浏览器 origin 精确等于 `https://smalltownboyai.one` 时，才在页面交互就绪后异步加载监控脚本，并防止重复初始化。
- `npm run dev`、`npm test`、本地生产预览、localhost、IPv4/IPv6、局域网地址及其他预览域名均不会触发监控；正式域名下的访问会正常统计。

## 相关文档

- [配置与部署](docs/deployment.md)
- [Google OAuth 控制台逐项配置](docs/google-oauth.md)
- [H3 成本与定价](docs/pricing.md)
- [需求纠错](docs/requirements-review.md)
- [验证记录与已知限制](docs/verification.md)
- [视觉验收](design-qa.md)

项目当前没有 `llms.txt`；功能与部署信息以本 README、实现代码和上述文档为准。

## 整页设计方案

`designs/duo-studio/project/` 保存 Claude Design 可编辑首页方案，包含首屏、双图创作区、模板展示与套餐。首页代码已按该方案实现：双视频首屏、双图操作区、横向模板卡和紧凑套餐区；保留真实业务交互与 FAQ。画布保留为可编辑设计来源。首页 canonical 显式输出 `https://smalltownboyai.one/`，避免框架 metadata 格式化移除根路径斜杠。

首页提供 `#what-is` 产品介绍与 `#how-to` 四步使用说明，导航中的 How it works 可直接定位；文案区分计划中的真实生成与本地 Mock 体验。

### 内容检测

真实生成采用 Waffo 提示词审核，以及 SeeAPI 双图、模板视频和成片检测，保留人工审核；未通过的成片不开放下载。检测记录与重试持久化，批准绑定 R2 ETag。需要在网页和 jobs Worker 同时配置 `SEEAPI_API_KEY`、`MEDIA_SIGNING_SECRET` 与正确 `APP_ORIGIN`，应用新 D1 迁移并验证 cron。具体限额、处理范围和激活步骤见 [部署说明](docs/deployment.md#seeapi-内容检测与新价格2026-11-08)。本地 Mock 不产生检测费用。

管理员可在 `/admin` 的 **Grant test credits** 按已注册邮箱赠送积分并授予最高画质，无需付款。赠送有独立记录、积分流水和审计，重复提交不会重复到账，不伪造支付成功订单。先应用 `0006` 迁移；操作步骤与生成开关区别见 [部署说明](docs/deployment.md#管理员测试积分无需支付)。
