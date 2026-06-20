# 多租户改造 · 交互 / UI / 文案 优化清单

> 范围：对 `codex/multi-tenant-saas` 分支已实现的多团队功能做交互、视觉、文案三方面的体验评审。
> 功能与数据隔离已单独评审过（无安全阻塞）。本文件只谈「好不好用、清不清楚」，按优先级排序。
> 优先级：**P1 = 上线给真实用户前应处理** · **P2 = 打磨** · **P3 = 锦上添花**。

## 优先级速览

| # | 类别 | 问题 | 优先级 | 位置 |
|---|---|---|---|---|
| 1 | 交互 | 邀请链接生成后没有「复制」按钮 | P1 | [management-forms.tsx:187](src/components/management-forms.tsx) |
| 2 | 交互 | 已生成的邀请看不到、也无法撤销 | P1 | `GET /api/invites` 未接 UI |
| 3 | 交互 | 邀请不能设有效期（叠加无法撤销 → 长期有效口子）| P1 | [invites/route.ts](src/app/api/invites/route.ts) / 邀请表单 |
| 4 | 文案 | 「全局唯一」「外层访问密码」等术语对用户不友好 | P1 | [register/page.tsx:31](src/app/register/page.tsx)、[login/page.tsx:38](src/app/login/page.tsx) |
| 5 | 交互 | 邀请失效落到 Next 默认 404，体验割裂 | P2 | [join/[code]/page.tsx:16](src/app/join/[code]/page.tsx) |
| 6 | 交互 | 团队中途被停用，已登录用户看到的是「请登录」而非「团队已停用」 | P2 | [page.tsx](src/app/page.tsx)、[manage/page.tsx](src/app/manage/page.tsx) |
| 7 | 交互 | 「邀请成员」和「直接新增」两个入口并存，引导含糊 | P2 | [manage-panels.tsx:165-171](src/components/manage-panels.tsx) |
| 8 | 文案 | 注册页「姓名」vs「登录账号」区分不直观 | P2 | [register/page.tsx:34-35](src/app/register/page.tsx) |
| 9 | UI | 超管台中英混排（PLATFORM / ACTIVE / SUSPENDED）| P2 | [admin/page.tsx:41,53](src/app/admin/page.tsx) |
| 10 | UI | 停用团队等高影响操作无二次确认 | P2 | [admin/page.tsx:56](src/app/admin/page.tsx) |
| 11 | 文案 | 加入页「已使用 x/y 次」对加入者无意义且泄露内部信息 | P2 | [join/[code]/page.tsx:27](src/app/join/[code]/page.tsx) |
| 12 | 内容 | 重名/重账号冲突(P2002) 落到通用「请稍后重试」误导成系统故障 | P3 | register / accept / users POST |
| 13 | UI | 超管台每次打开写一条审计，污染审计流水 | P3 | [admin/page.tsx:33](src/app/admin/page.tsx) |
| 14 | 交互 | 注册/加入成功直接进空首页，无「下一步」引导 | P3 | 注册 / 加入成功跳转 |
| 15 | 内容 | `.env.example` 写了超管密码占位明文，需提示不要提交真实值 | P3 | [.env.example](.env.example) |

---

## 一、交互 / 流程

### P1-1　邀请链接缺「复制」按钮
[management-forms.tsx:187](src/components/management-forms.tsx) 生成链接后只是一个 `readOnly` input + 聚焦自动选中。这是**移动优先**的应用，让用户手动长按选中复制很别扭。
**建议**：加一键复制（`navigator.clipboard.writeText`）+「已复制」反馈；复制按钮作为主操作，裸 URL 可折叠或截断显示。

### P1-2　邀请生成后「看不到、撤不回」
后端 `GET /api/invites` 已经能列出本团队邀请，但**管理页没有任何地方渲染它**，也没有作废接口。负责人生成链接后无法回看用了几次、无法作废误发的链接。
**建议**：
- 管理页加「有效邀请」列表：用途次数 `已用/可用`、是否过期、链接 + 复制。
- 加一个失效操作（删除邀请，或把 `usedCount` 置为 `maxUses`）。

### P1-3　邀请不能设有效期
`expiresAt` 后端支持，但表单只暴露了「可用次数」（[management-forms.tsx:182](src/components/management-forms.tsx)）。和「无法撤销」叠加，一个 `maxUses=100` 的链接实际上是长期敞开的入口。
**建议**：表单加「有效期」下拉（1 天 / 7 天 / 30 天 / 永久），默认 7 天。

### P2-5　邀请失效是默认 404
[join/[code]/page.tsx:16](src/app/join/[code]/page.tsx) 对无效/过期/用尽的邀请直接 `notFound()`，新成员看到的是未美化的 Next 404。
**建议**：改成 `loginShell` 风格的「邀请已失效」卡片，附「联系团队负责人重新邀请」或「去登录」。

