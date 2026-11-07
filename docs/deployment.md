# 配置与部署

2026-11-06 的远程检查已确认 Web / Jobs Worker、共享 D1、私有 R2 与 Cron 配置存在，但真实业务尚未验收。默认真实收款与生成均关闭。

2026-11-07：本地已接入 **MiniMax H3 Video Edit、14 秒、两个可选模板、480p / 768p / 1080p**，尚未发布本轮改动或进行真实付费生成。不能把本地测试视为模型效果验收。

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

在 Waffo 创建三个一次性 USD 商品，价格为 4.90 / 12.90 / 24.90；对应积分为 100 / 300 / 600；商品 metadata 分别设置 `packageId=lite|standard|pro`。服务端订单 metadata 包含 `productId` 和 `packageId`。Webhook URL：`https://smalltownboyai.one/api/webhooks/waffo`，签名头 `x-waffo-signature`。

新价格上线前，在 Waffo 创建对应的新商品或核对商品价格，并更新三个 `WAFFO_PRODUCT_*`，不要继续使用旧金额商品。现有订单按创建时保存的金额/积分核验，迁移不会改旧订单或用户余额。定价依据见 [成本与定价](pricing.md)。

**Checkout 环境由 API 凭据决定**，本项目的 `WAFFO_ENVIRONMENT` 用于 webhook 模式检查与验签，不会把生产 key 自动变成测试 key。必须从商户后台确认 key 类型、商品及实际 checkout 环境后才启用。真实收款另需 `MERCHANT_APPROVED=true` 与 `WAFFO_ENVIRONMENT=prod`，只能在商户审核通过后设置。

支持 `order.completed`、`refund.succeeded`、`refund.failed`。按税前商品价、税款及实收总额核对。自动处理全额退款；部分退款与拒付由后台 `reverse-order` 人工核对，**该动作仅同步本站账本，不向支付商发起退款**，只能在外部已经确认全额撤销后执行并记录依据。官方没有明确的拒付 webhook 时不编造事件名。

参考：https://github.com/waffo-com/waffo-pancake-sdk-ts 、https://docs.waffo.ai/

## 最新执行清单

### 已完成的代码与素材核对

- R2 `smalltownboyai-private` 中已存在 `templates/living-room-14s.mp4` 和 `templates/red-fence-14s.mp4`。2026-11-07 读取 MP4 元数据，两段均为 14 秒且有音轨；客厅显示尺寸 540×960，红围栏约 539.5×960。未据此判定动作质量、配乐许可或生成效果合格。
- `lib/templates.ts` 定义两套模板、版本及核对时的 ETag。首页可选择模板，默认选中一个，登录回跳保留选择；任务与历史记录模板 ID / 版本。每次生成只使用选定的一套模板和两张图片。
- 服务端只接受白名单模板 ID。`/api/templates/:id/source` 使用限定模板、版本、ETag 与 30 分钟期限的签名；提交前核对源对象 ETag，读取时使用 R2 条件请求防止文件被替换。旧上传照片签名不能用于模板。
- H3 请求指定 `duration:14`、`aspect_ratio:"9:16"`、两张参考图和 `generate_audio:false`，保留模板音轨。静音模板不会自动获得歌曲。中档使用用户确认的 **768p**，不假标 720p；不提供 540p 档。
- 新任务冻结 100 / 200 / 400 积分，分别按 144 / 284 / 564 美分估算基础模型成本；套餐与费用说明已同步，旧订单仍保留原金额和积分。
- 新迁移 `0002_concerned_lightspeed.sql` 为任务增加可空的模板 ID / 版本，并更新套餐目录；保留历史 Seedance 任务、订单、余额和账本。远程数据库尚未执行该迁移。

### 仍需执行

1. 核对两段素材的动作完整性、角色位置、音画同步及画面/配乐使用权限。源素材约 540p；高分辨率输出的细节和身份一致性必须实测，不能凭请求参数判断。
2. 用 5 秒裁剪片 + 两张宠物图先测 H3 480p，再逐一测试两套 14 秒模板和准备开放的画质。记录实际账单、失败收费、耗时、尺寸、双角色稳定性与声音。测试会消耗 WaveSpeed 额度。
3. 按下节配置凭据与开关；在受控测试环境开放已验证模板/画质，跑通登录 → 选模板 → 上传 → 输入审核 → 生成 → Jobs 回收 → 私有 R2 → 输出审核 → 下载/历史/账本。验证失败释放、unknown 人工处理、签名到期、未验证模板和重复提交。
4. 应用远程迁移后发布 Web / Jobs；配置正式域名、Google OAuth、管理员、支持邮箱、运营主体和政策，检查 Cron 实际执行及输出域名白名单。
5. 完成 Waffo sandbox 付款、重发、退款与正式商户配置，确认新商品金额，再开放收款。使用审核通过的真实成片替换首页概念图，示例放 `examples/` 并单独提供受控公开读取；用户上传和私人结果保持私有。
6. 默认有声已由模板音轨保留实现；**无声文件下载和后期配乐尚未实现**，播放器静音不会改变下载的文件。若需要额外无声导出，另行实现处理链路。

