import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/api';
import { isSessionFreshForUser, verifySessionToken } from '@/lib/session';

const ERROR_MESSAGES: Record<string, string> = {
  'validation.failed': '请完整填写团队名称、姓名、账号和密码。',
  'auth.login_taken': '账号已被使用，请换一个账号。',
  'server.error': '注册失败，请稍后重试。',
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const session = verifySessionToken((await cookies()).get('daily_notes_session')?.value);
  if (session?.userId) {
    const user = await getCurrentUser(session.userId);
    if (user?.active && isSessionFreshForUser(session, user.sessionVersion) && (user.isSuperAdmin || (user.team && user.team.active))) {
      redirect(user.isSuperAdmin ? '/admin' : '/');
    }
  }
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] || '注册失败，请重试。' : '';

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="loginBrandMark">日事</div>
        <div className="loginKicker">创建团队</div>
        <h1>注册团队</h1>
        <p>负责人创建团队后会自动成为管理员，可以继续邀请成员加入。</p>
        {errorMessage && <div className="loginError"><b>注册失败</b><span>{errorMessage}</span></div>}
        {!errorMessage && <div className="loginHintBox">每人一个账号、对应一个团队；登录账号在整个平台内不能重复（建议用拼音或工号）。</div>}
        <form className="loginForm" action="/api/auth/register" method="post">
          <label>团队名称<input name="teamName" placeholder="例如 运营一组" required /></label>
          <label>你的姓名<small>团队里显示的名字，可用中文。</small><input name="displayName" placeholder="负责人姓名" required /></label>
          <label>登录账号<small>登录用，全平台唯一，仅字母数字。</small><input name="loginName" placeholder="例如 zhangsan" autoComplete="username" pattern="[a-zA-Z0-9._-]{2,40}" required /></label>
          <label>密码<input name="password" type="password" placeholder="至少 6 位" autoComplete="new-password" minLength={6} required /></label>
          <button>创建团队</button>
        </form>
        <a className="loginSecondaryLink" href="/login">已有账号，去登录</a>
      </section>
    </main>
  );
}
