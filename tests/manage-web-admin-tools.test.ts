import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('管理页网页版关键管理入口', () => {
  it('保留修改密码、邀请/新增成员和人员权限入口，手机端仍可隐藏低频人员列表', () => {
    const managePage = read('src/app/manage/page.tsx');
    const panels = read('src/components/manage-panels.tsx');
    const forms = read('src/components/management-forms.tsx');
    const formsCss = read('src/app/styles/forms.css');

    expect(managePage).toContain('id="account-settings"');
    expect(managePage).toContain('修改密码');
    expect(managePage).toContain('manageAccountCard collapsibleToolCard" open');
    expect(panels).toContain('新增成员');
    expect(panels).toContain('邀请成员');
    expect(forms).toContain('/api/invites');
    expect(forms).toContain('joinUrl');
    expect(panels).toContain('addMemberCard collapsibleToolCard" open');
    expect(panels).toContain('人员与权限');
    expect(formsCss).toContain('.peopleCard,\n  .timelineCard {\n    display: none;\n  }');
  });
});
