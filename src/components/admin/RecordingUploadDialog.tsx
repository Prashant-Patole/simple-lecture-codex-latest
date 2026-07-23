import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Video, Loader2, Pause, Play, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdminCourses } from '@/hooks/useAdminCourses';
import { useCourseSubjects } from '@/hooks/useCourseSubjects';
import { useSubjectChapters, useChapterTopics } from '@/hooks/useSubjectChaptersTopics';
import { useB2LargeUpload } from '@/hooks/useB2LargeUpload';
interface RecordingUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordingUploadDialog({ open, onOpenChange }: RecordingUploadDialogProps) {
  const queryClient = useQueryClient();
  
  // Form state
  const [courseId, setCourseId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [topicId, setTopicId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  // Fetch data for dropdowns
  const { data: courses = [], isLoading: coursesLoading } = useAdminCourses();
  const { data: courseSubjects = [], isLoading: subjectsLoading } = useCourseSubjects(courseId);
  const { data: chapters = [], isLoading: chaptersLoading } = useSubjectChapters(subjectId);
  const { data: topics = [], isLoading: topicsLoading } = useChapterTopics(chapterId);

  // B2 Large file upload hook
  const { 
    upload, 
    progress, 
    isUploading, 
    cancel, 
    isPaused, 
    pause, 
    resume 
  } = useB2LargeUpload({
    onProgress: (p) => console.log('Upload progress:', p),
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error(`Failed to upload recording: ${error.message}`);
    },
  });

  // Reset dependent selections when parent changes
  useEffect(() => {
    setSubjectId('');
    setChapterId('');
    setTopicId('');
  }, [courseId]);

  useEffect(() => {
    setChapterId('');
    setTopicId('');
  }, [subjectId]);

  useEffect(() => {
    setTopicId('');
  }, [chapterId]);

  // Auto-suggest title from topic name
  useEffect(() => {
    if (topicId && topics.length > 0) {
      const selectedTopic = topics.find(t => t.id === topicId);
      if (selectedTopic && !title) {
        setTitle(`${selectedTopic.title} - Recording`);
      }
    }
  }, [topicId, topics, title]);

  const resetForm = () => {
    setCourseId('');
    setSubjectId('');
    setChapterId('');
    setTopicId('');
    setTitle('');
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ['video/mp4', 'video/mkv', 'video/avi', 'video/webm', 'video/quicktime'];
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(mp4|mkv|avi|webm|mov)$/i)) {
        toast.error('Please select a valid video file (MP4, MKV, AVI, WebM, MOV)');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!file || !courseId || !subjectId || !chapterId || !topicId || !title) {
      toast.error('All fields are required');
      return;
    }

    try {
      // Generate unique file path for B2
      const fileExt = file.name.split('.').pop() || 'mp4';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `class-recordings/${courseId}/${subjectId}/${topicId}/${fileName}`;

      // Upload to B2 using chunked upload
      const { fileId } = await upload(file, filePath);

      // Insert record with B2 path
      const { error } = await supabase
        .from('class_recordings')
        .insert({
          course_id: courseId,
          subject_id: subjectId,
          chapter_id: chapterId,
          topic_id: topicId,
          recording_title: title,
          recording_type: 'topic',
          original_filename: file.name,
          b2_original_path: filePath,
          processing_status: 'uploaded',
          file_size_bytes: file.size,
        });

      if (error) {
        throw error;
      }

      // Success - invalidate queries and close dialog
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      queryClient.invalidateQueries({ queryKey: ['recording-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-recordings'] });
      toast.success('Recording uploaded successfully to B2 storage');
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed');
    }
  };

  const handleCancel = () => {
    if (isUploading) {
      cancel();
      toast.info('Upload cancelled');
    }
    resetForm();
    onOpenChange(false);
  };

  const isFormValid = courseId && subjectId && chapterId && topicId && title && file;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Upload Recording
          </DialogTitle>
          <DialogDescription>
            Select the course, subject, chapter, and topic for this recording.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Course Selection */}
          <div className="grid gap-2">
            <Label htmlFor="course">Course *</Label>
            <Select value={courseId} onValueChange={setCourseId} disabled={coursesLoading}>
              <SelectTrigger id="course">
                <SelectValue placeholder={coursesLoading ? "Loading courses..." : "Select a course"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Selection */}
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject *</Label>
            <Select 
              value={subjectId} 
              onValueChange={setSubjectId} 
              disabled={!courseId || subjectsLoading}
            >
              <SelectTrigger id="subject">
                <SelectValue placeholder={
                  !courseId ? "Select a course first" : 
                  subjectsLoading ? "Loading subjects..." : 
                  "Select a subject"
                } />
              </SelectTrigger>
              <SelectContent>
                {courseSubjects.map((cs: any) => (
                  <SelectItem key={cs.subject_id} value={cs.subject_id}>
                    {cs.subject?.name || 'Unknown Subject'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chapter Selection */}
          <div className="grid gap-2">
            <Label htmlFor="chapter">Chapter *</Label>
            <Select 
              value={chapterId} 
              onValueChange={setChapterId} 
              disabled={!subjectId || chaptersLoading}
            >
              <SelectTrigger id="chapter">
                <SelectValue placeholder={
                  !subjectId ? "Select a subject first" : 
                  chaptersLoading ? "Loading chapters..." : 
                  "Select a chapter"
                } />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>
                    Ch {chapter.chapter_number}: {chapter.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Topic Selection */}
          <div className="grid gap-2">
            <Label htmlFor="topic">Topic *</Label>
            <Select 
              value={topicId} 
              onValueChange={setTopicId} 
              disabled={!chapterId || topicsLoading}
            >
              <SelectTrigger id="topic">
                <SelectValue placeholder={
                  !chapterId ? "Select a chapter first" : 
                  topicsLoading ? "Loading topics..." : 
                  "Select a topic"
                } />
              </SelectTrigger>
              <SelectContent>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.topic_number}. {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recording Title */}
          <div className="grid gap-2">
            <Label htmlFor="title">Recording Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter recording title"
              disabled={!topicId}
            />
          </div>

          {/* File Upload */}
          <div className="grid gap-2">
            <Label>Video File *</Label>
            <label 
              htmlFor="video-upload"
              className={`
                flex flex-col items-center justify-center w-full h-32 
                border-2 border-dashed rounded-lg cursor-pointer
                transition-colors
                ${file 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <>
                    <Video className="w-8 h-8 mb-2 text-primary" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      MP4, MKV, AVI, WebM up to 10GB
                    </p>
                  </>
                )}
              </div>
              <input
                id="video-upload"
                type="file"
                className="hidden"
                accept="video/*,.mp4,.mkv,.avi,.webm,.mov"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>

        {isUploading && (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isPaused ? 'Paused' : 'Uploading...'}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              {isPaused ? (
                <Button size="sm" variant="outline" onClick={resume}>
                  <Play className="mr-1 h-3 w-3" /> Resume
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={pause}>
                  <Pause className="mr-1 h-3 w-3" /> Pause
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={cancel}>
                <X className="mr-1 h-3 w-3" /> Cancel
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading {progress}%
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Recording
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
