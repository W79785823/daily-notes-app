#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pgPkg from 'pg';

const { Client } = pgPkg;
const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const dbDir = `${process.env.TMPDIR || '/tmp'}/daily-notes-multitenant-${Date.now()}`;
const port = Number(process.env.VERIFY_DB_PORT || 55433);
const databaseUrl = `postgresql://postgres:password@127.0.0.1:${port}/postgres?schema=public`;

Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  SESSION_SECRET: 'test-session-secret-for-db-verification-at-least-32',
  AUTH_ALLOW_DEV_USER_HEADER: 'false',
  SUPER_ADMIN_LOGIN: 'platform-root',
  SUPER_ADMIN_PASSWORD: 'root-secret-123456',
  DAILY_NOTES_APP_URL: 'http://127.0.0.1:3000',
  REMINDER_DATE: '2026-06-18',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function query(sql) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

function nextRequest(url, init = {}) {
  const request = new Request(url, init);
  const parsed = new URL(url);
  Object.defineProperty(request, 'nextUrl', { value: parsed });
  Object.defineProperty(request, 'cookies', {
    value: {
      get(name) {
        const cookie = request.headers.get('cookie') || '';
        const hit = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
        return hit ? { name, value: hit.slice(name.length + 1) } : undefined;
      },
    },
  });
  return request;
}

