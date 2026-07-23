import { ArrowLeft, Users, MoreVertical, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { GroupDetails } from '@/hooks/useGroupChat';

interface GroupChatHeaderProps {
  group: GroupDetails;
  onBack: () => void;
  onInfoClick: () => void;
}

export function GroupChatHeader({ group, onBack, onInfoClick }: GroupChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <div 
        className="flex items-center gap-3 flex-1 cursor-pointer"
        onClick={onInfoClick}
      >
        <Avatar className="h-10 w-10 bg-primary/10">
          {group.avatar_url && (
            <AvatarImage src={group.avatar_url} alt={group.name} className="object-cover" />
          )}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {group.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold truncate">{group.name}</h1>
            {group.is_private && (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
            {group.subject && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs py-0">
                  {group.subject.name}
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={onInfoClick}>
        <MoreVertical className="h-5 w-5" />
      </Button>
    </div>
  );
}
