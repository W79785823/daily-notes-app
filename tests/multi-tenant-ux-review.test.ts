import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('多租户 UX review 优化项', () => {
  it('邀请闭环支持复制、有效期、列表和撤销', () => {
    const forms = read('src/components/management-forms.tsx');
    const panels = read('src/components/manage-panels.tsx');
    const inviteRoute = read('src/app/api/invites/route.ts');
    const revokeRoute = read('src/app/api/invites/[code]/route.ts');

    expect(forms).toContain('navigator.clipboard.writeText');
    expect(forms).toContain('有效期');
    expect(forms).toContain('7 天');
    expect(forms).toContain('有效邀请');
    expect(forms).toContain('已复制');
    expect(forms).toContain("method: 'DELETE'");
    expect(panels).toContain('发链接给对方，对方自己设密码加入');
    expect(panels).toContain('你帮成员设好初始密码，再把账号密码发给他');
    expect(inviteRoute).toContain('defaultInviteExpiry');
    expect(revokeRoute).toContain('invite.revoke');
  });

  it('注册、登录、加入和停用提示使用面向用户的文案', () => {
    const loginPage = read('src/app/login/page.tsx');
    const registerPage = read('src/app/register/page.tsx');
    const joinPage = read('src/app/join/[code]/page.tsx');
    const homePage = read('src/app/page.tsx');
    const managePage = read('src/app/manage/page.tsx');

    expect(loginPage).toContain('还没有团队？点下方「创建新团队」');
    expect(loginPage).not.toContain('外层访问密码');
    expect(registerPage).toContain('每人一个账号、对应一个团队');
    expect(registerPage).toContain('团队里显示的名字，可用中文');
    expect(registerPage).toContain('登录用，全平台唯一，仅字母数字');
    expect(joinPage).toContain('邀请已失效');
    expect(joinPage).toContain('联系团队负责人重新邀请');
    expect(joinPage).toContain('正在加入');
    expect(joinPage).not.toContain('已使用');
    expect(homePage).toContain('auth.team_suspended');
    expect(managePage).toContain('auth.team_suspended');
  });

  it('超管台中文化并对高影响操作二次确认', () => {
    const adminPage = read('src/app/admin/page.tsx');
    const actionForm = read('src/components/admin-team-action-form.tsx');

    expect(adminPage).toContain('平台管理');
    expect(adminPage).toContain('使用中');
    expect(adminPage).toContain('已停用');
    expect(adminPage).not.toContain('PLATFORM');
    expect(adminPage).not.toContain('ACTIVE');
    expect(adminPage).not.toContain('SUSPENDED');
    expect(actionForm).toContain('确定停用');
    expect(actionForm).toContain('所有成员将无法登录');
  });

  it('新团队空状态引导负责人邀请第一位成员', () => {
    const homePage = read('src/app/page.tsx');

    expect(homePage).toContain('teamOnboardingCard');
    expect(homePage).toContain('邀请第一位成员');
    expect(homePage).toContain('/manage#member-invites');
  });

  it('超管密码示例强调不要把真实密码写入 env 文件', () => {
    const envExample = read('.env.example');
    const docs = read('docs/database-migrations.md');

    expect(envExample).toContain('不要把真实超管密码写进 .env');
    expect(docs).toContain('不要把真实超管密码写入 .env');
  });
});
