# 配置与部署

2026-11-06 的远程检查已确认 Web / Jobs Worker、共享 D1、私有 R2 与 Cron 配置存在，但真实业务尚未验收。默认真实收款与生成均关闭。

2026-11-07 更新执行方案：目标为 **MiniMax H3 Video Edit、14 秒、两个可选模板**；当前代码仍是 Seedance 2.5、21 秒和单个 `REFERENCE_VIDEO_URL`。下列待办不代表已经实现。

## Cloudflare

使用项目锁定版本的 Wrangler。当前项目复用已有资源；以下创建命令仅供全新账户初始化，不要重复执行：

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

## 最新执行清单（H3 / 14 秒，待实施）

1. **准备模板**：将客厅版、红围栏版分别整理为 14 秒、9:16 的 MP4，检查实际时长、画幅、动作完整性和音画同步。视频画面与配乐分别核对使用权限，不再要求所有模板必须去掉音轨；默认带可使用的配乐，无合适配乐时可先测试静音画面。
2. **上传私有 R2**：复用 `smalltownboyai-private`，建议对象键为 `templates/living-room-14s.mp4`、`templates/red-fence-14s.mp4`。上传后记录对象键、时长和音轨信息。保留桶私有，不开启整个桶的公开访问。原始模板与首页成片示例分开，审核通过的示例建议放 `examples/`。
3. **实现模板配置与访问**：建立服务端模板白名单，包含稳定 ID、名称、R2 对象键、时长、角色位置说明、预览资源和启用状态。为供应商生成有足够取件时间的短期 HTTPS 签名链接，并验证到期失效；Cloudflare 控制台链接、R2 对象键都不能直接用作模型输入 URL。现有上传图片的签名接口不会自动公开任意模板对象。
4. **实现用户选择**：两张模板预览卡默认选中一个，用户可切换，无需额外确认步骤；只有一个合格模板时先固定使用该模板。流程为“确认模板 → 上传角色 A / B 图片 → 选择已验证画质 → 生成”。预览标明两个角色的位置；前端只传模板 ID，服务端校验启用状态并解析素材。任务保存模板 ID / 版本，审核提交及历史结果应对应同一模板。当前前后端均未实现模板选择。
5. **迁移模型与规格**：接入 `wavespeed-ai/minimax-h3/video-edit`，同步请求参数、角色提示词、14 秒时长、费用计算、任务记录、规格校验、积分/套餐展示、FAQ 和测试。H3 支持 480p / 540p / 768p / 1080p，不能沿用 720p；初测用 480p，其他规格通过实测后再开放。不要仅改模型 URL 就启用真实服务。
6. **落实声音方案**：优先用已配好可使用音轨的模板，设置 `generate_audio:false` 保留其音轨，并实测同步情况。静音模板不会因此获得歌曲。默认有声、可下载无声版本是建议的产品方案，无声导出/后期配乐尚未实现，需另行完成处理和下载链路；播放器静音不等于下载无声文件。
7. **先做小额模型测试**：先用截取的 5 秒模板与两张宠物图在 480p 测试，再测完整 14 秒；逐一验证两种模板的角色一致性、动作、镜头、时长、声音、耗时和实际账单。测试实际调用会消耗供应商额度。每个模板合格后才对用户启用；一次任务只提交所选的一个模板和两张图，不需要把两个模板各生成一次。
8. **配置并跑通站内流程**：配置正式域名、Google OAuth、管理员与测试积分、两个 Worker 的 WaveSpeed 密钥、媒体签名密钥及 Jobs 输出域名白名单；在受控测试环境启用已验证规格，跑通登录 → 选模板 → 上传 → 输入审核 → 生成 → Jobs 回收 → 私有 R2 → 输出审核 → 预览/下载与账本。验证失败释放、unknown 人工处理、过期链接和重复操作。开发环境与生产配置分开。
9. **准备上线**：用审核通过的真实成片替换首页概念示例，通过受控公开接口提供示例/模板预览；不公开用户原图和私人结果。完成 Waffo sandbox 付款、重发、退款与正式商户配置，以及支持邮箱、运营信息和政策。检查构建与测试，发布 Web / Jobs，验证域名、远程资源、Cron 实际执行、下载和监控，再开放真实生成及收款。

## WaveSpeed 与参考视频配置

Web Worker 需要 `WAVESPEED_API_KEY` 和 `MEDIA_SIGNING_SECRET`。当前代码还依赖单个 `REFERENCE_VIDEO_URL`；多模板迁移完成后，应由服务端依据所选模板生成签名 URL，并同步更新环境检查，不能把多个地址填进这个变量。配置 `REFERENCE_LICENSE_CONFIRMED=true` 前核对已启用模板的画面与音轨使用权限。

Jobs Worker 也必须设置 `WAVESPEED_API_KEY`；`OUTPUT_HOSTS` 填供应商实测返回的精确 HTTPS CDN 主机名（逗号分隔，无通配符），拒绝重定向下载，最大 50 MiB。不要猜测主机名。Web Worker 的可选同名配置不会替代 Jobs 配置。

完成 H3 迁移及各规格的 14 秒输出验证后，才将规格加入 `VERIFIED_RESOLUTIONS` 并设置 `GENERATION_ENABLED=true`。先审核输入，再提交；输出复制到 R2 后进入 `review`，管理员检查真实尺寸、时长、角色映射、内容与音轨，记录实际成本及输出秒数，再批准交付。

H3 的 `generate_audio:false` 保留输入音轨；输出支持 3–15 秒。官方说明：[MiniMax H3 Video Edit](https://wavespeed.ai/models/wavespeed-ai/minimax-h3/video-edit)（2026-11-07 核对）。这些能力说明不代替本站真实调用验收。

## 异常恢复与保留

- 提交请求最多等待 25 秒；不确定是否被供应商接受时状态为 `unknown`，保留冻结积分，禁止自动重发收费提交。人工去供应商核实、记录任务或账单证据后处理。
- 未开始提交的 `queued` 超过 2 分钟释放冻结。`submitting` 超过 2 分钟转 unknown。处理中的任务超过 24 小时且尚无终态，转 unknown。查询失败可重试，提交不自动重试。
- 结果先进入私有 R2 和人工审核；用户完成前不能访问。失败释放积分不代表供应商一定没有计费，实际费用须对账录入。
- 用户删除完成/失败视频会删除 R2 输出，并保留任务 tombstone 与资金账本来阻止请求重放。未被未删除任务引用且超过 24 小时的图片由 Cron 清理；活跃历史所引用的输入保留用于追溯。账户数据删除请求通过支持邮箱人工处理；暂不提供自助删号。
- `release-unknown` 只在确认不应交付后释放，不会自动追回供应商费用。管理员补偿与暂停动作需填写原因，保留审计。

## 开放真实服务前仍需验证

Google 回调；Waffo sandbox 完整付款、重发、乱序、退款；迁移后 WaveSpeed H3 已选规格与两个模板的完整 14 秒、身份与动作、耗时、实际费用和失败收费；远程 D1/R2 权限；Cron 实际执行与输出 CDN；邮箱真实可达；合法运营主体、政策文本和商户批准。当前法律页面明确处于预览状态，没有编造公司名称和地址。

若 14 秒规格的真实费用不合适，保持关闭并报告，不能擅自改套餐、重复短片或伪造分辨率。模型和商户文档可更新，上线时须重新核对。
