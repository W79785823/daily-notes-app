const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const now = new Date();
  const users = db.collection('users');
  const count = await users.count();
  if (count.total > 0) return { ok: true, skipped: true };

  await users.add({ data: { openid: null, name: '管理员', role: 'ADMIN', permissions: [], active: true, createdAt: now, updatedAt: now } });
  await users.add({ data: { openid: null, name: '张三', role: 'MEMBER', permissions: [], active: true, createdAt: now, updatedAt: now } });
  await users.add({ data: { openid: null, name: '李四', role: 'COLLABORATOR', permissions: [], active: true, createdAt: now, updatedAt: now } });
  return { ok: true };
};
