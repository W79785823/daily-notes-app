# 微信云开发小程序版使用说明

这个目录是可在微信开发者工具中直接导入的云开发版，不需要自建云服务器。

## 目录

- `project.config.json`：微信开发者工具项目配置
- `docs/miniprogram-database-setup.md`：云数据库集合、权限、索引配置清单
- `docs/wechat-review-checklist.md`：微信审核提交材料和测试流程清单
- `docs/miniprogram-qa-checklist.md`：体验版/真机调试逐项测试表
- `docs/miniprogram-launch-steps.md`：最终上线操作步骤
- `miniprogram/`：小程序前端
  - `pages/index`：事项仪表盘、完成率、搜索、负责人筛选、优先级/分类、创建/编辑事项、团队公告、确认收到
  - `pages/users`：人员、角色、额外权限、启停、微信绑定管理
  - `pages/about`：关于、隐私与数据用途说明
- `cloudfunctions/`：云函数
  - `login`：按微信 openid 登录；命中管理员 openid 白名单才自动成为管理员，其他人默认待审核
  - `tasks`：事项列表、创建、编辑、完成、删除；支持优先级、分类、搜索和负责人筛选
  - `users`：人员列表、创建、编辑、启停、微信绑定/解绑
  - `announcements`：团队公告列表、发布、删除、确认收到
  - `seed`：可选初始化人员数据

## 使用步骤

1. 打开微信开发者工具
2. 选择「导入项目」
3. 项目目录选择本仓库 `/root/daily-notes-app`
4. AppID 换成你自己的小程序 AppID
5. 开通「云开发」，创建云环境
6. 在开发者工具里上传并部署云函数：
   - `login`
   - `tasks`
   - `users`
   - `announcements`
   - 可选：`seed`
7. 创建云数据库集合：
   - `users`
   - `tasks`
   - `announcements`
   - `announcementReads`
   - `auditLogs`
8. 集合权限建议先设为「仅云函数可读写」
9. 编译运行

## 初始化规则

小程序不再把“第一个打开的人”自动设为管理员，避免误把测试人员或陌生微信设成最高权限。

推荐初始化流程：

1. 管理员先打开一次小程序。
2. 云数据库 `users` 集合会生成一条待审核记录。
3. 复制这条记录里的 `openid`。
4. 写入 `cloudfunctions/common/config.js` 的 `adminOpenIds` 数组，例如：

```js
module.exports = {
  adminOpenIds: ['管理员的 openid'],
};
```

5. 重新上传部署 `login` 云函数。
6. 管理员再次打开小程序，会自动成为 `ADMIN` 并启用。

后续陌生微信首次进入会创建为 `PENDING`/未启用账号，首页会提示「账号待审核」。管理员需要在「人员」页审核配置姓名、角色和权限后，对方才能使用事项功能。
管理员后续仍然可以在人员页更改成员角色、额外权限、启用/停用状态，以及微信绑定。

## 上线前建议

- `project.config.json` 已配置 AppID：`wx5946232a8e85fce4`
- `miniprogram/app.js` 已配置云环境：`cloudbase-d8gf7epro093b9038`
- 正式环境建议不要部署 `seed`，避免写入示例人员。
- 数据库集合权限建议设为「仅云函数可读写」。
- 建议给 `tasks` 添加索引：`date`、`deletedAt`、`assigneeOpenId`、`creatorOpenId`、`priority`、`category`、`createdAt`。
- 建议给 `users` 添加索引：`openid`、`active`、`role`。
- 建议给 `announcements` 添加索引：`deletedAt`、`pinned`、`createdAt`。
- 建议给 `announcementReads` 添加索引：`announcementId`、`openid`。
- 提交审核前，在微信公众平台补齐「用户隐私保护指引」；小程序内已提供「关于」页说明 openid、人员、事项和审计日志用途。
- 如果公司已有正式隐私政策/联系方式，请同步替换 `miniprogram/pages/about/about.wxml` 中的默认文案。

## 上线前本地检查

每次提交审核或重新部署前，建议先运行：

```bash
npm run check:miniprogram
npm test
npm run build
```

`check:miniprogram` 会检查：

- AppID 是否为 `wx5946232a8e85fce4`
- 云环境是否为 `cloudbase-d8gf7epro093b9038`
- `app.json` 是否注册事项、人员、关于页面和 Tab
- 事项页是否包含优先级、分类、搜索、负责人筛选、完成率、团队公告和确认收到
- `login`、`tasks`、`users`、`announcements` 云函数文件是否存在
- 待审核、人员绑定、事项编辑、隐私说明等关键逻辑是否存在

注意：这个检查只能验证本地代码配置，不能替代微信开发者工具里的云函数上传和数据库集合权限检查。

## 注意

- 这个版本不依赖 Next.js、PostgreSQL、Prisma，也不需要公网 HTTPS 服务器。
- 原来的 Next.js 版本仍可作为 Web 管理后台参考，但不是微信开发者工具直接上架的主体。
- 上架前需要补齐小程序基本信息、隐私协议、服务类目，并按微信审核要求填写数据用途。
