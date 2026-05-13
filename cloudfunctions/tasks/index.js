const cloud = require('wx-server-sdk');
const { canAssignTask, canCreateTask, canDeleteTask, canEditTask, canViewTask, canCompleteTask } = require('../common/auth');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const CATEGORIES = ['general', 'customer', 'finance', 'ops', 'meeting', 'personal'];

function cleanPriority(priority) {
  return PRIORITIES.includes(priority) ? priority : 'NORMAL';
}

function cleanCategory(category) {
  return CATEGORIES.includes(category) ? category : 'general';
}

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid, active: true }).limit(1).get();
  return res.data[0] || null;
}

async function userByOpenId(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

function publicTask(task, userMap) {
  return {
    ...task,
    creatorName: userMap[task.creatorOpenId] || '未知',
    assigneeName: userMap[task.assigneeOpenId] || '未知',
  };
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const user = await currentUser(wxContext.OPENID);
  if (!user) return { error: '请先登录' };

  const action = event.action || 'list';
  const tasks = db.collection('tasks');
  const now = new Date();

  if (action === 'list') {
    const date = event.date || new Date().toISOString().slice(0, 10);
    const todayKey = new Date().toISOString().slice(0, 10);
    const status = event.status || 'all';
    const keyword = String(event.keyword || '').trim().toLowerCase();
    const assigneeOpenId = String(event.assigneeOpenId || '').trim();
    const where = status === 'overdue' ? { date: _.lt(todayKey), completedAt: null, deletedAt: null } : { date, deletedAt: null };
    let res = await tasks.where(where).orderBy(status === 'overdue' ? 'date' : 'createdAt', status === 'overdue' ? 'asc' : 'desc').get();
    let list = res.data.filter((task) => canViewTask(user, task));
    if (assigneeOpenId) list = list.filter((task) => task.assigneeOpenId === assigneeOpenId);
    if (keyword) {
      list = list.filter((task) => `${task.title || ''} ${task.note || ''}`.toLowerCase().includes(keyword));
    }
    if (status === 'todo') list = list.filter((task) => !task.completedAt);
    if (status === 'done') list = list.filter((task) => !!task.completedAt);

    const users = await db.collection('users').get();
    const userMap = Object.fromEntries(users.data.map((u) => [u.openid, u.name]));
    return { tasks: list.map((task) => publicTask(task, userMap)) };
  }

  if (action === 'create') {
    const title = String(event.title || '').trim();
    const date = String(event.date || '').trim();
    const assigneeOpenId = String(event.assigneeOpenId || user.openid);
    if (!title || !date) return { error: '事项标题和日期不能为空' };
    if (!canCreateTask(user)) return { error: '没有权限创建事项' };
    if (!canAssignTask(user, assigneeOpenId)) return { error: '没有权限指派给他人' };
    const assignee = await userByOpenId(assigneeOpenId);
    if (!assignee || assignee.active === false) return { error: '负责人不存在或已停用' };

    const created = await tasks.add({
      data: {
        title,
        note: event.note || '',
        priority: cleanPriority(event.priority),
        category: cleanCategory(event.category),
        date,
        creatorOpenId: user.openid,
        assigneeOpenId,
        completedAt: null,
        completedByOpenId: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    await db.collection('auditLogs').add({ data: { action: 'task.create', userOpenId: user.openid, taskId: created._id, createdAt: now } });
    return { taskId: created._id };
  }

  if (action === 'complete') {
    const task = await tasks.doc(event.id).get().then((r) => r.data).catch(() => null);
    if (!task || task.deletedAt) return { error: '事项不存在' };
    if (!canCompleteTask(user, task)) return { error: '没有权限完成该事项' };
    const done = event.completed !== false;
    await tasks.doc(event.id).update({
      data: done ? { completedAt: now, completedByOpenId: user.openid, updatedAt: now } : { completedAt: null, completedByOpenId: null, updatedAt: now },
    });
    await db.collection('auditLogs').add({ data: { action: done ? 'task.complete' : 'task.reopen', userOpenId: user.openid, taskId: event.id, createdAt: now } });
    return { ok: true };
  }

  if (action === 'update') {
    const task = await tasks.doc(event.id).get().then((r) => r.data).catch(() => null);
    if (!task || task.deletedAt) return { error: '事项不存在' };
    if (!canEditTask(user, task)) return { error: '没有权限编辑该事项' };

    const data = { updatedAt: now };
    if (event.title !== undefined) {
      const title = String(event.title || '').trim();
      if (!title) return { error: '事项标题不能为空' };
      data.title = title;
    }
    if (event.note !== undefined) data.note = String(event.note || '').trim();
    if (event.priority !== undefined) data.priority = cleanPriority(event.priority);
    if (event.category !== undefined) data.category = cleanCategory(event.category);
    if (event.date !== undefined) {
      const date = String(event.date || '').trim();
      if (!date) return { error: '日期不能为空' };
      data.date = date;
    }
    if (event.assigneeOpenId !== undefined) {
      const assigneeOpenId = String(event.assigneeOpenId || '').trim();
      if (!assigneeOpenId) return { error: '负责人不能为空' };
      if (assigneeOpenId !== task.assigneeOpenId && !canAssignTask(user, assigneeOpenId)) return { error: '没有权限指派给他人' };
      const assignee = await userByOpenId(assigneeOpenId);
      if (!assignee || assignee.active === false) return { error: '负责人不存在或已停用' };
      data.assigneeOpenId = assigneeOpenId;
    }

    await tasks.doc(event.id).update({ data });
    await db.collection('auditLogs').add({ data: { action: 'task.update', userOpenId: user.openid, taskId: event.id, createdAt: now } });
    return { ok: true };
  }

  if (action === 'delete') {
    const task = await tasks.doc(event.id).get().then((r) => r.data).catch(() => null);
    if (!task || task.deletedAt) return { error: '事项不存在' };
    if (!canDeleteTask(user)) return { error: '没有权限删除事项' };
    await tasks.doc(event.id).update({ data: { deletedAt: now, updatedAt: now } });
    await db.collection('auditLogs').add({ data: { action: 'task.delete', userOpenId: user.openid, taskId: event.id, createdAt: now } });
    return { ok: true };
  }

  return { error: '未知操作' };
};
