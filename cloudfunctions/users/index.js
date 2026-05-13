const cloud = require('wx-server-sdk');
const { canManageUsers } = require('../common/auth');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ROLES = ['MEMBER', 'COLLABORATOR', 'ADMIN'];
const PERMISSIONS = ['task.create', 'task.assign', 'task.view_all', 'task.edit_all', 'task.delete', 'task.complete_other', 'announcement.create', 'user.manage', 'permission.manage'];

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid, active: true }).limit(1).get();
  return res.data[0] || null;
}

function cleanPermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((p) => PERMISSIONS.includes(p)))];
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const user = await currentUser(openid);
  if (!user) return { error: '请先登录' };

  const action = event.action || 'list';
  const users = db.collection('users');
  const now = new Date();

  if (action === 'list') {
    const res = await users.orderBy('createdAt', 'asc').get();
    if (canManageUsers(user)) return { users: res.data };
    return { users: res.data.filter((u) => u.active).map((u) => ({ _id: u._id, openid: u.openid, name: u.name, role: u.role, permissions: [], active: u.active })) };
  }

  if (action === 'create') {
    if (!canManageUsers(user)) return { error: '没有权限管理人员' };
    const name = String(event.name || '').trim();
    const role = ROLES.includes(event.role) ? event.role : 'MEMBER';
    if (!name) return { error: '姓名不能为空' };
    const created = await users.add({
      data: {
        openid: null,
        name,
        role,
        permissions: cleanPermissions(event.permissions),
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    await db.collection('auditLogs').add({ data: { action: 'user.create', userOpenId: user.openid, targetUserId: created._id, createdAt: now } });
    return { userId: created._id };
  }

  if (action === 'review') {
    if (!canManageUsers(user)) return { error: '没有权限管理人员' };
    const targetId = String(event.id || '');
    if (!targetId) return { error: '人员 ID 不能为空' };
    const name = String(event.name || '').trim();
    if (!name) return { error: '姓名不能为空' };
    const role = ROLES.includes(event.role) ? event.role : 'MEMBER';
    await users.doc(targetId).update({
      data: {
        name,
        role,
        permissions: cleanPermissions(event.permissions),
        active: true,
        status: 'APPROVED',
        updatedAt: now,
      },
    });
    await db.collection('auditLogs').add({ data: { action: 'user.review', userOpenId: user.openid, targetUserId: targetId, createdAt: now } });
    return { ok: true };
  }

  if (action === 'update') {
    if (!canManageUsers(user)) return { error: '没有权限管理人员' };
    const targetId = String(event.id || '');
    if (!targetId) return { error: '人员 ID 不能为空' };
    const data = { updatedAt: now };
    if (event.name !== undefined) {
      const name = String(event.name || '').trim();
      if (!name) return { error: '姓名不能为空' };
      data.name = name;
    }
    if (event.role !== undefined) data.role = ROLES.includes(event.role) ? event.role : 'MEMBER';
    if (event.permissions !== undefined) data.permissions = cleanPermissions(event.permissions);
    if (event.active !== undefined) {
      data.active = Boolean(event.active);
      data.status = data.active ? 'APPROVED' : 'PENDING';
    }
    await users.doc(targetId).update({ data });
    await db.collection('auditLogs').add({ data: { action: 'user.update', userOpenId: user.openid, targetUserId: targetId, createdAt: now } });
    return { ok: true };
  }

  if (action === 'setActive') {
    if (!canManageUsers(user)) return { error: '没有权限管理人员' };
    const targetId = String(event.id || '');
    if (!targetId) return { error: '人员 ID 不能为空' };
    const active = event.active !== false;
    await users.doc(targetId).update({ data: { active, status: active ? 'APPROVED' : 'PENDING', updatedAt: now } });
    await db.collection('auditLogs').add({ data: { action: active ? 'user.enable' : 'user.disable', userOpenId: user.openid, targetUserId: targetId, createdAt: now } });
    return { ok: true };
  }

  if (action === 'bindSelf') {
    const targetId = String(event.id || '');
    if (!targetId) return { error: '人员 ID 不能为空' };
    const target = await users.doc(targetId).get().then((r) => r.data).catch(() => null);
    if (!target || target.active === false) return { error: '人员不存在或已停用' };
    if (target.openid && target.openid !== openid) return { error: '该人员已绑定微信' };
    const duplicate = await users.where({ openid }).limit(1).get();
    if (duplicate.data.length && duplicate.data[0]._id !== targetId) return { error: '当前微信已绑定其他人员' };
    await users.doc(targetId).update({ data: { openid, updatedAt: now } });
    await db.collection('auditLogs').add({ data: { action: 'wechat.bind', userOpenId: openid, targetUserId: targetId, createdAt: now } });
    return { ok: true };
  }

  if (action === 'unbind') {
    if (!canManageUsers(user)) return { error: '没有权限管理人员' };
    const targetId = String(event.id || '');
    if (!targetId) return { error: '人员 ID 不能为空' };
    await users.doc(targetId).update({ data: { openid: null, updatedAt: now } });
    await db.collection('auditLogs').add({ data: { action: 'wechat.unbind', userOpenId: user.openid, targetUserId: targetId, createdAt: now } });
    return { ok: true };
  }

  return { error: '未知操作' };
};
