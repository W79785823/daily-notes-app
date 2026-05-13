import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('成员权限展开面板视觉优化', () => {
  it('把成员编辑表单拆成摘要、基础信息、账号、权限和保存区域', () => {
    const forms = read('src/components/management-forms.tsx');
    const panels = read('src/components/manage-panels.tsx');

    expect(forms).toContain('polishedMemberEditForm');
    expect(forms).toContain('memberEditOverview');
    expect(forms).toContain('基础信息');
    expect(forms).toContain('登录账号');
    expect(forms).toContain('name="loginName"');
    expect(forms).toContain('未设置登录账号');
    expect(panels).toContain('账号 ${user.loginName}');
    expect(panels).toContain('未设置登录账号');
    expect(forms).toContain('roleExplainCard');
    expect(forms).toContain('事项权限');
    expect(forms).toContain('人员权限');
    expect(forms).toContain('公告权限');
    expect(forms).toContain('groupedPermissionList');
    expect(forms).toContain('额外权限');
    expect(forms).toContain('memberEditFooter');
    expect(forms).toContain('保存成员设置');
  });

  it('提供对应桌面和移动端样式', () => {
    const baseCss = read('src/app/styles/base.css');
    const formsCss = read('src/app/styles/forms.css');

    expect(baseCss).toContain('.polishedMemberEditForm');
    expect(baseCss).toContain('.memberPermissionGrid');
    expect(baseCss).toContain('.permissionGroupCard');
    expect(baseCss).toContain('.roleExplainCard');
    expect(baseCss).toContain('.memberStatusSwitch');
    expect(formsCss).toContain('.memberEditGrid, .memberPermissionGrid { grid-template-columns: 1fr; }');
  });
});
