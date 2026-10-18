# 配置与部署

尚未部署；以下命令在完成账户配置后运行。默认真实收款与生成均关闭。

## Cloudflare

使用项目锁定版本的 Wrangler。创建资源：

```sh
npx wrangler login
npx wrangler d1 create smalltownboyai
npx wrangler r2 bucket create smalltownboyai-private
```

将 D1 返回的 `database_id` 同时填入 `wrangler.jsonc` 与 `wrangler.jobs.jsonc`，两个 Worker 必须连接同一 D1 和私有 R2。保留 R2 私有，不启用公开开发 URL。Web Worker 设置 `APP_ORIGIN=https://smalltownboyai.one`、`APP_MODE=production`。在 Cloudflare Workers 的 Domains & Routes 添加这个自定义域名。

```sh
npx wrangler d1 migrations apply smalltownboyai --remote
npm run deploy
npm run jobs:deploy
```

`npm run deploy` 先构建，再使用 Vinext 生成的 `dist/server/wrangler.json`，不是直接部署原始 TS 入口。Cron Worker 每分钟运行，不能只部署 Web Worker。部署前 `--dry-run` 验证打包不能替代账户上的远程验证。

## GA4 与 Microsoft Clarity

全站根布局已接入 GA4（`G-BC37LL57GH`）和 Clarity（`yzjg1z6gia`），无需额外密钥。只有 `NODE_ENV=production` 的构建会输出引导脚本，且浏览器当前 origin 必须精确等于 `https://smalltownboyai.one`，才异步加载这两个监控。外部监控脚本没有独立的 SSR script/preload 标签，域名检查在任何监控请求之前执行。

`npm run dev`、`npm test`、`npm run build` 后的本地 `npm run preview`、localhost/IPv4/IPv6/局域网地址及其他预览域名均不会触发监控。正式域名下的测试流量会正常统计；本地联调保持使用本地地址。更换正式域名时须同步修改 `lib/analytics.ts` 的 origin 白名单、对应测试和隐私页说明。

## Google OAuth / Better Auth

1. 在 Google Cloud 建 OAuth Web application，配置同意屏幕与测试用户。
2. Authorized JavaScript origin 为站点 origin；redirect URI 为 `https://smalltownboyai.one/api/auth/callback/google`。本地联调需另加与 `APP_ORIGIN` 完全一致的回调。
3. Web Worker 设置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 和强随机 `BETTER_AUTH_SECRET`。开发时放 `.dev.vars`，线上用 `wrangler secret put`，不要写前端环境变量。
4. 验证首次用户钱包为零、cookie、回跳、重新登录与登出。生产管理员由运维通过 D1 将已验证用户的 `user.role` 改为 `admin`，不开放自助提权。

官方参考：https://www.better-auth.com/docs/authentication/google 、https://www.better-auth.com/docs/adapters/drizzle

## Waffo Pancake

Web Worker 需要 `WAFFO_MERCHANT_ID`、`WAFFO_PRIVATE_KEY`、`WAFFO_PRODUCT_LITE`、`WAFFO_PRODUCT_STANDARD`、`WAFFO_PRODUCT_PRO`。先用测试环境 API 凭据，`WAFFO_ENVIRONMENT=test`，设置 `PAYMENTS_ENABLED=true` 才允许真实 SDK 测试 checkout。

在 Waffo 创建三个一次性 USD 商品，价格为 8.90 / 16.90 / 49.90；商品 metadata 分别设置 `packageId=lite|standard|pro`。服务端订单 metadata 包含 `productId` 和 `packageId`。Webhook URL：`https://smalltownboyai.one/api/webhooks/waffo`，签名头 `x-waffo-signature`。

**Checkout 环境由 API 凭据决定**，本项目的 `WAFFO_ENVIRONMENT` 用于 webhook 模式检查与验签，不会把生产 key 自动变成测试 key。必须从商户后台确认 key 类型、商品及实际 checkout 环境后才启用。真实收款另需 `MERCHANT_APPROVED=true` 与 `WAFFO_ENVIRONMENT=prod`，只能在商户审核通过后设置。

支持 `order.completed`、`refund.succeeded`、`refund.failed`。按税前商品价、税款及实收总额核对。自动处理全额退款；部分退款与拒付由后台 `reverse-order` 人工核对，**该动作仅同步本站账本，不向支付商发起退款**，只能在外部已经确认全额撤销后执行并记录依据。官方没有明确的拒付 webhook 时不编造事件名。

参考：https://github.com/waffo-com/waffo-pancake-sdk-ts 、https://docs.waffo.ai/

## WaveSpeed 与参考视频

Web Worker 设置 `WAVESPEED_API_KEY`、`MEDIA_SIGNING_SECRET`、`REFERENCE_VIDEO_URL`。参考视频必须为有权使用的 **21 秒、9:16、已移除音轨的 MP4**；可存私有 R2 并提供有时限、供应商可访问的 HTTPS URL。配置 `REFERENCE_LICENSE_CONFIRMED=true` 前核对许可和音轨。

Jobs Worker 也必须设置 `WAVESPEED_API_KEY`；`OUTPUT_HOSTS` 填供应商实测返回的精确 HTTPS CDN 主机名（逗号分隔，无通配符），拒绝重定向下载，最大 50 MiB。不要猜测主机名。Web Worker 的可选同名配置不会替代 Jobs 配置。

每种分辨率分别完成 21 秒输出验证后，才加入 `VERIFIED_RESOLUTIONS`（如 `480p,720p`）并设置 `GENERATION_ENABLED=true`。未验证选项前后端均不能用于真实任务。先审核输入，再提交；输出复制到 R2 后进入 `review`，管理员检查真实尺寸、时长、角色映射、内容与音轨，记录实际成本及输出秒数，再批准交付。

`generate_audio:false` 保留参考视频原音轨，不等于静音；本项目因此要求静音参考素材。纯文字 prompt 也不能代替音轨移除。参考：https://wavespeed.ai/models/bytedance/seedance-2.5/video-edit

## 异常恢复与保留

- 提交请求最多等待 25 秒；不确定是否被供应商接受时状态为 `unknown`，保留冻结积分，禁止自动重发收费提交。人工去供应商核实、记录任务或账单证据后处理。
- 未开始提交的 `queued` 超过 2 分钟释放冻结。`submitting` 超过 2 分钟转 unknown。处理中的任务超过 24 小时且尚无终态，转 unknown。查询失败可重试，提交不自动重试。
- 结果先进入私有 R2 和人工审核；用户完成前不能访问。失败释放积分不代表供应商一定没有计费，实际费用须对账录入。
- 用户删除完成/失败视频会删除 R2 输出，并保留任务 tombstone 与资金账本来阻止请求重放。未被未删除任务引用且超过 24 小时的图片由 Cron 清理；活跃历史所引用的输入保留用于追溯。账户数据删除请求通过支持邮箱人工处理；暂不提供自助删号。
- `release-unknown` 只在确认不应交付后释放，不会自动追回供应商费用。管理员补偿与暂停动作需填写原因，保留审计。

## 开放真实服务前仍需验证

Google 回调；Waffo sandbox 完整付款、重发、乱序、退款；WaveSpeed 三种规格的完整 21 秒、身份与动作、耗时、实际费用和失败收费；远程 D1/R2 权限；Cron 实际执行与输出 CDN；邮箱真实可达；合法运营主体、政策文本和商户批准。当前法律页面明确处于预览状态，没有编造公司名称和地址。

若 21 秒规格的真实费用不合适，保持关闭并报告，不能擅自改套餐、重复短片或伪造分辨率。模型和商户文档可更新，上线时须重新核对。
