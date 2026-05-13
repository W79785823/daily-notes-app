const app = getApp();
const { callFunction, toastError } = require('../../utils/cloud');
const { taskFlags } = require('../../utils/permissions');

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const PRIORITIES = [
  { value: 'LOW', label: '低优先级', short: '低', icon: '🌿' },
  { value: 'NORMAL', label: '普通', short: '普通', icon: '✨' },
  { value: 'HIGH', label: '重要', short: '重要', icon: '🔥' },
  { value: 'URGENT', label: '紧急', short: '紧急', icon: '⚡' },
];

const CATEGORIES = [
  { value: 'general', label: '日常' },
  { value: 'customer', label: '客户' },
  { value: 'finance', label: '财务' },
  { value: 'ops', label: '运营' },
  { value: 'meeting', label: '会议' },
  { value: 'personal', label: '个人' },
];

const ROLE_LABELS = {
  MEMBER: '成员',
  COLLABORATOR: '成员',
  ADMIN: '管理员',
};

function withRoleLabel(user) {
  return { ...user, roleLabel: ROLE_LABELS[user && user.role] || '成员' };
}

function optionIndex(options, value, fallback = 0) {
  const index = options.findIndex((item) => item.value === value);
  return index >= 0 ? index : fallback;
}

function enrichTask(task, currentDate) {
  const priority = PRIORITIES.find((item) => item.value === (task.priority || 'NORMAL')) || PRIORITIES[1];
  const category = CATEGORIES.find((item) => item.value === (task.category || 'general')) || CATEGORIES[0];
  const overdue = !task.completedAt && task.date < today();
  const dueToday = !task.completedAt && task.date === today();
  return {
    ...task,
    priorityLabel: priority.short,
    priorityIcon: priority.icon,
    priorityClass: `priority-${priority.value.toLowerCase()}`,
    categoryLabel: category.label,
    isOverdue: overdue,
    isToday: dueToday,
    isSelectedDate: task.date === currentDate,
  };
}

