import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCreateForumPost } from '@/hooks/useForumPosts';
import { ForumCategory } from '@/hooks/useForumCategories';

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ForumCategory[];
  defaultCategoryId?: string;
}

const CreatePostDialog: React.FC<CreatePostDialogProps> = ({
  open, onOpenChange, categories, defaultCategoryId
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId || '');
  const createPost = useCreateForumPost();

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !categoryId) return;
    await createPost.mutateAsync({ categoryId, title, content });
    setTitle('');
    setContent('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask a Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's your question?" />
          </div>
          <div>
            <Label>Details</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Provide more details..." rows={4} />
          </div>
          <Button onClick={handleSubmit} disabled={createPost.isPending || !title || !content || !categoryId} className="w-full">
            {createPost.isPending ? 'Posting...' : 'Post Question'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
