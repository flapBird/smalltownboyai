# 需求核对与修正

本轮采用用户最后确认的范围：先完成本地工程和 Mock 验证。黑色背景、青柠按钮、双图上传与猫咪预览的设计为用户选定的**第二版**，不再以历史提交顺序编号。

## 已纠正的假设

1. 主关键词为 `smalltown boy ai`，产品名 Smalltown Boy AI；域名 `smalltownboyai.one`，邮箱为 `support@smalltownboyai.one`。用户输入邮箱周围的 `**` 是 Markdown 标记，不属于地址。
2. 原需求的“可正式上线、真实支付与生成”需要外部账户和授权素材。当前未提供，不能把本地 Mock、适配器完成或构建成功描述为真实集成验收通过。
3. Seedance 2.5 Video Edit 的模型 ID 为 `bytedance/seedance-2.5/video-edit`。输入使用 `video`、`reference_images`，提示词通过 `@Image 1`、`@Image 2` 引用角色。没有实现第二供应商或把 Turbo 当作等价版本。
4. 官方模型页说明参考片长 4–30 秒，输出跟随输入时长/画幅。21 秒、9:16 不是单靠填写一个输出参数就能保证；需要相应的参考视频，并逐项实测 480p/720p/1080p。
5. `generate_audio:false` 是保留原音频，不是移除音频。必须预先准备静音且有权使用的参考视频；提示词“不加音乐”不能解决已有商业音轨的问题。
6. 成本按输入和输出总秒数估算，21+21 秒对应约 $4.62 / $9.24 / $23.10（480p/720p/1080p，模型页查阅时费率 .11/.22/.55 USD 每秒）。这些是估算，不是实付成本或失败收费承诺。当前套餐在此基础上仍有正毛差，但尚未扣支付手续费、税、存储、失败损耗与退款。保留原售价/积分，真实规格全部默认关闭；实测成本不合适时不得擅自调价启用。
7. Waffo 官方 SDK 的 checkout 环境随 API key，而不是单靠 `WAFFO_ENVIRONMENT` 或构造参数切换。本项目后者用于校验 webhook 和验签。配置错误的生产 key 仍有收款风险，因此真实 SDK 开关默认关闭，测试凭据须人工确认。
8. Waffo webhook 使用原始请求体与官方 RSA 验签；完成、退款事件及金额字段以 SDK 为准。没有编造拒付事件；部分退款和拒付需要人工对账，后台操作只调整本站账本。
9. 积分永久有效与会员权限独立；退款可能造成已花费积分的负余额，避免生成后退款获免费积分。余额不足继续阻止生成；有效已支付订单重新决定等级。
10. 原 SEO title 的 “Viral” 不是可验证产品结果，本地版本改为 “Create Cat Dance Videos”；没有虚构“几分钟完成”、真实演示、好评、用户数或 VideoObject。完整 FAQ 与公开政策反映预览状态。
11. Vinext 兼容性检查支持项目所用 API。浏览器发现其 multipart 请求在 Route Handler 前受默认 1 MiB 限制，已用 `next.config.ts` 的 9 MiB envelope 配置解决，业务仍独立执行 8 MiB、256–4096 像素限制。没有必要因此切换 OpenNext。
12. 法律页面没有编造公司和地址；支持邮箱只完成配置，邮箱收件、运营主体、商户资质及最终政策仍需用户补齐。

## 官方依据

- [WaveSpeed 模型页](https://wavespeed.ai/models/bytedance/seedance-2.5/video-edit)
- [Waffo TypeScript SDK](https://github.com/waffo-com/waffo-pancake-sdk-ts)
- [Waffo webhook guide](https://github.com/waffo-com/waffo-pancake-sdk-ts/blob/main/docs/webhook-guide.md)
- [Vinext](https://github.com/cloudflare/vinext)
- [Better Auth Google](https://www.better-auth.com/docs/authentication/google)

模型费率、SDK 事件和平台规则可能变化，正式启用前再次核对。当前不把文档研究代替实际调用验收。
