import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('每日提醒脚本多团队化', () => {
  it('只遍历启用团队并按 teamId 加载事项', () => {
    const script = read('scripts/daily-reminder.js');

    expect(script).toContain('prisma.team.findMany');
    expect(script).toContain('active: true');
    expect(script).toContain('prisma.task.findMany');
    expect(script).toContain('teamId');
    expect(script).toContain('buildTeamDailyReminders');
    expect(script).not.toContain('prisma.task.findMany({\n    where: { deletedAt: null }');
  });
});