function jsonRequest(url, body, cookie) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return nextRequest(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function json(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function sessionCookie(response) {
  const raw = response.headers.get('set-cookie') || '';
  const first = raw.split(';')[0];
  assert(first.startsWith('daily_notes_session='), `missing session cookie: ${raw}`);
  return first;
}

async function importRoute(path) {
  return import(pathToFileURL(`${repo}/${path}`).href);
}

async function createSingleTenantBaseline() {
  await query(`
    CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN');
    CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
    CREATE TABLE "User" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "loginName" TEXT UNIQUE,
      "passwordHash" TEXT,
      "role" "Role" NOT NULL DEFAULT 'MEMBER',
      "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "active" BOOLEAN NOT NULL DEFAULT true,
      "wechatOpenId" TEXT UNIQUE,
      "wechatUnionId" TEXT,
      "lastLoginAt" TIMESTAMP(3),
      "sessionVersion" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "Task" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "note" TEXT,
      "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
      "date" TEXT NOT NULL,
      "creatorId" TEXT NOT NULL REFERENCES "User"("id"),
      "assigneeId" TEXT NOT NULL REFERENCES "User"("id"),
      "teamVisible" BOOLEAN NOT NULL DEFAULT false,
      "completedAt" TIMESTAMP(3),
      "completedById" TEXT REFERENCES "User"("id"),
      "deletedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "Announcement" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "pinned" BOOLEAN NOT NULL DEFAULT false,
      "authorId" TEXT NOT NULL REFERENCES "User"("id"),
      "deletedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "action" TEXT NOT NULL,
      "detail" JSONB,
      "userId" TEXT NOT NULL REFERENCES "User"("id"),
      "taskId" TEXT REFERENCES "Task"("id"),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "LoginAttempt" (
      "id" TEXT PRIMARY KEY,
      "identifier" TEXT NOT NULL UNIQUE,
      "failedCount" INTEGER NOT NULL DEFAULT 0,
      "lockedUntil" TIMESTAMP(3),
      "lastAttemptAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO "User" ("id", "name", "loginName", "role", "permissions", "active") VALUES ('old-admin', '管理员', 'old-admin', 'ADMIN', ARRAY[]::TEXT[], true);
    INSERT INTO "User" ("id", "name", "loginName", "role", "permissions", "active") VALUES ('old-member', '张三', 'old-member', 'MEMBER', ARRAY['task.create']::TEXT[], true);
    INSERT INTO "Task" ("id", "title", "date", "creatorId", "assigneeId") VALUES ('old-task', '旧任务', '2026-06-18', 'old-admin', 'old-member');
    INSERT INTO "Announcement" ("id", "title", "content", "authorId") VALUES ('old-ann', '旧公告', 'hello', 'old-admin');
    INSERT INTO "AuditLog" ("id", "action", "userId", "taskId") VALUES ('old-log', 'task.create', 'old-admin', 'old-task');
  `);
}

async function verifyMigrationBackfill() {
  await query(fs.readFileSync(`${repo}/prisma/migrations/20260618090000_multi_tenant/migration.sql`, 'utf8'));
  const backfill = await query(`
    SELECT t."name", t."ownerId", u."teamId", task."teamId" AS "taskTeamId", ann."teamId" AS "annTeamId"
    FROM "Team" t
    JOIN "User" u ON u."id"='old-admin'
    JOIN "Task" task ON task."id"='old-task'
    JOIN "Announcement" ann ON ann."id"='old-ann'
  `);
  assert(backfill.rows[0].name === '默认团队', 'default team was not created');
  assert(backfill.rows[0].ownerId === 'old-admin', 'old admin was not set as owner');
  assert(backfill.rows[0].teamId === backfill.rows[0].taskTeamId, 'old task not backfilled to default team');
  assert(backfill.rows[0].teamId === backfill.rows[0].annTeamId, 'old announcement not backfilled to default team');
}

async function verifyFlows() {
  execFileSync('node', ['scripts/bootstrap-super-admin.js'], { cwd: repo, env: process.env, stdio: 'pipe' });
  const superUser = await query(`SELECT "loginName", "teamId", "isSuperAdmin" FROM "User" WHERE "loginName"='platform-root'`);
  assert(superUser.rows[0].isSuperAdmin === true && superUser.rows[0].teamId === null, 'super admin bootstrap failed');

  const register = await importRoute('src/app/api/auth/register/route.ts');
  const login = await importRoute('src/app/api/auth/login/route.ts');
  const invites = await importRoute('src/app/api/invites/route.ts');
  const accept = await importRoute('src/app/api/invites/[code]/accept/route.ts');
  const tasks = await importRoute('src/app/api/tasks/route.ts');
  const complete = await importRoute('src/app/api/tasks/[id]/complete/route.ts');
  const users = await importRoute('src/app/api/users/route.ts');
  const adminTeams = await importRoute('src/app/api/admin/teams/route.ts');
  const suspend = await importRoute('src/app/api/admin/teams/[id]/suspend/route.ts');
  const reactivate = await importRoute('src/app/api/admin/teams/[id]/reactivate/route.ts');
  const adminReset = await importRoute('src/app/api/admin/users/[id]/reset-password/route.ts');

  const regA = await register.POST(jsonRequest('http://localhost/api/auth/register', { teamName: '团队A', displayName: '负责人A', loginName: 'owner-a', password: 'password-a' }));
  assert(regA.status === 201, `register A failed: ${regA.status} ${JSON.stringify(await json(regA.clone()))}`);
  const cookieA = sessionCookie(regA);
  const ownerA = (await json(regA)).user;

  const regB = await register.POST(jsonRequest('http://localhost/api/auth/register', { teamName: '团队B', displayName: '负责人B', loginName: 'owner-b', password: 'password-b' }));
  assert(regB.status === 201, `register B failed: ${regB.status}`);
  const cookieB = sessionCookie(regB);
  const ownerB = (await json(regB)).user;
  assert(ownerA.teamId !== ownerB.teamId, 'registered teams should differ');

  const inviteRes = await invites.POST(jsonRequest('http://localhost/api/invites', { maxUses: 1, permissions: ['task.create'] }, cookieA));
  assert(inviteRes.status === 201, `invite create failed: ${inviteRes.status}`);
  const invitePayload = await json(inviteRes);
  const code = invitePayload.invite.code;
  assert(invitePayload.joinUrl.includes(`/join/${code}`), 'invite join URL missing code');
  assert(invitePayload.invite.expiresAt, 'invite should have a default expiry');

  const joinRes = await accept.POST(jsonRequest(`http://localhost/api/invites/${code}/accept`, { displayName: '成员A', loginName: 'member-a', password: 'member-pass' }), { params: Promise.resolve({ code }) });
  assert(joinRes.status === 201, `invite accept failed: ${joinRes.status}`);
  const memberA = (await json(joinRes)).user;
  assert(memberA.teamId === ownerA.teamId, 'invite member joined wrong team');

  const joinAgain = await accept.POST(jsonRequest(`http://localhost/api/invites/${code}/accept`, { displayName: '成员A2', loginName: 'member-a2', password: 'member-pass' }), { params: Promise.resolve({ code }) });
  assert(joinAgain.status === 404, `single-use invite should be exhausted, got ${joinAgain.status}`);

  const duplicateNameInviteRes = await invites.POST(jsonRequest('http://localhost/api/invites', { maxUses: 1, permissions: [] }, cookieA));
  assert(duplicateNameInviteRes.status === 201, `duplicate name invite create failed: ${duplicateNameInviteRes.status}`);
  const duplicateNameCode = (await json(duplicateNameInviteRes)).invite.code;
  const duplicateInviteAccept = await accept.POST(jsonRequest(`http://localhost/api/invites/${duplicateNameCode}/accept`, { displayName: '成员A', loginName: 'member-a-duplicate-name', password: 'member-pass' }), { params: Promise.resolve({ code: duplicateNameCode }) });
  assert(duplicateInviteAccept.status === 409, `duplicate invite display name should 409, got ${duplicateInviteAccept.status}`);

  const revocableInviteRes = await invites.POST(jsonRequest('http://localhost/api/invites', { maxUses: 1, permissions: [] }, cookieA));
  assert(revocableInviteRes.status === 201, `revocable invite create failed: ${revocableInviteRes.status}`);
  const revocableInvite = (await json(revocableInviteRes)).invite;
  const revoke = await importRoute('src/app/api/invites/[code]/route.ts');
  const revokeRes = await revoke.DELETE(nextRequest(`http://localhost/api/invites/${revocableInvite.code}`, { method: 'DELETE', headers: { cookie: cookieA } }), { params: Promise.resolve({ code: revocableInvite.code }) });
  assert(revokeRes.status === 200, `invite revoke failed: ${revokeRes.status}`);
  const revokedAccept = await accept.POST(jsonRequest(`http://localhost/api/invites/${revocableInvite.code}/accept`, { displayName: '被撤销', loginName: 'revoked-member', password: 'member-pass' }), { params: Promise.resolve({ code: revocableInvite.code }) });
  assert(revokedAccept.status === 404, `revoked invite should be invalid, got ${revokedAccept.status}`);

  const duplicateMemberCreate = await users.POST(jsonRequest('http://localhost/api/users', { name: '成员A', loginName: 'member-a-duplicate-create', password: 'member-pass', role: 'MEMBER', permissions: [], active: true }, cookieA));
  assert(duplicateMemberCreate.status === 409, `duplicate managed member name should 409, got ${duplicateMemberCreate.status}`);

  const crossAssign = await tasks.POST(jsonRequest('http://localhost/api/tasks', { title: '跨团队指派', date: '2026-06-18', priority: 'NORMAL', assigneeId: ownerB.id }, cookieA));
  assert(crossAssign.status === 404, `cross-team assignee should 404, got ${crossAssign.status}`);

  const taskARes = await tasks.POST(jsonRequest('http://localhost/api/tasks', { title: 'A任务', date: '2026-06-18', priority: 'NORMAL', assigneeId: memberA.id }, cookieA));
  assert(taskARes.status === 201, `create A task failed: ${taskARes.status}`);
  const taskA = (await json(taskARes)).task;
  const taskBRes = await tasks.POST(jsonRequest('http://localhost/api/tasks', { title: 'B任务', date: '2026-06-18', priority: 'NORMAL', assigneeId: ownerB.id }, cookieB));
  assert(taskBRes.status === 201, `create B task failed: ${taskBRes.status}`);
  const taskB = (await json(taskBRes)).task;

  const listA = await tasks.GET(nextRequest('http://localhost/api/tasks?date=2026-06-18', { headers: { cookie: cookieA } }));
  const listAPayload = await json(listA);
  assert(listAPayload.tasks.some((task) => task.id === taskA.id), 'team A cannot see own task');
  assert(!listAPayload.tasks.some((task) => task.id === taskB.id), 'team A can see team B task');

  const crossComplete = await complete.POST(jsonRequest(`http://localhost/api/tasks/${taskB.id}/complete`, { completed: true }, cookieA), { params: Promise.resolve({ id: taskB.id }) });
  assert(crossComplete.status === 404, `cross-team complete should 404, got ${crossComplete.status}`);

  const superLogin = await login.POST(jsonRequest('http://localhost/api/auth/login', { loginName: 'platform-root', password: 'root-secret-123456' }));
  assert(superLogin.status === 200, `super admin login failed: ${superLogin.status}`);
  const superCookie = sessionCookie(superLogin);

  const viewAuditBefore = await query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE "action"='admin.teams.view'`);
  const teamList = await adminTeams.GET(nextRequest('http://localhost/api/admin/teams', { headers: { cookie: superCookie } }));
  const teamsPayload = await json(teamList);
  assert(teamsPayload.teams.some((team) => team.name === '团队A' && team.owner?.name === '负责人A'), 'admin team list missing team A owner');
  const viewAuditAfter = await query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE "action"='admin.teams.view'`);
  assert(viewAuditAfter.rows[0].count === viewAuditBefore.rows[0].count, 'admin team list view should not write audit logs');

  const suspendRes = await suspend.POST(nextRequest(`http://localhost/api/admin/teams/${ownerB.teamId}/suspend`, { method: 'POST', headers: { cookie: superCookie } }), { params: Promise.resolve({ id: ownerB.teamId }) });
  assert(suspendRes.status === 200, `suspend failed: ${suspendRes.status}`);
  const suspendedLogin = await login.POST(jsonRequest('http://localhost/api/auth/login', { loginName: 'owner-b', password: 'password-b' }));
  assert(suspendedLogin.status === 403, `suspended team login should fail, got ${suspendedLogin.status}`);

  const missingSuspend = await suspend.POST(nextRequest('http://localhost/api/admin/teams/missing-team/suspend', { method: 'POST', headers: { cookie: superCookie } }), { params: Promise.resolve({ id: 'missing-team' }) });
  assert(missingSuspend.status === 404, `missing team suspend should 404, got ${missingSuspend.status}`);
  const missingReactivate = await reactivate.POST(nextRequest('http://localhost/api/admin/teams/missing-team/reactivate', { method: 'POST', headers: { cookie: superCookie } }), { params: Promise.resolve({ id: 'missing-team' }) });
  assert(missingReactivate.status === 404, `missing team reactivate should 404, got ${missingReactivate.status}`);

  const resetRes = await adminReset.POST(jsonRequest(`http://localhost/api/admin/users/${memberA.id}/reset-password`, { newPassword: 'new-member-pass', confirmPassword: 'new-member-pass' }, superCookie), { params: Promise.resolve({ id: memberA.id }) });
  assert(resetRes.status === 200, `admin reset failed: ${resetRes.status}`);
  const missingResetRes = await adminReset.POST(jsonRequest('http://localhost/api/admin/users/missing-user/reset-password', { newPassword: 'new-member-pass', confirmPassword: 'new-member-pass' }, superCookie), { params: Promise.resolve({ id: 'missing-user' }) });
  assert(missingResetRes.status === 404, `missing user reset should 404, got ${missingResetRes.status}`);
  const memberLogin = await login.POST(jsonRequest('http://localhost/api/auth/login', { loginName: 'member-a', password: 'new-member-pass' }));
  assert(memberLogin.status === 200, `member login with reset password failed: ${memberLogin.status}`);

  const reminderOutput = execFileSync('node', ['scripts/daily-reminder.js'], { cwd: repo, env: process.env, encoding: 'utf8' });
  assert(reminderOutput.includes('团队：默认团队'), 'reminder missing default team');
  assert(reminderOutput.includes('团队：团队A'), 'reminder missing team A');
  assert(!reminderOutput.includes('团队：团队B'), 'reminder should skip suspended team B');
}

const pg = new EmbeddedPostgres({ databaseDir: dbDir, user: 'postgres', password: 'password', port, persistent: false, onLog: () => {}, onError: () => {} });

try {
  await pg.initialise();
  await pg.start();
  await createSingleTenantBaseline();
  await verifyMigrationBackfill();
  await verifyFlows();
  console.log('DB verification passed');
} finally {
  await pg.stop().catch(() => {});
}