## WaveSpeed 与参考视频配置

Web Worker 需要 `WAVESPEED_API_KEY`、`MEDIA_SIGNING_SECRET`，不再读取 `REFERENCE_VIDEO_URL`。R2 保持私有，不开启整个桶的公开访问。

- `REFERENCE_LICENSE_CONFIRMED=true`：在确认两套白名单模板的画面与配乐可使用后设置。**此配置也会开放两套模板的 `/api/templates/:id/preview` 预览接口**，只返回白名单源片，不允许任意 R2 对象键。未确认时前端显示预览待开放；本地 Mock 使用明确标注的 3 秒测试动画。
- `VERIFIED_TEMPLATES=living-room,red-fence`：只填已通过真实测试的模板 ID，可先仅启用一套。任务提交、签名源访问均检查该白名单。修改模板文件会导致 ETag 不匹配并阻止使用；换素材应使用新对象键、更新模板版本及 ETag、重新验证，不要覆盖已发布版本。
- `VERIFIED_RESOLUTIONS=480p,768p,1080p`：只填已验证规格，旧值 `720p` 会被忽略。支持能力不代表三档都已通过测试。
- `GENERATION_ENABLED=true`：只有凭据、许可、模板和画质配置齐全才可提交真实请求；本轮保持关闭。供应商必须能通过站点域名访问短期签名链接，Cloudflare 后台地址不能当作视频 URL。实测排队取件时间应在签名期限内。

Jobs Worker 也必须设置 `WAVESPEED_API_KEY`；`OUTPUT_HOSTS` 填供应商实测返回的精确 HTTPS CDN 主机名（逗号分隔，无通配符），拒绝重定向下载，最大 50 MiB。Web Worker 的可选同名配置不会替代 Jobs 配置。

先审核输入，再提交；输出复制到 R2 后进入 `review`，管理员检查真实尺寸、时长、角色映射、内容与音轨，记录实际成本及输出秒数，再批准交付。官方参数依据：[MiniMax H3 Video Edit](https://wavespeed.ai/models/wavespeed-ai/minimax-h3/video-edit)（2026-11-07 核对）。

## 异常恢复与保留

- 提交请求最多等待 25 秒；不确定是否被供应商接受时状态为 `unknown`，保留冻结积分，禁止自动重发收费提交。人工去供应商核实、记录任务或账单证据后处理。
- 未开始提交的 `queued` 超过 2 分钟释放冻结。`submitting` 超过 2 分钟转 unknown。处理中的任务超过 24 小时且尚无终态，转 unknown。查询失败可重试，提交不自动重试。
- 结果先进入私有 R2 和人工审核；用户完成前不能访问。失败释放积分不代表供应商一定没有计费，实际费用须对账录入。
- 用户删除完成/失败视频会删除 R2 输出，并保留任务 tombstone 与资金账本来阻止请求重放。未被未删除任务引用且超过 24 小时的图片由 Cron 清理；活跃历史所引用的输入保留用于追溯。账户数据删除请求通过支持邮箱人工处理；暂不提供自助删号。
- `release-unknown` 只在确认不应交付后释放，不会自动追回供应商费用。管理员补偿与暂停动作需填写原因，保留审计。

## 开放真实服务前仍需验证

Google 回调；Waffo sandbox 完整付款、重发、乱序、退款；迁移后 WaveSpeed H3 已选规格与两个模板的完整 14 秒、身份与动作、耗时、实际费用和失败收费；远程 D1/R2 权限；Cron 实际执行与输出 CDN；邮箱真实可达；合法运营主体、政策文本和商户批准。当前法律页面明确处于预览状态，没有编造公司名称和地址。

若 14 秒规格的真实费用不合适，保持关闭并报告，不能擅自改套餐、重复短片或伪造分辨率。模型和商户文档可更新，上线时须重新核对。
