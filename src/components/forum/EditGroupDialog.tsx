import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { GroupImageUpload } from './GroupImageUpload';
import { useUpdateGroup } from '@/hooks/useForumGroups';
import { Loader2 } from 'lucide-react';

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  currentName: string;
  currentDescription: string | null;
  currentAvatarUrl: string | null;
}

export function EditGroupDialog({
  open,
  onOpenChange,
  groupId,
  currentName,
  currentDescription,
  currentAvatarUrl,
}: EditGroupDialogProps) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  
  const updateGroup = useUpdateGroup();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(currentName);
      setDescription(currentDescription || '');
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
    }
  }, [open, currentName, currentDescription]);

  const handleImageChange = (file: File | null, preview: string | null) => {
    setAvatarFile(file);
    setAvatarPreview(preview);
    setRemoveAvatar(false);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    await updateGroup.mutateAsync({
      groupId,
      name: name.trim(),
      description: description.trim() || null,
      avatarFile: avatarFile || undefined,
      removeAvatar,
      currentAvatarUrl,
    });

    onOpenChange(false);
  };

  const hasChanges = 
    name !== currentName || 
    description !== (currentDescription || '') || 
    avatarFile !== null || 
    removeAvatar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-2">
            <GroupImageUpload
              value={removeAvatar ? null : (avatarPreview || currentAvatarUrl)}
              onChange={handleImageChange}
              onRemove={handleRemoveAvatar}
              size="lg"
              groupName={name}
              showRemoveButton={!!(avatarPreview || (currentAvatarUrl && !removeAvatar))}
            />
            <p className="text-xs text-muted-foreground">
              Click to change group photo
            </p>
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the group..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={updateGroup.isPending || !name.trim() || !hasChanges}
          >
            {updateGroup.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
