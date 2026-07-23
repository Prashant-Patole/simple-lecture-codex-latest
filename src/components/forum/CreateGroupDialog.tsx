import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateForumGroup } from '@/hooks/useForumGroups';
import { GroupImageUpload } from './GroupImageUpload';
import { Loader2 } from 'lucide-react';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ open, onOpenChange }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const createGroup = useCreateForumGroup();

  const handleImageChange = (file: File | null, preview: string | null) => {
    setAvatarFile(file);
    setAvatarPreview(preview);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await createGroup.mutateAsync({ 
      name, 
      description, 
      isPrivate,
      avatarFile: avatarFile || undefined,
    });
    setName('');
    setDescription('');
    setIsPrivate(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Discussion Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-2">
            <GroupImageUpload
              value={avatarPreview}
              onChange={handleImageChange}
              size="lg"
              groupName={name}
              showRemoveButton={!!avatarPreview}
            />
            <p className="text-xs text-muted-foreground">
              Add a group photo (optional)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Enter group name" 
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Describe the group..." 
              rows={3} 
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Private Group</Label>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={createGroup.isPending || !name} 
            className="w-full"
          >
            {createGroup.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
