export default function OfflinePage() {
  return (
    <main className="shell">
      <section className="workspaceCard">
        <span className="sectionLabel">OFFLINE</span>
        <h1>当前离线</h1>
        <p>网络暂时不可用。你可以稍后重试，或者在恢复网络后继续查看事项。</p>
        <a className="fullButton" href="/">返回首页</a>
      </section>
    </main>
  );
}
