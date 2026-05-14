import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('src/components/task-focus-panel.tsx', 'utf8');
const auth = readFileSync('src/lib/auth.ts', 'utf8');
const permissions = readFileSync('src/lib/permissions.ts', 'utf8');
const managementForms = readFileSync('src/components/management-forms.tsx', 'utf8');
const managePanels = readFileSync('src/components/manage-panels.tsx', 'utf8');

describe('查看全部权限不会泄漏编辑/删除别人事项入口', () => {
  it('刷新接口返回的操作按钮权限必须直接来自后端，不能用 fallback 旧权限', () => {
    expect(panel).toContain('canEdit: Boolean(task.canEdit)');
    expect(panel).toContain('canDelete: Boolean(task.canDelete)');
    expect(panel).not.toContain('canEdit: fallback?.canEdit ?? Boolean(task.canEdit)');
    expect(panel).not.toContain('canDelete: fallback?.canDelete ?? Boolean(task.canDelete)');
  });

  it('编辑和删除都只跟创建人有关，不再有额外权限点', () => {
    const editCase = auth.slice(auth.indexOf("case 'edit':"), auth.indexOf("case 'delete':"));
    const deleteCase = auth.slice(auth.indexOf("case 'delete':"), auth.indexOf("case 'complete':"));

    expect(editCase).toContain('task.creatorId === user.id');
    expect(deleteCase).toContain('task.creatorId === user.id');
    expect(auth).not.toContain("'task.edit_all'");
    expect(auth).not.toContain("'task.delete'");
  });

  it('权限设置里不再展示编辑全部和删除事项', () => {
    expect(permissions).not.toContain("'task.edit_all'");
    expect(permissions).not.toContain("'task.delete'");
    expect(permissions).not.toContain("'task.complete_other'");
    expect(managementForms).not.toContain('task.edit_all');
    expect(managementForms).not.toContain('task.delete');
    expect(managementForms).not.toContain('task.complete_other');
    expect(managePanels).not.toContain('编辑全部事项');
    expect(managePanels).not.toContain('完成他人事项');
  });
});
