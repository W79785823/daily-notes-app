# 多租户改造 · 待修复问题清单（Bug / 阻塞）

> 这份是「**会报错 / 已经坏掉、必须修**」的清单，交给 Codex 执行。
> 与体验优化建议（[multi-tenant-ux-review.md](docs/multi-tenant-ux-review.md)）分开——那份是「锦上添花」，这份是「不修就有问题」。
> 来源：在本地把应用真正启动（`next dev`）时暴露出来的问题。`tsc`、vitest、`verify:multi-tenant-db` 全绿，但应用仍然起不来——见 P0。

## 优先级速览

| # | 级别 | 问题 | 影响 |
|---|---|---|---|
| 1 | **P0 阻塞** | `/api/invites` 下动态段名冲突（`[code]` vs `[id]`）| **整站无法启动**，`next dev` / `next build` 直接报错 |
| 2 | **P1** | CI 缺少 `next build` / 启动冒烟，导致 P0 这类路由错误漏网 | 同类结构性错误以后还会漏过 |
| 3 | P2 | 超管 suspend/reactivate/重置密码 对不存在的 id 无 try/catch | 传错 id 时返回 500 而非 404，体验差（非安全问题）|

---

## P0｜应用无法启动：`/api/invites` 动态段名冲突

**现象**：`next dev`（和 `next build`）一启动立即报错，整站打不开：

```
Error: You cannot use different slug names for the same dynamic path ('code' !== 'id').
```

**根因**：`src/app/api/invites/` 同一父路径下同时存在两个**不同名**的动态段：
- `src/app/api/invites/[code]/accept/route.ts`（接受邀请，POST）
- `src/app/api/invites/[id]/route.ts`（撤销邀请，DELETE）

Next.js 不允许同一层用不同的动态段名（`[code]` 与 `[id]` 二选一，不能并存）。

**为什么全套测试都没抓到**：`tsc`、vitest、`scripts/verify-multi-tenant-db.mjs` 都是直接 `import` 路由模块来测函数，**绕过了 Next 的路由树校验**；只有真正 `next dev` / `next build` 才会做这个校验。所以 CI 全绿，应用却起不来。

**确认范围**：只有 `invites` 有这个冲突。其余 `tasks/[id]`、`users/[id]`、`announcements/[id]`、`admin/teams/[id]`、`admin/users/[id]` 各自在不同父路径下，合法，无需改动。

**修复（推荐：统一到 `[code]`）**
1. 删除 `src/app/api/invites/[id]/route.ts`。
2. 新建 `src/app/api/invites/[code]/route.ts`，导出 `DELETE`，按 `code` 撤销（租户内 `findFirst` / `updateMany`，逻辑与原来一致，只是参数名从 `id` 换成 `code`，查询条件用 `{ code }`）。
3. `src/components/management-forms.tsx` 里 `revokeInvite`：把
   `fetch(\`/api/invites/${invite.id}\`, …)` 改成 `fetch(\`/api/invites/${invite.code}\`, …)`。
   （`InviteRow` 已经带 `code` 字段，乐观更新仍可用 `invite.id` 做匹配，不受影响。）

这样 `[code]/route.ts`（DELETE）与 `[code]/accept/route.ts`（POST）共用同一段名 `code`，合法。

> 说明：此修复我本地验证过——改完后 `next dev` 能正常启动、登录页正常渲染。但**我只确认到应用能起来 + 登录页可渲染**；P0 修复前无法继续验证其余页面，可能还有别的运行时问题没暴露（见文末）。

## P1｜CI 增加构建/启动校验

P0 能漏到「全套测试通过」是因为 CI 只跑 `npm test` + 直接 import 路由，没有真正构建或启动应用。

**修复**：在 [.github/workflows/ci.yml](.github/workflows/ci.yml) 的测试之后加一步 `npm run build`（Next 在 build 阶段会校验路由树，能挡住 P0 这类结构错误）。已有的「起 Postgres + db push」步骤可复用给 build 用。

## P2｜超管接口对不存在 id 的健壮性（可选）

`src/app/api/admin/teams/[id]/suspend/route.ts`、`/reactivate/route.ts`、`src/app/api/admin/users/[id]/reset-password/route.ts` 里用 `prisma.team.update({ where: { id } })` / `prisma.user.update(...)`，若 id 不存在会抛 `P2025` → 未捕获 → 500。

**修复（可选）**：捕获 `P2025`，返回 404 + 友好文案。纯健壮性，非安全/功能阻塞。

---

## 修完之后
P0 修好、应用能启动后叫我一声，我会把全站真正跑一遍（登录 / 注册 / 加入 / 首页 / 管理 / 超管台，移动端 + 桌面端），确认没有别的运行时错误，并把 UI、文案的优化点逐屏看完整理给你。
