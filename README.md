# Smalltown Boy AI

英文宠物双角色舞蹈生成器的本地 MVP。主域名 `https://smalltownboyai.one`，支持邮箱 `support@smalltownboyai.one`。

当前交付范围是**本地工程与 Mock 验证**。真实 Google OAuth、Waffo 测试商户、WaveSpeed、Cloudflare 账户及授权参考视频尚未提供；未运行真实支付或收费生成，未部署。首页为明确标注的 AI 概念图，Mock 输出为 480 × 854、3 秒、无音轨的 H.264 测试片段。

## 本地启动

建议 Node.js 22.12+；依赖版本以 `package-lock.json` 为准。

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run mock:seed
npm run dev
```

打开 `http://127.0.0.1:3000`。在登录页选择 **Explore with a test account**，新账户为 0 积分；购买 **test pack** 并点 **Simulate successful payment**；回到首页选择两张样例图、勾选使用权限，再生成。约 6 秒后轮询完成，可播放、下载并在 Dashboard 查看。没有实际扣款或 AI 请求。上传前草稿保存在本机 IndexedDB，登录回跳后恢复。

`APP_MODE=mock` 与 loopback 主机名同时满足时才开放模拟登录、模拟支付与管理员演示。不要把本地服务暴露为公共代理。未配置 Google 时按钮禁用。`.dev.vars`、本地 D1/R2 数据及密钥不进 Git。

## 已实现

- 第二版深色视觉：双图上传、竖屏预览、套餐、示例概念图、使用步骤、FAQ；桌面和移动布局。
- App Router SSR、Metadata/canonical/Open Graph、robots、sitemap，私有页面 noindex；无虚构 VideoObject。
- Better Auth Google OAuth 服务端适配、D1 官方认证表、数据库角色、会话、登出、首次零积分钱包。
- D1 原子任务冻结与不可变积分账本；并发防超支、业务键去重、失败释放、退款后等级重算，余额与等级分离。
- Lite $8.90 / 100、Standard $16.90 / 200、Pro $49.90 / 600；消耗 100 / 200 / 500。价格、权限由服务端检查。
- 官方 Waffo SDK checkout 与 RSA 验签；订单金额/商品/用户/环境检查，重复、乱序完成/全额退款处理。跳转不发积分。
- WaveSpeed provider adapter；任务持久化、定时查询、租约、私有 R2 结果保存、人工输入/输出审核，不自动重试付费提交。
- 文件格式、尺寸、大小限制，所有权、短期签名访问、删除和孤立上传清理；上传/提交限速、最多 2 个活跃任务。
- Dashboard 账单/视频/预览/下载/删除；后台用户、订单、账本、任务、成本、审核、补偿、暂停、人工退款/拒付对账与审计。
- Privacy、Terms、Refund、Acceptable Use、Contact & report。举报通过支持邮箱；邮箱收件能力尚待用户配置。
- GA4（`G-BC37LL57GH`）与 Microsoft Clarity（`yzjg1z6gia`）：仅生产构建且访问 `https://smalltownboyai.one` 时在页面交互就绪后加载；`npm run dev`、`npm test`、本地生产预览及其他域名不会加载监控脚本或发送数据。

## 结构与页面

| 路径                                                   | 内容                                             |
| ------------------------------------------------------ | ------------------------------------------------ |
| `app/`                                                 | 页面、SEO 与 API Route Handler                   |
| `components/`                                          | 上传生成器、账户、定价、导航、shadcn 风格 Button |
| `lib/api.ts`                                           | 认证后的业务 API 与后台动作                      |
| `lib/credits.ts` / `db/migrations/0001_invariants.sql` | 事务、账本与钱包触发器                           |
| `lib/payments.ts`                                      | Waffo checkout、验签及订单验证                   |
| `lib/providers/wavespeed.ts` / `lib/jobs.ts`           | 模型适配与后台协调                               |
| `db/schema.ts` / `db/migrations/`                      | Drizzle 模型、SQL 与迁移快照                     |
| `worker-jobs.ts`                                       | 每分钟 Cron Worker                               |
| `tests/business.test.ts`                               | Miniflare 真实本地 D1/R2 的业务测试              |
| `public/images/` / `public/fixtures/`                  | 概念图与明确标注的测试视频                       |

公开页面：`/`、`/pricing`、`/privacy`、`/terms`、`/refund-policy`、`/acceptable-use`、`/contact`。
账户页面：`/login`、`/dashboard`、`/dashboard/videos`、`/dashboard/billing`、`/checkout`、`/admin`。
支付通知：`POST /api/webhooks/waffo`。私有对象只经 `/api/media/:id` 和 `/api/tasks/:id/video` 返回。

## 验证命令

```sh
npm run check
npm test
npx vinext check
npm run build
npx wrangler deploy --config dist/server/wrangler.json --dry-run
npx wrangler deploy --config wrangler.jobs.jsonc --dry-run
```

本地测试使用 Mock 外部服务，不产生收费。`npm run db:generate` 检查 Drizzle 差异；自定义触发器在独立 SQL 迁移中，勿用 `drizzle-kit push` 绕过迁移。Wrangler 按 SQL 文件应用，Drizzle journal 管理生成部分，两者都必须保留。

详见 [配置与部署](docs/deployment.md)、[需求纠错](docs/requirements-review.md)、[验证记录](docs/verification.md)、[视觉验收](design-qa.md)。项目目前没有 `llms.txt`；已核对，没有创建或宣称未实现的功能。
