import { prisma } from '@/lib/db';

const ERROR_MESSAGES: Record<string, string> = {
  'validation.failed': '请完整填写姓名、登录账号和密码。',
  'auth.login_taken': '账号已被使用，请换一个账号。',
  'user.duplicate.forbidden': '姓名或账号已被占用，请换一个再加入。',
  'invite.invalid': '邀请链接无效或已过期。',
  'server.error': '加入失败，请稍后重试。',
};

export default async function JoinPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string }> }) {
  const { code } = await params;
  const query = await searchParams;
  const invite = await prisma.invite.findUnique({ where: { code }, include: { team: true } });
  const now = new Date();
  const invalid = !invite || !invite.team.active || invite.usedCount >= invite.maxUses || (invite.expiresAt && invite.expiresAt <= now);
  if (invalid) {
    return (
      <main className="loginShell">
        <section className="loginCard">
          <div className="loginBrandMark">日事</div>
          <div className="loginKicker">邀请已失效</div>
          <h1>邀请已失效</h1>
          <p>这条邀请链接可能已过期、已被撤销或使用次数已满。请联系团队负责人重新邀请。</p>
          <div className="loginHintBox">如果你已经有账号，可以直接去登录。</div>
          <a className="loginSecondaryLink" href="/login">去登录</a>
        </section>
      </main>
    );
  }
  const errorMessage = query.error ? ERROR_MESSAGES[query.error] || '加入失败，请重试。' : '';

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="loginBrandMark">日事</div>
        <div className="loginKicker">加入团队</div>
        <h1>{invite.team.name}</h1>
        <p>填写你的姓名、登录账号和密码，加入后即可看到团队内分配给你的事项。</p>
        {errorMessage && <div className="loginError"><b>加入失败</b><span>{errorMessage}</span></div>}
        {!errorMessage && <div className="loginHintBox">正在加入：{invite.team.name}。登录账号在整个平台内不能重复。</div>}
        <form className="loginForm" action={`/api/invites/${invite.code}/accept`} method="post">
          <label>你的姓名<input name="displayName" placeholder="姓名" required /></label>
          <label>登录账号<input name="loginName" placeholder="例如 lisi" autoComplete="username" pattern="[a-zA-Z0-9._-]{2,40}" required /></label>
          <label>密码<input name="password" type="password" placeholder="至少 6 位" autoComplete="new-password" minLength={6} required /></label>
          <button>加入团队</button>
        </form>
      </section>
    </main>
  );
}
