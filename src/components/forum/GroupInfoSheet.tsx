import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  useGroupMembers, 
  useRemoveMember, 
  useUpdateMemberRole,
  GroupDetails,
} from '@/hooks/useGroupChat';
import { useLeaveGroup } from '@/hooks/useForumGroups';
import { AddMemberDialog } from './AddMemberDialog';
import { EditGroupDialog } from './EditGroupDialog';
import { 
  Users, 
  Lock, 
  Globe, 
  MoreVertical, 
  UserPlus, 
  Crown, 
  Shield, 
  LogOut,
  UserMinus,
  ShieldPlus,
  ShieldMinus,
  Pencil,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface GroupInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  group: GroupDetails;
  isAdmin: boolean;
  isCreator: boolean;
  currentUserId: string;
}

export function GroupInfoSheet({
  open,
  onOpenChange,
  groupId,
  group,
  isAdmin,
  isCreator,
  currentUserId,
}: GroupInfoSheetProps) {
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const { data: members, isLoading } = useGroupMembers(groupId);
  const removeMember = useRemoveMember();
  const updateRole = useUpdateMemberRole();
  const leaveGroup = useLeaveGroup();
  const navigate = useNavigate();

  const handleLeaveGroup = async () => {
    await leaveGroup.mutateAsync(groupId);
    onOpenChange(false);
    navigate('/forum');
  };

  const handleRemoveMember = (userId: string, memberName: string) => {
    removeMember.mutate({ groupId, userId, memberName });
  };

  const handleToggleAdmin = (userId: string, currentRole: string, memberName: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    updateRole.mutate({ groupId, userId, newRole, memberName });
  };

  const sortedMembers = [...(members || [])].sort((a, b) => {
    // Creator first
    if (a.user_id === group.created_by) return -1;
    if (b.user_id === group.created_by) return 1;
    // Then admins
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return 0;
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 pb-0">
            <div className="flex flex-col items-center gap-4">
              {/* Group Avatar with Edit Button */}
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  {group.avatar_url ? (
                    <AvatarImage src={group.avatar_url} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-semibold">
                    {group.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                    onClick={() => setEditGroupOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <SheetTitle className="text-xl">{group.name}</SheetTitle>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setEditGroupOpen(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {group.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {group.description}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2 mt-2">
                  {group.is_private ? (
                    <Badge variant="secondary">
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Globe className="h-3 w-3 mr-1" />
                      Public
                    </Badge>
                  )}
                  {group.subject && (
                    <Badge>{group.subject.name}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Created {format(new Date(group.created_at), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </SheetHeader>

          <Separator className="my-4" />

          {/* Members section */}
          <div className="flex-1 flex flex-col min-h-0 px-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">
                  {members?.length || 0} Members
                </span>
              </div>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAddMemberOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {sortedMembers.map((member) => {
                  const isCurrentUser = member.user_id === currentUserId;
                  const isMemberCreator = member.user_id === group.created_by;
                  const isMemberAdmin = member.role === 'admin';
                  const canManage = isAdmin && !isMemberCreator && !isCurrentUser;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {(member.profile?.full_name || 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {member.profile?.full_name || 'Unknown'}
                          </span>
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground">(You)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isMemberCreator && (
                            <Badge variant="default" className="text-xs py-0 h-5">
                              <Crown className="h-3 w-3 mr-1" />
                              Creator
                            </Badge>
                          )}
                          {!isMemberCreator && isMemberAdmin && (
                            <Badge variant="secondary" className="text-xs py-0 h-5">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleToggleAdmin(
                                member.user_id, 
                                member.role, 
                                member.profile?.full_name || 'User'
                              )}
                            >
                              {isMemberAdmin ? (
                                <>
                                  <ShieldMinus className="h-4 w-4 mr-2" />
                                  Remove Admin
                                </>
                              ) : (
                                <>
                                  <ShieldPlus className="h-4 w-4 mr-2" />
                                  Make Admin
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(
                                member.user_id,
                                member.profile?.full_name || 'User'
                              )}
                              className="text-destructive"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove from Group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Separator className="my-4" />

          {/* Leave group button */}
          {!isCreator && (
            <div className="p-4 pt-0">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleLeaveGroup}
                disabled={leaveGroup.isPending}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave Group
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        groupId={groupId}
        existingMemberIds={members?.map(m => m.user_id) || []}
      />

      <EditGroupDialog
        open={editGroupOpen}
        onOpenChange={setEditGroupOpen}
        groupId={groupId}
        currentName={group.name}
        currentDescription={group.description}
        currentAvatarUrl={group.avatar_url || null}
      />
    </>
  );
}
