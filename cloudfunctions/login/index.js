const cloud = require('wx-server-sdk');
const { adminOpenIds } = require('../common/config');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function publicUser(user) {
  return {
    _id: user._id,
    openid: user.openid,
    name: user.name,
    role: user.role,
    permissions: user.permissions || [],
    active: user.active,
    status: user.status || (user.active === false ? 'PENDING' : 'APPROVED'),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const users = db.collection('users');
  const now = new Date();

  const existing = await users.where({ openid }).limit(1).get();
  const isConfiguredAdmin = Array.isArray(adminOpenIds) && adminOpenIds.includes(openid);
  if (existing.data.length) {
    const user = existing.data[0];
    const adminUpgrade = isConfiguredAdmin && (user.role !== 'ADMIN' || user.active === false || user.status === 'PENDING');
    const updateData = adminUpgrade
      ? { role: 'ADMIN', active: true, status: 'APPROVED', lastLoginAt: now, updatedAt: now }
      : { lastLoginAt: now, updatedAt: now };
    await users.doc(user._id).update({ data: updateData });
    if (adminUpgrade) {
      await db.collection('auditLogs').add({ data: { action: 'user.configured_admin', userOpenId: openid, targetUserId: user._id, createdAt: now } });
    }
    const normalized = { ...user, ...updateData, status: updateData.status || user.status || (user.active === false ? 'PENDING' : 'APPROVED') };
    if (normalized.active === false || normalized.status === 'PENDING') {
      return { user: publicUser(normalized), pending: true, error: '账号待管理员审核' };
    }
    return { user: publicUser(normalized), pending: false };
  }

  const user = {
    openid,
    name: isConfiguredAdmin ? '管理员' : `待审核成员${String(openid).slice(-4)}`,
    role: isConfiguredAdmin ? 'ADMIN' : 'MEMBER',
    permissions: [],
    active: isConfiguredAdmin,
    status: isConfiguredAdmin ? 'APPROVED' : 'PENDING',
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const created = await users.add({ data: user });
  const createdUser = { _id: created._id, ...user };
  if (!isConfiguredAdmin) {
    await db.collection('auditLogs').add({ data: { action: 'user.pending', userOpenId: openid, targetUserId: created._id, createdAt: now } });
    return { user: publicUser(createdUser), pending: true, error: '账号待管理员审核' };
  }
  await db.collection('auditLogs').add({ data: { action: 'user.configured_admin', userOpenId: openid, targetUserId: created._id, createdAt: now } });
  return { user: publicUser(createdUser), pending: false };
};
