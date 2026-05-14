import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('src/components/task-focus-panel.tsx', 'utf8');
const auth = readFileSync('src/lib/auth.ts', 'utf8');

describe('查看全部权限不会泄漏删除入口', () => {
  it('刷新接口返回的 canDelete 必须直接来自后端权限，不能用 fallback 旧权限', () => {
    expect(panel).toContain('canDelete: Boolean(task.canDelete)');
    expect(panel).not.toContain('canDelete: fallback?.canDelete ?? Boolean(task.canDelete)');
  });

  it('删除事项只能由 task.delete 权限控制，不能因为是创建人就放行', () => {
    const deleteCase = auth.slice(auth.indexOf("case 'delete':"), auth.indexOf("case 'complete':"));

    expect(deleteCase).toContain("hasPermission(user, 'task.delete')");
    expect(deleteCase).not.toContain('task.creatorId === user.id');
  });
});
