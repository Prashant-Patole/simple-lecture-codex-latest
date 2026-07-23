import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, BookOpen, FileText } from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id: string;
  title: string;
  description: string;
  course_id: string;
  chapter_id?: string;
  topic_id?: string;
  due_date?: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  is_active: boolean;
}

export default function AssignmentManager() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    total_marks: 100,
    passing_marks: 40,
    duration_minutes: 60,
    topic_id: "",
  });

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch chapters for selected course
  const { data: chapters } = useQuery({
    queryKey: ["course-chapters", selectedCourse],
    queryFn: async () => {
      if (!selectedCourse) return [];
      const { data, error } = await supabase
        .from("subject_chapters")
        .select("id, title, chapter_number")
        .eq("subject_id", selectedCourse)
        .order("sequence_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCourse,
  });

  // Fetch topics for selected chapter
  const { data: topics } = useQuery({
    queryKey: ["chapter-topics", selectedChapter],
    queryFn: async () => {
      if (!selectedChapter) return [];
      const { data, error } = await supabase
        .from("subject_topics")
        .select("id, title, topic_number")
        .eq("chapter_id", selectedChapter)
        .order("sequence_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedChapter,
  });

  // Fetch assignments
  const { data: assignments, refetch } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          courses(name),
          subject_chapters(title, chapter_number),
          subject_topics(title, topic_number)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from("assignments").insert({
        ...formData,
        course_id: selectedCourse,
        chapter_id: selectedChapter || null,
        topic_id: formData.topic_id || null,
        questions: [],
      });

      if (error) throw error;

      toast({ title: "Success", description: "Assignment created successfully" });
      setIsOpen(false);
      refetch();
      setFormData({
        title: "",
        description: "",
        due_date: "",
        total_marks: 100,
        passing_marks: 40,
        duration_minutes: 60,
        topic_id: "",
      });
      setSelectedCourse("");
      setSelectedChapter("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assignment Management</h1>
          <p className="text-muted-foreground">Create and manage assignments linked to chapters and topics</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="course">Course *</Label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCourse && (
                <div className="space-y-2">
                  <Label htmlFor="chapter">Chapter (Optional)</Label>
                  <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chapter" />
                    </SelectTrigger>
                    <SelectContent>
                      {chapters?.map((chapter) => (
                        <SelectItem key={chapter.id} value={chapter.id}>
                          Ch {chapter.chapter_number}: {chapter.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedChapter && (
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic (Optional)</Label>
                  <Select
                    value={formData.topic_id}
                    onValueChange={(val) => setFormData({ ...formData, topic_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {topics?.map((topic) => (
                        <SelectItem key={topic.id} value={topic.id}>
                          Topic {topic.topic_number}: {topic.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Assignment Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="datetime-local"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_marks">Total Marks</Label>
                  <Input
                    id="total_marks"
                    type="number"
                    value={formData.total_marks}
                    onChange={(e) => setFormData({ ...formData, total_marks: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passing_marks">Passing Marks</Label>
                  <Input
                    id="passing_marks"
                    type="number"
                    value={formData.passing_marks}
                    onChange={(e) => setFormData({ ...formData, passing_marks: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Assignment</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {assignments?.map((assignment) => (
          <Card key={assignment.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{assignment.title}</span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
                  {assignment.due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(assignment.due_date), "MMM dd, yyyy")}
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{assignment.courses?.name}</span>
                </div>
                {assignment.subject_chapters && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Ch {assignment.subject_chapters.chapter_number}: {assignment.subject_chapters.title}
                    {assignment.subject_topics && (
                      <span className="ml-2">
                        → Topic {assignment.subject_topics.topic_number}: {assignment.subject_topics.title}
                      </span>
                    )}
                  </div>
                )}
                {assignment.description && (
                  <p className="text-muted-foreground">{assignment.description}</p>
                )}
                <div className="flex gap-4 text-muted-foreground">
                  <span>Total: {assignment.total_marks} marks</span>
                  <span>Passing: {assignment.passing_marks} marks</span>
                  <span>Duration: {assignment.duration_minutes} mins</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
