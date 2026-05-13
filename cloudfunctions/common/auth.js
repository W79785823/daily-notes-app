const ROLE_PERMISSIONS = {
  MEMBER: ['task.create'],
  COLLABORATOR: ['task.create'],
  ADMIN: ['task.create', 'task.assign', 'task.view_all', 'task.edit_all', 'task.delete', 'task.complete_other', 'announcement.create', 'user.manage', 'permission.manage'],
};

function permissionsOf(user) {
  return new Set([...(ROLE_PERMISSIONS[user.role] || []), ...(user.permissions || [])]);
}

function hasPermission(user, permission) {
  if (!user || user.active === false) return false;
  return permissionsOf(user).has(permission);
}

function canCreateTask(user) {
  return hasPermission(user, 'task.create');
}

function canAssignTask(user, assigneeOpenId) {
  return user && (user.openid === assigneeOpenId || hasPermission(user, 'task.assign'));
}

function canManageUsers(user) {
  return hasPermission(user, 'user.manage');
}

function canViewTask(user, task) {
  return hasPermission(user, 'task.view_all') || task.creatorOpenId === user.openid || task.assigneeOpenId === user.openid;
}

function canCompleteTask(user, task) {
  return task.assigneeOpenId === user.openid || hasPermission(user, 'task.complete_other');
}

function canEditTask(user, task) {
  return hasPermission(user, 'task.edit_all') || task.creatorOpenId === user.openid;
}

function canDeleteTask(user) {
  return hasPermission(user, 'task.delete');
}

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission,
  canCreateTask,
  canAssignTask,
  canManageUsers,
  canViewTask,
  canCompleteTask,
  canEditTask,
  canDeleteTask,
};
