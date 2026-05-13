const cloud = require('wx-server-sdk');
const { hasPermission } = require('../common/auth');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid, active: true }).limit(1).get();
  return res.data[0] || null;
}

async function userNameMap() {
  const res = await db.collection('users').get();
  return Object.fromEntries(res.data.map((u) => [u.openid, u.name]));
}

async function readMapFor(openid) {
  const res = await db.collection('announcementReads').where({ openid }).get();
  return Object.fromEntries(res.data.map((item) => [item.announcementId, item]));
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const user = await currentUser(openid);
  if (!user) return { error: '请先登录' };

  const action = event.action || 'list';
  const announcements = db.collection('announcements');
  const now = new Date();

  if (action === 'list') {
    const res = await announcements.where({ deletedAt: null }).orderBy('pinned', 'desc').orderBy('createdAt', 'desc').limit(20).get();
    const names = await userNameMap();
    const reads = await readMapFor(openid);
    return {
      announcements: res.data.map((item) => ({
        ...item,
        authorName: names[item.authorOpenId] || '管理员',
        readAt: reads[item._id] && reads[item._id].readAt,
        readId: reads[item._id] && reads[item._id]._id,
      })),
    };
  }

  if (action === 'create') {
    if (!hasPermission(user, 'announcement.create')) return { error: '没有权限发布公告' };
    const title = String(event.title || '').trim();
    const content = String(event.content || '').trim();
    if (!title || !content) return { error: '公告标题和内容不能为空' };
    const created = await announcements.add({
      data: {
        title,
        content,
        pinned: !!event.pinned,
        authorOpenId: openid,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    await db.collection('auditLogs').add({ data: { action: 'announcement.create', userOpenId: openid, announcementId: created._id, createdAt: now } });
    return { announcementId: created._id };
  }

  if (action === 'markRead') {
    const id = String(event.id || '');
    if (!id) return { error: '公告 ID 不能为空' };
    const target = await announcements.doc(id).get().then((r) => r.data).catch(() => null);
    if (!target || target.deletedAt) return { error: '公告不存在' };
    const existing = await db.collection('announcementReads').where({ announcementId: id, openid }).limit(1).get();
    if (existing.data.length) {
      await db.collection('announcementReads').doc(existing.data[0]._id).update({ data: { readAt: now, updatedAt: now } });
    } else {
      await db.collection('announcementReads').add({ data: { announcementId: id, openid, userName: user.name, readAt: now, createdAt: now, updatedAt: now } });
    }
    await db.collection('auditLogs').add({ data: { action: 'announcement.read', userOpenId: openid, announcementId: id, createdAt: now } });
    return { ok: true };
  }

  if (action === 'delete') {
    const id = String(event.id || '');
    if (!id) return { error: '公告 ID 不能为空' };
    const target = await announcements.doc(id).get().then((r) => r.data).catch(() => null);
    if (!target || target.deletedAt) return { error: '公告不存在' };
    const canDelete = user.role === 'ADMIN' || hasPermission(user, 'announcement.create') || target.authorOpenId === openid;
    if (!canDelete) return { error: '没有权限删除公告' };
    await announcements.doc(id).update({ data: { deletedAt: now, updatedAt: now } });
    await db.collection('auditLogs').add({ data: { action: 'announcement.delete', userOpenId: openid, announcementId: id, createdAt: now } });
    return { ok: true };
  }

  return { error: '未知操作' };
};
