import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSearchUsers, useAddMember } from '@/hooks/useGroupChat';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  existingMemberIds: string[];
}

export function AddMemberDialog({
  open,
  onOpenChange,
  groupId,
  existingMemberIds,
}: AddMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  const { data: users, isLoading } = useSearchUsers(debouncedQuery);
  const addMember = useAddMember();

  const handleAddMember = async (userId: string) => {
    await addMember.mutateAsync({ groupId, userId });
    setAddedIds(prev => new Set(prev).add(userId));
  };

  const filteredUsers = users?.filter(
    (user: any) => !existingMemberIds.includes(user.id)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && searchQuery.length < 2 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          )}

          {!isLoading && searchQuery.length >= 2 && filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">No users found</p>
            </div>
          )}

          <div className="space-y-2">
            {filteredUsers.map((user: any) => {
              const isAdded = addedIds.has(user.id);
              const isAlreadyMember = existingMemberIds.includes(user.id);

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>
                      {(user.full_name || user.email || 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {user.full_name || 'No Name'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>

                  {isAdded || isAlreadyMember ? (
                    <Button variant="outline" size="sm" disabled>
                      <Check className="h-4 w-4 mr-1" />
                      Added
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAddMember(user.id)}
                      disabled={addMember.isPending}
                    >
                      {addMember.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
