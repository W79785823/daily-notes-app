'use client';

export function AdminTeamActionForm({ teamId, teamName, active }: { teamId: string; teamName: string; active: boolean }) {
  const action = active ? 'suspend' : 'reactivate';
  const label = active ? '停用团队' : '恢复团队';
  const className = active ? 'smallWarningButton' : 'fullButton';

  return (
    <form
      action={`/api/admin/teams/${teamId}/${action}`}
      method="post"
      onSubmit={(event) => {
        if (!active) return;
        if (!window.confirm(`确定停用「${teamName}」？该团队所有成员将无法登录。`)) event.preventDefault();
      }}
    >
      <button className={className}>{label}</button>
    </form>
  );
}
