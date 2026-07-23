import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface RecordingEditDialogProps {
  recording: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const qualityOptions = ['360p', '480p', '720p', '1080p'];

export function RecordingEditDialog({ recording, open, onOpenChange }: RecordingEditDialogProps) {
  const queryClient = useQueryClient();
  const [defaultQuality, setDefaultQuality] = useState<string>('720p');
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);

  useEffect(() => {
    if (recording) {
      setDefaultQuality(recording.default_quality || '720p');
      setSelectedQualities(recording.available_qualities || []);
    }
  }, [recording]);

  const updateMutation = useMutation({
    mutationFn: async (data: { 
      default_quality: string; 
      available_qualities: string[];
    }) => {
      const { error } = await supabase
        .from('class_recordings')
        .update({
          default_quality: data.default_quality,
          available_qualities: data.available_qualities,
        })
        .eq('id', recording.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      toast.success('Recording updated successfully');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update recording: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      default_quality: defaultQuality,
      available_qualities: selectedQualities,
    });
  };

  const toggleQuality = (quality: string) => {
    setSelectedQualities(prev => 
      prev.includes(quality) 
        ? prev.filter(q => q !== quality)
        : [...prev, quality]
    );
  };

  if (!recording) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Recording</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recording Info (Read Only) */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input 
              value={recording.scheduled_class?.subject || 'No Subject'} 
              disabled 
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Course</Label>
            <Input 
              value={recording.scheduled_class?.course?.name || 'No Course'} 
              disabled 
              className="bg-muted"
            />
          </div>

          {/* Editable Fields */}
          <div className="space-y-2">
            <Label>Default Quality</Label>
            <Select value={defaultQuality} onValueChange={setDefaultQuality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualityOptions.map(q => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Available Qualities</Label>
            <div className="grid grid-cols-2 gap-2">
              {qualityOptions.map(quality => (
                <div key={quality} className="flex items-center space-x-2">
                  <Checkbox
                    id={`quality-${quality}`}
                    checked={selectedQualities.includes(quality)}
                    onCheckedChange={() => toggleQuality(quality)}
                  />
                  <Label htmlFor={`quality-${quality}`} className="font-normal">
                    {quality}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Processing Info */}
          {recording.processing_error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Label className="text-destructive">Processing Error</Label>
              <p className="text-sm text-destructive mt-1">{recording.processing_error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
