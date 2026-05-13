import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/api';
import { verifySessionToken } from '@/lib/session';

const ERROR_MESSAGES: Record<string, string> = {
  'auth.required': '请登录后继续使用。',
  'auth.failed': '账号或密码不正确，或账号已停用。',
  'auth.locked': '登录失败次数过多，请稍后再试。',
  'validation.failed': '请填写账号和密码。',
  'server.error': '登录失败，请稍后重试。',
};

const OK_MESSAGES: Record<string, string> = {
  'password.changed': '密码已修改，请用新密码重新登录。',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; redirectTo?: string }> }) {
  const params = await searchParams;
  const session = verifySessionToken((await cookies()).get('daily_notes_session')?.value);
  if (session?.userId) {
    const user = await getCurrentUser(session.userId);
    if (user?.active) redirect('/');
  }
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] || '登录失败，请重试。' : '';
  const okMessage = params.ok ? OK_MESSAGES[params.ok] || '操作成功。' : '';
  const redirectTo = params.redirectTo?.startsWith('/') ? params.redirectTo : '/';

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="loginBrandMark">日事</div>
        <div className="loginKicker">每日事项工作台</div>
        <h1>每日事项</h1>
        <p>登录后查看今天的事项、负责人和团队公告。账号由管理员统一分配。</p>
        {errorMessage && <div className="loginError"><b>需要登录</b><span>{errorMessage}</span></div>}
        {okMessage && <div className="loginSuccess"><b>已更新</b><span>{okMessage}</span></div>}
        {!errorMessage && !okMessage && <div className="loginHintBox">输入账号密码即可进入，不需要外层访问密码。</div>}
        <form className="loginForm" action="/api/auth/login" method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label>账号<input name="loginName" placeholder="请输入账号" autoComplete="username" required /></label>
          <label>密码<input name="password" type="password" placeholder="请输入密码" autoComplete="current-password" required /></label>
          <button>进入工作台</button>
        </form>
      </section>
    </main>
  );
}
