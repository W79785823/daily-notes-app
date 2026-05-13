import { AnnouncementDeleteButton } from '@/components/announcement-delete-button';
import { cn } from '@/lib/cn';

type Announcement = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: Date;
  author: { name: string };
  canDelete: boolean;
};

type AnnouncementListProps = {
  announcements: Announcement[];
};

export function AnnouncementList({ announcements }: AnnouncementListProps) {
  return (
    <div id="team-announcements" className="workspaceCard announcementCard announcementTop">
      <div className="sectionHead"><div><span className="sectionLabel">NOTICE</span><h2>团队公告</h2></div><span>{announcements.length} 条</span></div>
      <div className="announcementList">
        {announcements.length === 0 && <div className="announcementEmpty">还没有公告。可以发布放假安排、集体工作、临时提醒。</div>}
        {announcements.map((item) => (
          <article key={item.id} className={cn('announcementItem', item.pinned && 'pinnedNotice')}>
            <div className="announcementTitleRow"><strong>{item.title}</strong>{item.pinned && <span>置顶</span>}</div>
            <p>{item.content}</p>
            <footer>
              <small>{item.author.name} · {new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
              {item.canDelete && <AnnouncementDeleteButton id={item.id} title={item.title} />}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
