const { callFunction, toastError } = require('../../utils/cloud');
const { userFlags } = require('../../utils/permissions');

const ROLE_OPTIONS = [
  { value: 'MEMBER', label: '成员' },
  { value: 'ADMIN', label: '管理员' },
];

function roleLabel(role) {
  const option = ROLE_OPTIONS.find((item) => item.value === role);
  return option ? option.label : '成员';
}

function decorateUser(user) {
  const name = user && user.name ? user.name : '成员';
  return { ...user, name, roleLabel: roleLabel(user && user.role), avatarText: name.slice(0, 1) };
}

Page({
  data: {
    user: null,
    users: [],
    roleOptions: ROLE_OPTIONS,
    permissionOptions: [
      { key: 'task.create', label: '创建事项' },
      { key: 'task.assign', label: '指派他人' },
      { key: 'task.view_all', label: '查看全部事项' },
      { key: 'task.edit_all', label: '编辑全部事项' },
      { key: 'task.delete', label: '删除事项' },
      { key: 'task.complete_other', label: '完成他人事项' },
      { key: 'announcement.create', label: '发布公告' },
      { key: 'user.manage', label: '管理人员' },
      { key: 'permission.manage', label: '管理权限' },
    ],
    activeCount: 0,
    boundCount: 0,
    pendingCount: 0,
    expandedUserId: '',
    editingUserId: '',
    editingTargetActive: true,
    editName: '',
    editRoleIndex: 0,
    editPermissions: [],
    submitting: false,
    canManageUsers: false,
    canManagePermissions: false,
  },

  onShow() { this.load(); },

  async call(name, data = {}) {
    return callFunction(name, data);
  },

  async load() {
    try {
      const login = await this.call('login');
      const currentUser = decorateUser(login.user || {});
      if (login.pending) {
        this.setData({ user: currentUser, users: [] });
        wx.showToast({ title: '账号待管理员审核', icon: 'none' });
        return;
      }
      const result = await this.call('users', { action: 'list' });
      const list = (result.users || []).map(decorateUser);
      this.setData({
        user: currentUser,
        users: list,
        activeCount: list.filter((item) => item.active).length,
        boundCount: list.filter((item) => item.openid).length,
        pendingCount: list.filter((item) => item.active === false).length,
        ...userFlags(login.user),
      });
    } catch (error) {
      toastError(error, '加载失败');
    }
  },

  onEditNameInput(e) { this.setData({ editName: e.detail.value }); },
  onEditRoleChange(e) { this.setData({ editRoleIndex: Number(e.detail.value) }); },
  onEditPermissionsChange(e) { this.setData({ editPermissions: e.detail.value }); },

  toggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedUserId: this.data.expandedUserId === id ? '' : id });
  },

  startEdit(e) {
    const item = e.currentTarget.dataset.user;
    const roleIndex = item.role === 'ADMIN' ? 1 : 0;
    this.setData({ editingUserId: item._id, editingTargetActive: item.active !== false, editName: item.name, editRoleIndex: roleIndex, editPermissions: item.permissions || [] });
  },

  cancelEdit() {
    this.setData({ editingUserId: '', expandedUserId: '', editingTargetActive: true, editName: '', editRoleIndex: 0, editPermissions: [] });
  },

  async reviewUser() {
    if (this.data.submitting) return;
    const name = this.data.editName.trim();
    if (!name) return wx.showToast({ title: '请填写姓名', icon: 'none' });
    try {
      this.setData({ submitting: true });
      await this.call('users', {
        action: 'review',
        id: this.data.editingUserId,
        name,
        role: this.data.roleOptions[this.data.editRoleIndex].value,
        permissions: this.data.editPermissions,
      });
      this.cancelEdit();
      await this.load();
      wx.showToast({ title: '已通过审核' });
    } catch (error) {
      toastError(error, '审核失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async saveEdit() {
    if (this.data.submitting) return;
    const name = this.data.editName.trim();
    if (!name) return wx.showToast({ title: '请填写姓名', icon: 'none' });
    try {
      this.setData({ submitting: true });
      await this.call('users', {
        action: 'update',
        id: this.data.editingUserId,
        name,
        role: this.data.roleOptions[this.data.editRoleIndex].value,
        permissions: this.data.editPermissions,
      });
      this.cancelEdit();
      await this.load();
      wx.showToast({ title: '已保存' });
    } catch (error) {
      toastError(error, '保存失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleActive(e) {
    if (this.data.submitting) return;
    const item = e.currentTarget.dataset.user;
    try {
      this.setData({ submitting: true });
      await this.call('users', { action: 'setActive', id: item._id, active: !item.active });
      await this.load();
      wx.showToast({ title: item.active ? '已停用' : '已启用' });
    } catch (error) {
      toastError(error, '操作失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async bindSelf(e) {
    if (this.data.submitting) return;
    const item = e.currentTarget.dataset.user;
    try {
      this.setData({ submitting: true });
      await this.call('users', { action: 'bindSelf', id: item._id });
      await this.load();
      wx.showToast({ title: '已绑定' });
    } catch (error) {
      toastError(error, '绑定失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async unbind(e) {
    if (this.data.submitting) return;
    const item = e.currentTarget.dataset.user;
    wx.showModal({
      title: '解绑微信？',
      content: `确定解绑 ${item.name} 的微信吗？`,
      confirmColor: '#ad4e3f',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          this.setData({ submitting: true });
          await this.call('users', { action: 'unbind', id: item._id });
          await this.load();
          wx.showToast({ title: '已解绑' });
        } catch (error) {
          toastError(error, '解绑失败，请稍后重试');
        } finally {
          this.setData({ submitting: false });
        }
      },
    });
  },
});
