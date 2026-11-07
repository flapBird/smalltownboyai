# Google 登录配置：Better Auth + Cloudflare D1

本项目由 `lib/auth.ts` 中的 Better Auth 处理 Google 授权、回调和会话，用户/账户/会话写入 D1。无需 Supabase 项目或 Supabase 回调 URL。

## 1. Google Auth Platform

在当前 Google Cloud 项目 `smalltownboyai` 中，进入 **Google Auth Platform → 客户端 → 创建客户端**。

| 字段                           | 正式站填写值                                          |
| ------------------------------ | ----------------------------------------------------- |
| 应用类型                       | Web 应用                                              |
| 名称                           | Smalltown Boy AI                                      |
| 已授权的 JavaScript 来源       | `https://smalltownboyai.one`                          |
| 已授权的重定向 URI             | `https://smalltownboyai.one/api/auth/callback/google` |
| 将此客户端用于 AI 赋能的智能体 | 不勾选，本客户端仅用于用户 Google 登录                |

来源只填写协议和域名；重定向 URI 必须完整填写路径。本站使用不带 `www` 的正式域名。创建后及时保存 Client ID / Client Secret，Secret 不发到聊天、不放进 Git，也不要使用 `NEXT_PUBLIC_*`。

## 2. 品牌塑造、目标对象与数据访问

- **品牌塑造**：应用名称 `Smalltown Boy AI`；用户支持邮箱和开发者联系邮箱选你可以实际收件的地址。首页填 `https://smalltownboyai.one`，隐私政策填 `https://smalltownboyai.one/privacy`，服务条款填 `https://smalltownboyai.one/terms`，已授权网域填 `smalltownboyai.one`（不带协议和路径）。这些页面需要在正式域名上实际可访问。
- **目标对象**：面向普通用户选择 External/外部。先保持测试状态，在测试用户名单加入你用于验收的 Google 账户；验证完成后再按 Google 控制台要求发布应用。
- **数据访问**：本站只需要基本登录资料：`openid`、`https://www.googleapis.com/auth/userinfo.email`、`https://www.googleapis.com/auth/userinfo.profile`。不需要 Gmail、Drive 等额外权限。Better Auth 的 Google provider 会请求基本登录 scope。

## 3. 本地验证（可选）

在同一客户端中额外添加，或使用独立开发客户端：

- JavaScript 来源：`http://localhost:3000`
- 重定向 URI：`http://localhost:3000/api/auth/callback/google`

编辑已被 Git 忽略的 `.dev.vars`，保留其他已有配置：

```dotenv
APP_ORIGIN=http://localhost:3000
APP_MODE=production
GOOGLE_CLIENT_ID=你的客户端ID
GOOGLE_CLIENT_SECRET=你的客户端密钥
BETTER_AUTH_SECRET=独立生成的随机密钥
GENERATION_ENABLED=false
PAYMENTS_ENABLED=false
```

用 `openssl rand -hex 32` 生成随机密钥，将输出保存在 `BETTER_AUTH_SECRET`，不要发送到聊天。生产环境使用另一份随机密钥，并长期保存。配置后重启本地服务，用 **http://localhost:3000/login** 打开，不要混用 `127.0.0.1`。这里的 `APP_MODE=production` 用于关掉本地模拟账户，便于核验真实 Google 流程；Wrangler/Vite 的本地模式仍使用本地 D1/R2，未指定远程资源时不会变成线上数据库。

## 4. Cloudflare 正式配置

在 **Workers & Pages → smalltownboyai → Settings** 配置：

1. Domains & Routes 添加自定义域名 `smalltownboyai.one`，确认 HTTPS 可访问。
2. Variables and Secrets 中添加 Secret：`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`BETTER_AUTH_SECRET`。这些只需要配置到 Web Worker，Jobs Worker 不需要 Google 凭据。
3. 普通变量 `APP_ORIGIN=https://smalltownboyai.one`、`APP_MODE=production`。真实生成和支付可继续保持关闭，Google 登录不依赖它们。
4. 发布正确代码并确认必要 D1 迁移已应用；设置 Secrets / 发布会影响运行版本，按部署流程执行。配置成功后 `/api/config` 中 `google` 应为 `true`，接口不会返回凭据。

2026-11-07 本轮只读检查：Web Worker 尚无 Secrets，本地三个登录凭据也为空；账户的 Worker 自定义域名列表中没有 `smalltownboyai.one`。本轮没有创建 Google 客户端、上传凭据或绑定域名。

## 5. 验收与排错

- 点击 Continue with Google → Google 账号选择/同意页面 → 回到本站 → 导航显示账户/积分 → 新账户钱包为零 → 刷新仍登录 → 退出成功。
- 从创建页登录前选好模板、画质和照片，回跳后应恢复草稿；图片仅保存在当前浏览器草稿中。
- 取消授权应返回登录页并显示可重试提示，不应卡在无说明的空白页。
- `redirect_uri_mismatch`：对比 Google 配置与授权 URL 的 `redirect_uri`，包括协议、域名、端口和完整路径。
- `invalid_client`：检查 ID/Secret 是否来自同一个 Web 客户端、是否填错或过期。
- 仍显示未开放：检查三个凭据是否都已填，是否放在 Web Worker，是否发布了对应配置。本站现在统一检查三项，缺一时不会让登录接口抛出未解释的 500。
- 回调后未登录：检查 Cookie、`APP_ORIGIN` 与访问域名是否一致，以及 D1 迁移/会话写入日志。不要把授权 code、state、token 或 Secret 发到公共日志。

本地回归已验证 Better Auth 生成 Google 授权 URL、正确回调 URI 和取消授权回跳；使用的是虚拟凭据，没有代表真实账户完成 Google 授权。完整真实登录必须在你创建客户端并配置凭据后验收。

参考：[Better Auth Google](https://better-auth.com/docs/authentication/google)、[Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)、[Google 品牌/目标对象/Scope 配置](https://developers.google.com/workspace/guides/configure-oauth-consent)。
