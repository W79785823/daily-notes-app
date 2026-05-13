const ROLE_PERMISSIONS = {
  MEMBER: ['task.create'],
  COLLABORATOR: ['task.create'],
  ADMIN: ['task.create', 'task.assign', 'task.view_all', 'task.edit_all', 'task.delete', 'task.complete_other', 'announcement.create', 'user.manage', 'permission.manage'],
};

function permissionsOf(user) {
  return new Set([...(ROLE_PERMISSIONS[user && user.role] || []), ...((user && user.permissions) || [])]);
}

function can(user, permission) {
  return permissionsOf(user).has(permission);
}

function taskFlags(user) {
  return {
    canCreateTask: can(user, 'task.create'),
    canAssignTask: can(user, 'task.assign'),
    canDeleteTask: can(user, 'task.delete'),
    canEditAll: can(user, 'task.edit_all'),
    canCompleteOther: can(user, 'task.complete_other'),
    canCreateAnnouncement: can(user, 'announcement.create'),
  };
}

function userFlags(user) {
  return {
    canManageUsers: can(user, 'user.manage'),
    canManagePermissions: can(user, 'permission.manage'),
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  permissionsOf,
  can,
  taskFlags,
  userFlags,
};
