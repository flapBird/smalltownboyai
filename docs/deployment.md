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

逐字段填写值、本地配置与排错见 [Google OAuth 配置指南](google-oauth.md)。本站使用 Better Auth + D1，无需 Supabase。2026-11-07 只读检查发现 Web Worker 尚无登录 Secrets，正式域名尚未绑定到 Worker；真实登录仍未验收。

1. 在 Google Cloud 建 OAuth Web application，配置同意屏幕与测试用户。
2. Authorized JavaScript origin 为站点 origin；redirect URI 为 `https://smalltownboyai.one/api/auth/callback/google`。本地联调需另加与 `APP_ORIGIN` 完全一致的回调。
3. Web Worker 设置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 和强随机 `BETTER_AUTH_SECRET`。开发时放 `.dev.vars`，线上用 `wrangler secret put`，不要写前端环境变量。
4. 验证首次用户钱包为零、cookie、回跳、重新登录与登出。生产管理员由运维通过 D1 将已验证用户的 `user.role` 改为 `admin`，不开放自助提权。

官方参考：https://www.better-auth.com/docs/authentication/google 、https://www.better-auth.com/docs/adapters/drizzle

## Waffo Pancake

Web Worker 需要 `WAFFO_MERCHANT_ID`、`WAFFO_PRIVATE_KEY`、`WAFFO_PRODUCT_LITE`、`WAFFO_PRODUCT_STANDARD`、`WAFFO_PRODUCT_PRO`。先用测试环境 API 凭据，`WAFFO_ENVIRONMENT=test`，设置 `PAYMENTS_ENABLED=true` 才允许真实 SDK 测试 checkout。

在 Waffo 创建三个一次性 USD 商品，价格为 8.90 / 19.90 / 39.90；对应积分为 100 / 300 / 600；商品 metadata 分别设置 `packageId=lite|standard|pro`。服务端订单 metadata 包含 `productId` 和 `packageId`。Webhook URL：`https://smalltownboyai.one/api/webhooks/waffo`，签名头 `x-waffo-signature`。

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
5. 完成 Waffo sandbox 付款、重发、退款与正式商户配置，确认新商品金额，再开放收款。首页现为明确标注的源模板视频预览；后续用审核通过的真实成片补充生成样例，示例放 `examples/` 并单独提供受控公开读取；用户上传和私人结果保持私有。
6. 默认有声已由模板音轨保留实现；**无声文件下载和后期配乐尚未实现**，播放器静音不会改变下载的文件。若需要额外无声导出，另行实现处理链路。

## WaveSpeed 与参考视频配置

Web Worker 需要 `WAVESPEED_API_KEY`、`MEDIA_SIGNING_SECRET`，不再读取 `REFERENCE_VIDEO_URL`。R2 保持私有，不开启整个桶的公开访问。

- `TEMPLATE_PREVIEWS_ENABLED=true`：发布两套已选定模板的首页/选择器预览，仓库 Web Worker 配置已开启；只开放白名单 `/api/templates/:id/preview`，仍验证 ETag，不开放任意 R2 键、用户上传或私人成片。与付费生成开关独立。
- `REFERENCE_LICENSE_CONFIRMED=true`：在确认模板可用于真实生成后设置，仍是付费生成的必要条件；兼容旧配置，也可启用模板预览。两项均关闭时前端显示预览待开放。本地 Mock 有 ETag 匹配的模板时预览源片，否则播放明确标注的测试动画。
- `VERIFIED_TEMPLATES=living-room,red-fence`：只填已通过真实测试的模板 ID，可先仅启用一套。任务提交、签名源访问均检查该白名单。修改模板文件会导致 ETag 不匹配并阻止使用；换素材应使用新对象键、更新模板版本及 ETag、重新验证，不要覆盖已发布版本。
- `VERIFIED_RESOLUTIONS=480p,768p,1080p`：只填已验证规格，旧值 `720p` 会被忽略。支持能力不代表三档都已通过测试。
- `GENERATION_ENABLED=true`：只有凭据、许可、模板和画质配置齐全才可提交真实请求；本轮保持关闭。供应商必须能通过站点域名访问短期签名链接，Cloudflare 后台地址不能当作视频 URL。实测排队取件时间应在签名期限内。

