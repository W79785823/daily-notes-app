import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('团队负责人权限模型', () => {
  it('前端新增和编辑成员不再提供管理员选项', () => {
    const forms = read('src/components/management-forms.tsx');
    const addMemberSection = forms.slice(forms.indexOf('export function AddMemberForm'), forms.indexOf('type MemberEditFormProps'));
    const memberEditSection = forms.slice(forms.indexOf('export function MemberEditForm'));

    expect(addMemberSection).toContain('每个团队只保留当前负责人为管理员');
    expect(addMemberSection).toContain('role: \'MEMBER\'');
    expect(addMemberSection).toContain('name="role" value="MEMBER"');
    expect(addMemberSection).not.toContain('<option value="ADMIN">管理员</option>');
    expect(memberEditSection).toContain('readonlyRolePill');
    expect(memberEditSection).not.toContain('<option value="ADMIN">管理员</option>');
  });

  it('后端拒绝新增或修改出第二个管理员，只允许普通成员身份', () => {
    const usersRoute = read('src/app/api/users/route.ts');
    const statusRoute = read('src/app/api/users/[id]/status/route.ts');
    const managePage = read('src/app/manage/page.tsx');

    expect(usersRoute).toContain("parsed.data.role === 'ADMIN'");
    expect(usersRoute).toContain('user.admin_singleton.forbidden');
    expect(statusRoute).toContain("payload.data.role === 'ADMIN'");
    expect(statusRoute).toContain("payload.data.role === 'MEMBER'");
    expect(statusRoute).toContain("updateData.role = 'MEMBER'");
    expect(managePage).toContain('每个团队只保留当前负责人为管理员');
  });
});
