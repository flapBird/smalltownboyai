# 本地验收记录

验收日期：2026-10-18（Asia/Shanghai）。范围：本地工程与 Mock，不是生产上线验收。

## 已执行并通过

- TypeScript：`npm run check`。
- `npm test`：31 项通过；Miniflare 实际本地 D1/R2。覆盖并发防超支、幂等冻结/消费/失败释放、等级校验、图片所有权/审核、同时任务限制、支付重复/乱序/退款/降级规则、官方 SDK RSA 验签/篡改/过期、商品金额环境、provider 请求映射、登录权限、CSRF、文件头、签名过期、删除后重放、队列超时竞态、unknown 冻结保护、MP4 文件下载与后台补偿审计。
- `npx vinext check`：12 supported、0 partial、0 issues，100% compatibility report；这是工具静态检查，不替代真实 OAuth/支付端到端验证。
- `npm run db:generate`：15 表，No schema changes；本地迁移已应用、Mock R2 fixture 已写入。
- `npm run build`：Cloudflare workerd SSR/RSC 与客户端构建成功。
- Web Worker 和 Jobs Worker `wrangler deploy --dry-run`：均成功，没有执行发布。
- HTTP `/robots.txt` 与 `/sitemap.xml`：均返回 200，域名正确，账户/API 路径不列入 sitemap；私有页面设置 noindex。
- 浏览器：从测试登录、充值、上传到任务完成、账本、历史、下载和退出。真实下载文件经 ffprobe 检查为 H.264 / 480 × 854 / 3.000 秒，只有视频流，无音乐轨道。
- 设计稿联合图对比、桌面和 390 px 移动端截图；菜单与 FAQ 交互验证。见根目录 `design-qa.md` 与 `docs/screenshots/`。

## 验收发现并修复

- Vinext 在 Route Handler 前对 multipart 施加默认 1 MiB 限制：调整 framework envelope 为 9 MiB，同时保留服务端 8 MiB 限制，浏览器复测两张约 2 MiB 的图片上传成功。
- R2 返回完整 object 时也可能含 range 元信息：仅请求确有 Range header 时返回 206，完整下载返回 200；以真实字节一致性测试验证。
- 超时回收 queued 与提交存在竞态：回收事务再次条件检查 queued，已进入 submitting 的任务不会被错误退款。
- 删除结果后仍保留请求幂等 tombstone；完成列表查询也推进 Mock，避免离开首页后任务卡住。
- 导航积分与表单同步，首页套餐跟随 Mock 配置，未验证的真实分辨率不能选择。
- 手机端分辨率换行及字号已调整；补充 HTML smooth-scroll 标记以消除路由警告。

## 已知工具警告与依赖公告

构建有 upstream RSC sourcemap 与依赖优化警告；构建成功。Vinext 的部分页面分类显示 `?`，是其静态分类局限，不能将之当成不存在 SSR。

`npm audit` **不是零告警**：6 个 high 节点来自同一 `braces <=3.0.3` 栈耗尽公告及 `micromatch → fast-glob → vite-plugin-dynamic-import → vite-plugin-commonjs → vinext` 传递路径（[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)）。当前使用场景是本地构建 glob；在已生成的 Worker JS 中搜索未见这几个包，用户请求不进入 glob 构建路径。不能据此宣称全部依赖无风险。保留公告记录，正式上线前重新检查上游补丁；不执行会降级 Vinext 到早期版本的 `audit fix --force`。

已用 overrides 修正 fflate 与旧 esbuild 的可修复公告，并重新成功构建。`package-lock.json` 锁定实际安装版本。

## 尚未验证

真实 Google 登录、Waffo sandbox 交易/退款与商户批准、WaveSpeed 21 秒/三分辨率/双角色一致性/收费行为、云端 D1/R2/Cron/域名、真实输入输出审核运营、支持邮箱与合法运营主体。所有真实开关默认关闭，详细配置见 `deployment.md`。

`llms.txt`：项目不存在该文件；本轮检查完成，未新建。