Jobs Worker 也必须设置 `WAVESPEED_API_KEY`；`OUTPUT_HOSTS` 填供应商实测返回的精确 HTTPS CDN 主机名（逗号分隔，无通配符），拒绝重定向下载，最大 50 MiB。Web Worker 的可选同名配置不会替代 Jobs 配置。

输入自动检测通过后提交；输出复制到 R2 后进入 `review` 等待自动检测，Jobs 在检测通过后自动交付并幂等结算。被拦截或无法完成检测的成片继续保持私有，支持管理员处理异常和申诉。模板上线验收仍需检查尺寸、时长、角色映射与音轨。官方参数依据：[MiniMax H3 Video Edit](https://wavespeed.ai/models/wavespeed-ai/minimax-h3/video-edit)（2026-11-07 核对）。

## 异常恢复与保留

- 提交请求最多等待 25 秒；不确定是否被供应商接受时状态为 `unknown`，保留冻结积分，禁止自动重发收费提交。人工去供应商核实、记录任务或账单证据后处理。
- 未开始提交的 `queued` 超过 2 分钟释放冻结。`submitting` 超过 2 分钟转 unknown。处理中的任务超过 24 小时且尚无终态，转 unknown。查询失败可重试，提交不自动重试。
- 结果先进入私有 R2 和自动检测；用户完成前不能访问。失败释放积分不代表供应商一定没有计费，实际费用须对账录入。
- 用户删除完成/失败视频会删除 R2 输出，并保留任务 tombstone 与资金账本来阻止请求重放。未被未删除任务引用且超过 24 小时的图片由 Cron 清理；活跃历史所引用的输入保留用于追溯。账户数据删除请求通过支持邮箱人工处理；暂不提供自助删号。
- `release-unknown` 只在确认不应交付后释放，不会自动追回供应商费用。管理员补偿与暂停动作需填写原因，保留审计。

## 开放真实服务前仍需验证

Google 回调；Waffo sandbox 完整付款、重发、乱序、退款；迁移后 WaveSpeed H3 已选规格与两个模板的完整 14 秒、身份与动作、耗时、实际费用和失败收费；远程 D1/R2 权限；Cron 实际执行与输出 CDN；邮箱真实可达；合法运营主体、政策文本和商户批准。当前法律页面明确处于预览状态，没有编造公司名称和地址。

若 14 秒规格的真实费用不合适，保持关闭并报告，不能擅自改套餐、重复短片或伪造分辨率。模型和商户文档可更新，上线时须重新核对。

## SeeAPI 内容检测与新价格（2026-11-08）

1. 发布代码前先对 D1 应用 `0003`（检测记录、890/1990/3990 美分套餐价格）及 `0004`（索引）迁移；已有订单金额、积分和余额不变。先在测试环境验证，生产迁移需要单独执行。
2. 网页 Worker `smalltownboyai` 与定时任务 Worker `smalltownboyai-jobs` 均设置 Secret `SEEAPI_API_KEY`，并配置相同的 `MEDIA_SIGNING_SECRET`。两者 `APP_ORIGIN=https://smalltownboyai.one`，连接同一 D1/R2。密钥只保存在服务端。
3. SeeAPI 控制台单独设置该 Key 的每日额度上限。应用 `SEEAPI_DAILY_CHECK_LIMIT` 默认 100 个新检测/UTC 日（最大 1000）；每账户每日最多 30 个、同时最多 4 个待检测项。次数上限不是固定金额上限。确认 SeeAPI 当前单价与实际 `consumed_credits`，检测费用不包含在 H3 模型成本估算中。
4. 部署网页及 jobs Worker，确认每分钟 cron 正常执行。现有 `GENERATION_ENABLED`、模型/模板验证、授权确认、输入与成片自动检测仍需通过；缺失检测密钥不会绕过检测。
5. 新输入检测只接受 JPG/PNG ≤8 MiB、每边256–4096、总像素至少78,400。视频为可解析 MP4 ≤30秒、≤50 MiB。先核对余额/权限/素材限制，再检查实际提示词、两张图片、模板视频；全部通过才冻结积分并提交 H3。
6. 成片写入私有 R2，检查16个采样帧，再由管理员审核交付。下载同时验证当前文件 ETag 的通过记录。检测失败/超时与违规分开处理；等待/不可用时不交付、不自动重新生成。管理员可拒绝成片并走现有幂等积分解冻，不能绕过检测批准。
7. 持久化记录保存原始请求正文、幂等键和供应商ID，最多12次尝试/20分钟。丢失POST响应重放相同正文和键，已知ID只查询。不可用的终态交由运维核对供应商ID；不要删除记录或换键盲目重试。若需重试策略/模型变更，先查清旧任务结算，再显式升级策略版本。
8. Waffo 需创建/核对 $8.90、$19.90、$39.90 的一次性USD商品，更新对应 `WAFFO_PRODUCT_*`。测试环境验证金额匹配、重复回调、到账及退款后再启用支付。本站代码改价不会自动修改 Waffo 后台商品。

生成页和隐私政策披露 SeeAPI 的处理。视频检查只覆盖抽帧画面，不覆盖音轨或所有帧；异常和申诉保留人工处理。SeeAPI 文件与检测记录没有计划自动到期，删除源链接不删除其副本，应携任务ID联系支持处理删除请求。参见 [数据处理说明](https://www.seeapi.com/docs/data-handling/)。本地 Mock 不调用真实检测、支付或生成服务。

## Waffo Webhook 配置与验收

- URL：`https://smalltownboyai.one/api/webhooks/waffo`，格式 **Raw**。
- 仅勾选 `order.completed`、`refund.succeeded`、`refund.failed`。本站使用一次性积分包，不需要订阅事件。
- `WAFFO_STORE_ID=STO_3Gn9gFKccKSVnOjhUU1lYW` 用于限定回调店铺。截图选择生产时，Worker 必须为 `WAFFO_ENVIRONMENT=prod`，使用对应生产凭据、已发布商品，并完成商户审核。仓库默认仍是 test；不要将测试事件和生产订单混用。
- 上线前应用 `0005_payment_webhook_guards.sql`。SDK 对原始正文执行 RSA 验签和时间戳校验；服务端核对店铺、模式、用户、订单、商品、币种及税额/实付金额。D1 事务完成后才返回200；失败不提前确认，允许供应商重投。
- 支付成功按订单快照发放一次积分并更新画质权限。相同事件重投或不同投递ID重复通知均不能重复到账。支付成功跳转页不发积分。
- 全额退款成功仅回收该订单已发放的积分一次，重新计算其他有效订单的画质权限；积分已消耗时允许余额为负并阻止继续消费，不影响正在处理任务的冻结账本。退款先到、支付后到不会补发积分。退款失败只记事件，不扣积分或降权限。
- 部分退款、缺失实付金额或金额不一致目前返回422，需人工核对退款与积分，不会当作全额退款扣完。当前自动处理范围为一次性积分包全额退款。后台人工处理后需核对回调重投结果，不能忽略失败投递。
- 控制台验收：测试付款→确认到账→重投支付通知→确认余额不变→全额退款→确认余额/权限变化→重投退款通知→确认不重复扣减。生产切换后需对生产配置单独验收；本地模拟测试不代表已收到真实生产回调。

## 管理员测试积分（无需支付）

`GENERATION_ENABLED` 是真实 H3 生成入口的总开关，与 `PAYMENTS_ENABLED` 独立。`false` 禁止新建真实生成任务，不关闭首页模板预览，不取消已经提交给供应商的任务。`true` 仍要求 WaveSpeed/SeeAPI/媒体签名密钥、模板与分辨率验证、素材授权、充足积分和画质权限、自动输入 NSFW 检测，以及后台没有暂停生成。无需为了内部测试开启支付。

1. 发布前应用 `0006_happy_dazzler.sql`，新增独立的管理员积分赠送记录。支付/退款的画质权限计算也依赖此表，须先迁移再发布。
2. 收款账号必须先登录一次。运维将可信操作员的 `user.role` 设置为 `admin`（首次管理员初始化仍需 D1）；不要直接改钱包余额。没有自助提升管理员权限的入口。
3. 管理员登录后访问 `/admin`，在 **Grant test credits** 填收款邮箱、积分数（1–10000）、最高画质和至少5字符的原因。默认600积分、最高1080p，可自行调整。600积分可用于一次1080p（400）和一次768p（200）。
4. 提交后显示实际到账、当前余额、冻结积分及记录编号。流水类型为 `admin_grant`，不创建 Waffo 订单、不伪造支付事件；操作员、对象、原因、数量和画质都有记录。相同请求键重复提交只到账一次；网络失败时在原页面以不变内容重试，不要重新填写另一笔赠送。
5. 赠送画质权限不会因其他付费订单退款而丢失，也不会因低画质赠送而降级。该赠送无现金退款价值；本入口不提供撤回赠送功能。赠送本身不调用模型或支付，真实生成/检测仍消耗供应商账户余额。
6. 测试顺序：赠送→上传双图→满足生成启用条件→提交/自动等待内容检测→H3生成→成片自动检测→自动交付与下载。此路径验证生成和账本，不代替支付成功/退款 Webhook 联调。

## Waffo 前置文字审核与后台二次认证

生成提示词改由 Waffo `contentSafety.scanPrompt` 检测，使用实际 H3_PROMPT、semantic=enforce，仅 allow 放行；未配置、异常或拒绝均不调用生成。SeeAPI 保留图片、模板和成片检测，不再发起或轮询旧文字检测。网页 Worker 需配置 WAFFO_MERCHANT_ID 与 WAFFO_PRIVATE_KEY，即使 PAYMENTS_ENABLED=false 也需要这两个值以运行文字检测。此调整不代表已完成真实接口联调。

后台需同时满足：Google 已登录、数据库 role=admin、邮箱位于 ADMIN_EMAILS（逗号分隔）、输入 ADMIN_PASSWORD。ADMIN_PASSWORD 在 Cloudflare 设置为 Secret；不写入客户端或公开变量。解锁签发绑定用户的 HttpOnly/SameSite Cookie，有效30分钟；修改密码使旧凭据失效。所有 /api/admin 路由（含视频预览）均检查认证，密码错误有每用户5次/5分钟限流。缺配置默认拒绝；不提供公共自助提权。

## 后台管理模板、画质与授权

登录并解锁 `/admin` → **Generation settings**：勾选开放画质，逐个模板确认视频及音频使用权后启用，填写修改原因并保存。设置保存到现有 D1 `settings` 表，审计记录保存操作员和配置快照，不需要新增数据库迁移。关闭模板或画质将阻止对应新任务，不取消已提交的供应商任务；停用模板也会关闭它的签名源文件访问，请在无进行中任务时操作。

第一次保存前兼容旧 `VERIFIED_TEMPLATES` / `VERIFIED_RESOLUTIONS` / `REFERENCE_LICENSE_CONFIRMED` 作为初始值；从未配置时默认全部关闭。保存后数据库配置优先，这三个 Cloudflare 变量可删除。授权按具体模板版本记录，不会自动确认新模板版本。保留 `GENERATION_ENABLED` 总开关与 `TEMPLATE_PREVIEWS_ENABLED` 首页预览开关。后台配置不会跳过密钥、素材版本、积分或内容检测校验。
