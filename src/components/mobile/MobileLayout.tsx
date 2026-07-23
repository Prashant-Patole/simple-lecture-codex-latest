import { useState, ReactNode } from 'react';
import { HamburgerMenu } from './HamburgerMenu';
import { BottomNav } from './BottomNav';
import { NoticeIconButton } from './NoticeIconButton';
import { NoticeModal } from './NoticeModal';
import { useNotices } from '@/hooks/useNotices';

interface MobileLayoutProps {
  children: ReactNode;
  title: string;
  showNoticeIcon?: boolean;
  showProfile?: boolean;
}

export const MobileLayout = ({
  children,
  title,
  showNoticeIcon = true,
  showProfile = false,
}: MobileLayoutProps) => {
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const { unreadCount } = useNotices();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <HamburgerMenu />
          <h1 className="font-semibold text-lg">{title}</h1>
          {showNoticeIcon ? (
            <NoticeIconButton
              unreadCount={unreadCount}
              onClick={() => setNoticeModalOpen(true)}
            />
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {children}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Notice Modal */}
      <NoticeModal open={noticeModalOpen} onOpenChange={setNoticeModalOpen} />
    </div>
  );
};