### P2-6　中途被停用的提示错位
团队被超管停用后，已登录用户下一次请求 → `getRequestUser` 返回 null → 页面跳 `/login?error=auth.required`（显示「请登录后继续使用」），只有再点一次登录才看到「团队已停用」。
**建议**：SSR 页（`page.tsx` / `manage/page.tsx`）对「`team` 存在但 `active=false`」单独跳 `?error=auth.team_suspended`，让用户当场知道原因。

### P2-7　两个加成员入口含糊
侧栏「新增成员」里同时有「邀请成员（生成链接）」和「直接新增（账号+密码）」，而底部提示仍是旧文案「新增后把网址、登录账号和初始密码发给成员」（[manage-panels.tsx:170](src/components/manage-panels.tsx)），只描述了后者。
**建议**：两块各配一句场景说明——
- 邀请链接：「发链接给对方，**对方自己设密码**加入。」
- 直接新增：「你帮成员设好初始密码，再把账号密码发给他。」

### P3-14　注册/加入成功后无引导
新负责人注册完直接落到空团队首页，没有「下一步去邀请成员」的提示。
**建议**：首页在「零成员/零事项」时给一个空状态 CTA（如「邀请第一位成员」）。

---

## 二、UI / 视觉

### P2-9　超管台中英混排
[admin/page.tsx](src/app/admin/page.tsx) 用了 `PLATFORM`、`ACTIVE`、`SUSPENDED`，与全站中文风格不一致。
**建议**：中文化为「平台管理」「使用中」「已停用」。

### P2-10　高影响操作无二次确认
停用团队会让该团队**全员立即无法登录**，但 [admin/page.tsx:56](src/app/admin/page.tsx) 是个直接提交的 form。
**建议**：加 `onSubmit` confirm 或二次确认（「确定停用『{团队名}』？该团队所有成员将无法登录」）。

### P2　邀请链接 input 窄屏处理
长 URL 放进只读 input，移动端需确认不撑破卡片。配合 P1-1 的复制按钮后，可把裸 URL 截断显示。

### P3-13　超管台「查看」也写审计
[admin/page.tsx:33](src/app/admin/page.tsx)、[admin/teams/route.ts:15](src/app/api/admin/teams/route.ts) 每次打开/刷新都写一条 `admin.teams.view`（页面 force-dynamic）。会让真正的「停用/改密」操作淹没在查看噪声里。
**建议**：去掉查看审计，只审计写操作。

### 做得好的地方（保持）
- 注册/加入页复用 `loginShell`、超管台复用 `manageShell`，**视觉与主站一致**。
- 表单输入有 `autoComplete` / `pattern` / `minLength`，移动端 `min-height:42px`，符合现有规范。

---

## 三、文案 / 内容

### P1-4　术语对终端用户不友好
- 注册页 [register/page.tsx:31](src/app/register/page.tsx)：
  现「一个账号对应一个团队；登录账号全局唯一。」
  → 改「每人一个账号、对应一个团队；登录账号在整个平台内不能重复（建议用拼音或工号）。」
- 登录页 [login/page.tsx:38](src/app/login/page.tsx) 遗留文案「输入账号密码即可进入，不需要外层访问密码。」——「外层访问密码」是历史包袱，对自助新用户莫名其妙。
  → 改「输入账号密码即可进入。还没有团队？点下方「创建新团队」。」

### P2-8　注册页字段区分不直观
「你的姓名」和「登录账号」容易混。
**建议**各加微提示：
- 姓名：「团队里显示的名字，可用中文。」
- 登录账号：「登录用，全平台唯一，仅字母数字。」

### P2-11　加入页的「已使用 x/y 次」
[join/[code]/page.tsx:27](src/app/join/[code]/page.tsx) 对**加入者**没意义，还暴露了内部用量。
**建议**：换成「正在加入：**{团队名}**」之类的正向信息，次数信息留给负责人在邀请列表里看（见 P1-2）。

### P3-12　冲突错误兜底成「系统故障」
重名 / 重账号（Prisma P2002）在注册、接受邀请、管理员建成员时多落到通用 `server.error`（「注册失败，请稍后重试」），让用户以为是系统坏了。
**建议**：捕获 P2002，映射成「该显示名/账号已被占用，请换一个」。（`users/[id]/status` 已有此处理，可参照。）

### P3-15　超管密码占位
[.env.example](.env.example) 写了 `SUPER_ADMIN_PASSWORD="change-me-before-bootstrap"`。
**建议**：在 docs 中强调——用**一次性环境变量**执行 `npm run bootstrap:superadmin`，不要把真实超管密码写进 `.env` 并提交。

---

## 建议的处理顺序
1. 先做 **P1-1 / P1-2 / P1-3**（邀请闭环：复制 + 列表/撤销 + 有效期）——这是负责人最高频、目前最缺的一环。
2. 同批顺手改 **P1-4** 文案（改字符串，成本极低）。
3. 再处理 P2 一组（停用确认、停用提示、超管中文化、双入口说明）。
4. P3 视精力收尾。