Page({
  data: {
    user: null,
    users: [],
    assigneeFilters: [{ name: '全部负责人', openid: '' }],
    tasks: [],
    date: today(),
    status: 'all',
    keyword: '',
    assigneeFilterIndex: 0,
    title: '',
    note: '',
    assigneeIndex: 0,
    priorityIndex: 1,
    categoryIndex: 0,
    priorityOptions: PRIORITIES,
    categoryOptions: CATEGORIES,
    loading: true,
    submitting: false,
    pendingApproval: false,
    announcements: [],
    unreadAnnouncements: 0,
    canCreateAnnouncement: false,
    announcementTitle: '',
    announcementContent: '',
    announcementPinned: false,
    summary: { total: 0, todo: 0, done: 0, mine: 0, urgent: 0, overdue: 0, progress: 0 },
    canCreateTask: false,
    canAssignTask: false,
    canDeleteTask: false,
    canEditAll: false,
    canCompleteOther: false,
    editingTaskId: '',
    editTitle: '',
    editNote: '',
    editDate: '',
    editAssigneeIndex: 0,
    editPriorityIndex: 1,
    editCategoryIndex: 0,
  },

  onShow() {
    this.loginAndLoad();
  },

  async call(name, data = {}) {
    return callFunction(name, data);
  },

  async loginAndLoad() {
    try {
      wx.showLoading({ title: '加载中' });
      const login = await this.call('login');
      const user = withRoleLabel(login.user || {});
      app.globalData.user = user;
      this.setData({
        user,
        pendingApproval: !!login.pending,
        canCreateAnnouncement: !!((user.role === 'ADMIN') || (user.permissions || []).includes('announcement.create')),
        ...taskFlags(user),
      });
      if (login.pending) return;
      await this.loadData();
    } catch (error) {
      toastError(error, '加载失败');
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  async loadData() {
    const selectedAssignee = this.data.assigneeFilters[this.data.assigneeFilterIndex] || { openid: '' };
    const [taskResult, userResult, announcementResult, overdueResult] = await Promise.all([
      this.call('tasks', {
        action: 'list',
        date: this.data.date,
        status: this.data.status,
        keyword: this.data.keyword.trim(),
        assigneeOpenId: selectedAssignee.openid,
      }),
      this.call('users', { action: 'list' }),
      this.call('announcements', { action: 'list' }),
      this.call('tasks', {
        action: 'list',
        status: 'overdue',
        keyword: this.data.keyword.trim(),
        assigneeOpenId: selectedAssignee.openid,
      }),
    ]);
    const users = (userResult.users || []).map(withRoleLabel);
    const tasks = (taskResult.tasks || []).map((task) => enrichTask(task, this.data.date));
    const user = this.data.user || {};
    const total = tasks.length;
    const done = tasks.filter((task) => !!task.completedAt).length;
    const summary = {
      total,
      todo: tasks.filter((task) => !task.completedAt).length,
      done,
      mine: tasks.filter((task) => task.assigneeOpenId === user.openid || task.creatorOpenId === user.openid).length,
      urgent: tasks.filter((task) => ['HIGH', 'URGENT'].includes(task.priority) && !task.completedAt).length,
      overdue: (overdueResult.tasks || []).length,
      progress: total ? Math.round((done / total) * 100) : 0,
    };
    const filters = [{ name: '全部负责人', openid: '' }, ...users.filter((item) => item.openid)];
    const currentFilter = filters.findIndex((item) => item.openid === selectedAssignee.openid);
    const announcements = (announcementResult.announcements || []).map((item) => ({
      ...item,
      isRead: !!item.readAt,
      createdLabel: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
    }));
    this.setData({
      tasks,
      users,
      announcements,
      unreadAnnouncements: announcements.filter((item) => !item.isRead).length,
      assigneeFilters: filters,
      assigneeFilterIndex: Math.max(0, currentFilter),
      summary,
    });
  },

  onDateChange(e) { this.setData({ date: e.detail.value }, () => this.loadData()); },
  onStatusTap(e) { this.setData({ status: e.currentTarget.dataset.status }, () => this.loadData()); },
  onAssigneeChange(e) { this.setData({ assigneeIndex: Number(e.detail.value) }); },
  onPriorityChange(e) { this.setData({ priorityIndex: Number(e.detail.value) }); },
  onCategoryChange(e) { this.setData({ categoryIndex: Number(e.detail.value) }); },
  onFilterAssigneeChange(e) { this.setData({ assigneeFilterIndex: Number(e.detail.value) }, () => this.loadData()); },
  onKeywordInput(e) { this.setData({ keyword: e.detail.value }); },
  searchTasks() { this.loadData(); },
  clearSearch() { this.setData({ keyword: '', assigneeFilterIndex: 0 }, () => this.loadData()); },

  onAnnouncementTitleInput(e) { this.setData({ announcementTitle: e.detail.value }); },
  onAnnouncementContentInput(e) { this.setData({ announcementContent: e.detail.value }); },
  onAnnouncementPinnedChange(e) { this.setData({ announcementPinned: !!e.detail.value.length }); },

  async createAnnouncement() {
    if (this.data.submitting) return;
    const title = this.data.announcementTitle.trim();
    const content = this.data.announcementContent.trim();
    if (!title || !content) return wx.showToast({ title: '请填写公告标题和内容', icon: 'none' });
    try {
      this.setData({ submitting: true });
      await this.call('announcements', { action: 'create', title, content, pinned: this.data.announcementPinned });
      this.setData({ announcementTitle: '', announcementContent: '', announcementPinned: false });
      await this.loadData();
      wx.showToast({ title: '公告已发布' });
    } catch (error) {
      toastError(error, '发布失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async markAnnouncementRead(e) {
    if (this.data.submitting) return;
    const id = e.currentTarget.dataset.id;
    try {
      this.setData({ submitting: true });
      await this.call('announcements', { action: 'markRead', id });
      await this.loadData();
      wx.showToast({ title: '已确认收到' });
    } catch (error) {
      toastError(error, '确认失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async removeAnnouncement(e) {
    if (this.data.submitting) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除公告？',
      content: '删除后团队成员将不再看到这条公告。',
      confirmColor: '#ad4e3f',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          this.setData({ submitting: true });
          await this.call('announcements', { action: 'delete', id });
          await this.loadData();
          wx.showToast({ title: '已删除' });
        } catch (error) {
          toastError(error, '删除失败，请稍后重试');
        } finally {
          this.setData({ submitting: false });
        }
      },
    });
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },
  onEditTitleInput(e) { this.setData({ editTitle: e.detail.value }); },
  onEditNoteInput(e) { this.setData({ editNote: e.detail.value }); },
  onEditDateChange(e) { this.setData({ editDate: e.detail.value }); },
  onEditAssigneeChange(e) { this.setData({ editAssigneeIndex: Number(e.detail.value) }); },
  onEditPriorityChange(e) { this.setData({ editPriorityIndex: Number(e.detail.value) }); },
  onEditCategoryChange(e) { this.setData({ editCategoryIndex: Number(e.detail.value) }); },

  async createTask() {
    if (this.data.submitting) return;
    const title = this.data.title.trim();
    if (!title) return wx.showToast({ title: '请填写事项标题', icon: 'none' });
    const assignee = this.data.users[this.data.assigneeIndex] || this.data.user;
    try {
      this.setData({ submitting: true });
      await this.call('tasks', {
        action: 'create',
        title,
        note: this.data.note,
        date: this.data.date,
        assigneeOpenId: assignee.openid,
        priority: this.data.priorityOptions[this.data.priorityIndex].value,
        category: this.data.categoryOptions[this.data.categoryIndex].value,
      });
      this.setData({ title: '', note: '', priorityIndex: 1, categoryIndex: 0 });
      await this.loadData();
      wx.showToast({ title: '已创建' });
    } catch (error) {
      toastError(error, '创建失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  startEdit(e) {
    const task = e.currentTarget.dataset.task;
    const index = Math.max(0, this.data.users.findIndex((u) => u.openid === task.assigneeOpenId));
    this.setData({
      editingTaskId: task._id,
      editTitle: task.title,
      editNote: task.note || '',
      editDate: task.date,
      editAssigneeIndex: index,
      editPriorityIndex: optionIndex(this.data.priorityOptions, task.priority || 'NORMAL', 1),
      editCategoryIndex: optionIndex(this.data.categoryOptions, task.category || 'general', 0),
    });
  },

  cancelEdit() {
    this.setData({ editingTaskId: '', editTitle: '', editNote: '', editDate: '', editAssigneeIndex: 0, editPriorityIndex: 1, editCategoryIndex: 0 });
  },

  async saveEdit() {
    if (this.data.submitting) return;
    const title = this.data.editTitle.trim();
    if (!title) return wx.showToast({ title: '请填写事项标题', icon: 'none' });
    const assignee = this.data.users[this.data.editAssigneeIndex] || this.data.user;
    try {
      this.setData({ submitting: true });
      await this.call('tasks', {
        action: 'update',
        id: this.data.editingTaskId,
        title,
        note: this.data.editNote,
        date: this.data.editDate,
        assigneeOpenId: assignee.openid,
        priority: this.data.priorityOptions[this.data.editPriorityIndex].value,
        category: this.data.categoryOptions[this.data.editCategoryIndex].value,
      });
      this.cancelEdit();
      await this.loadData();
      wx.showToast({ title: '已保存' });
    } catch (error) {
      toastError(error, '保存失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleComplete(e) {
    if (this.data.submitting) return;
    const task = e.currentTarget.dataset.task;
    try {
      this.setData({ submitting: true });
      await this.call('tasks', { action: 'complete', id: task._id, completed: !task.completedAt });
      await this.loadData();
    } catch (error) {
      toastError(error, '操作失败，请稍后重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  async removeTask(e) {
    if (this.data.submitting) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除事项？',
      content: '删除后不会在列表显示。',
      confirmColor: '#e0574f',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          this.setData({ submitting: true });
          await this.call('tasks', { action: 'delete', id });
          await this.loadData();
        } catch (error) {
          toastError(error, '删除失败，请稍后重试');
        } finally {
          this.setData({ submitting: false });
        }
      },
    });
  },
});
