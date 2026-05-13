# 每日事项提醒生成器

本项目已提供一个不绑定发送渠道的提醒内容生成器，后续可以接微信服务号、企业微信机器人、Telegram 或其他通知通道。

## 本地/服务器手动运行

```bash
cd /data/daily-notes-app
npm run reminder:daily
```

输出示例：

```text
今日事项提醒

日期：2026-05-12
待办：0 个
今日：0 个
逾期：0 个
高优先级：0 个

今天暂无待办，可以轻松一点。

打开查看：https://m.xwr.me
```

## 当前脚本

- 领域逻辑：`src/lib/reminders.ts`
- 测试：`tests/reminders.test.ts`
- 线上脚本：`scripts/daily-reminder.js`
- npm 命令：`npm run reminder:daily`

`scripts/daily-reminder.js` 会优先从 `daily-notes-app.service` 读取生产 `DATABASE_URL`，避免误读项目目录里旧 `.env` 连错数据库。

## 环境变量

可选：

```bash
DAILY_NOTES_APP_URL=https://m.xwr.me
REMINDER_DATE=2026-05-12
REMINDER_MAX_ITEMS=8
```

说明：

- `REMINDER_DATE` 用于测试指定日期，不设置则使用服务器当天日期。
- `REMINDER_MAX_ITEMS` 控制提醒正文最多展示多少条重点事项。

## 后续可接的发送通道

### 1. 微信服务号/公众号模板消息

适合发到个人微信服务通知。

需要：

- 已认证服务号或具备模板/订阅通知能力的公众号
- `WECHAT_MP_APP_ID`
- `WECHAT_MP_APP_SECRET`
- 模板 ID
- 用户公众号 openid

建议后续新增：

```text
scripts/send-wechat-official-message.js
```

流程：

1. `npm run reminder:daily` 生成文本。
2. 脚本调用公众号接口发送模板消息。
3. 定时任务每天执行。

### 2. 企业微信群机器人

适合团队群提醒，实现最简单。

需要：

```bash
WECOM_BOT_WEBHOOK=...
```

建议后续新增：

```text
scripts/send-wecom-reminder.js
```

### 3. Telegram

适合先快速验证提醒内容和定时逻辑。

可以直接把 `npm run reminder:daily` 的输出发送到 Telegram。

## 建议下一步

先用当前提醒生成器观察 1-2 天输出是否符合预期，再决定接：

1. 企业微信机器人：最快。
2. 微信服务号：最像个人微信提醒，但配置最多。
3. Telegram：最容易联调。
