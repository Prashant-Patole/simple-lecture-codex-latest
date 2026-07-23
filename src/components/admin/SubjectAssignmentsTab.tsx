import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Sparkles, User, Loader2, Eye } from "lucide-react";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectChaptersTopics";
import {
  useSubjectAssignments,
  useCreateAssignment,
  useGenerateAIAssignment,
  useDeleteAssignment,
  AIGenerationConfig,
} from "@/hooks/useSubjectAssignments";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SubjectAssignmentsTabProps {
  subjectId: string;
  subjectName: string;
}

const QUESTION_TYPES = [
  { id: "mcq", label: "Multiple Choice (MCQ)" },
  { id: "short_answer", label: "Short Answer" },
  { id: "long_answer", label: "Long Answer" },
  { id: "true_false", label: "True/False" },
  { id: "fill_blank", label: "Fill in the Blanks" },
];

export function SubjectAssignmentsTab({ subjectId, subjectName }: SubjectAssignmentsTabProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [validUntil, setValidUntil] = useState("");
  const [instructions, setInstructions] = useState("");
  const [difficultyMix, setDifficultyMix] = useState({ easy: 30, medium: 50, hard: 20 });
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(["mcq", "short_answer", "long_answer"]);

  // Queries
  const { data: chapters, isLoading: chaptersLoading } = useSubjectChapters(subjectId);
  const { data: topics, isLoading: topicsLoading } = useChapterTopics(selectedChapterId || undefined);
  const { data: assignments, isLoading: assignmentsLoading } = useSubjectAssignments(subjectId);

  // Mutations
  const createAssignment = useCreateAssignment();
  const generateAIAssignment = useGenerateAIAssignment();
  const deleteAssignment = useDeleteAssignment();

  const resetForm = () => {
    setStep(1);
    setSelectedChapterId("");
    setSelectedTopicId("");
    setTitle("");
    setTotalMarks(50);
    setDurationMinutes(60);
    setValidUntil("");
    setInstructions("");
    setDifficultyMix({ easy: 30, medium: 50, hard: 20 });
    setSelectedQuestionTypes(["mcq", "short_answer", "long_answer"]);
    setGeneratedQuestions(null);
  };

  const handleDifficultyChange = (type: "easy" | "medium" | "hard", value: number) => {
    const remaining = 100 - value;
    const otherTwo = Object.keys(difficultyMix).filter(k => k !== type) as ("easy" | "medium" | "hard")[];
    const currentOtherTotal = difficultyMix[otherTwo[0]] + difficultyMix[otherTwo[1]];
    
    if (currentOtherTotal > 0) {
      const ratio = remaining / currentOtherTotal;
      setDifficultyMix({
        ...difficultyMix,
        [type]: value,
        [otherTwo[0]]: Math.round(difficultyMix[otherTwo[0]] * ratio),
        [otherTwo[1]]: Math.round(difficultyMix[otherTwo[1]] * ratio),
      });
    } else {
      setDifficultyMix({
        ...difficultyMix,
        [type]: value,
        [otherTwo[0]]: Math.round(remaining / 2),
        [otherTwo[1]]: Math.round(remaining / 2),
      });
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedChapterId) {
      toast({
        title: "Chapter Required",
        description: "Please select a chapter first.",
        variant: "destructive",
      });
      return;
    }

    const config: AIGenerationConfig = {
      difficultyMix,
      questionTypes: selectedQuestionTypes,
      totalMarks,
      durationMinutes,
    };

    setIsGenerating(true);
    try {
      const result = await generateAIAssignment.mutateAsync({
        subjectId,
        chapterId: selectedChapterId,
        topicId: selectedTopicId || undefined,
        config,
        instructions,
      });

      if (result.questions) {
        setGeneratedQuestions(result.questions);
        setTitle(result.title || `${subjectName} Assignment`);
        setStep(4);
      }
    } catch (error) {
      console.error("AI generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!generatedQuestions || generatedQuestions.length === 0) {
      toast({
        title: "No Questions",
        description: "Generate questions first.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createAssignment.mutateAsync({
        subject_id: subjectId,
        chapter_id: selectedChapterId,
        topic_id: selectedTopicId || null,
        title,
        description: `AI-generated assignment for ${subjectName}`,
        questions: generatedQuestions,
        total_marks: totalMarks,
        duration_minutes: durationMinutes,
        valid_until: validUntil || null,
        instructions,
        source_type: "ai_generated",
        ai_generation_config: {
          difficultyMix,
          questionTypes: selectedQuestionTypes,
        },
        is_active: true,
      });

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Create assignment error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this assignment?")) {
      await deleteAssignment.mutateAsync({ id, subjectId });
    }
  };

  const selectedChapter = chapters?.find(c => c.id === selectedChapterId);
  const selectedTopic = topics?.find(t => t.id === selectedTopicId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Assignments</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {step === 1 && "Select Chapter & Topic"}
                {step === 2 && "Configure Assignment"}
                {step === 3 && "Choose Generation Method"}
                {step === 4 && "Preview & Confirm"}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh] pr-4">
              {/* Step 1: Select Chapter & Topic */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Chapter *</Label>
                    <Select value={selectedChapterId} onValueChange={(value) => {
                      setSelectedChapterId(value);
                      setSelectedTopicId("");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a chapter" />
                      </SelectTrigger>
                      <SelectContent>
                        {chaptersLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : chapters?.length === 0 ? (
                          <SelectItem value="none" disabled>No chapters found</SelectItem>
                        ) : (
                          chapters?.map((chapter) => (
                            <SelectItem key={chapter.id} value={chapter.id}>
                              {chapter.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Topic (Optional)</Label>
                    <Select 
                      value={selectedTopicId || "all"} 
                      onValueChange={(value) => setSelectedTopicId(value === "all" ? "" : value)}
                      disabled={!selectedChapterId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a topic (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All topics in chapter</SelectItem>
                        {topicsLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : (
                          topics?.map((topic) => (
                            <SelectItem key={topic.id} value={topic.id}>
                              {topic.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      If not selected, assignment will cover the entire chapter
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => setStep(2)} disabled={!selectedChapterId}>
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Configure Assignment */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assignment Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter assignment title"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Marks</Label>
                      <Input
                        type="number"
                        value={totalMarks}
                        onChange={(e) => setTotalMarks(parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Valid Until / Due Date</Label>
                    <Input
                      type="datetime-local"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <Textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Enter instructions for students..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Difficulty Distribution</Label>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Easy (Understanding)</span>
                          <span>{difficultyMix.easy}%</span>
                        </div>
                        <Slider
                          value={[difficultyMix.easy]}
                          onValueChange={([value]) => handleDifficultyChange("easy", value)}
                          max={100}
                          step={5}
                          className="[&_[role=slider]]:bg-green-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-yellow-600">Medium (Application)</span>
                          <span>{difficultyMix.medium}%</span>
                        </div>
                        <Slider
                          value={[difficultyMix.medium]}
                          onValueChange={([value]) => handleDifficultyChange("medium", value)}
                          max={100}
                          step={5}
                          className="[&_[role=slider]]:bg-yellow-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600">Hard (Analysis)</span>
                          <span>{difficultyMix.hard}%</span>
                        </div>
                        <Slider
                          value={[difficultyMix.hard]}
                          onValueChange={([value]) => handleDifficultyChange("hard", value)}
                          max={100}
                          step={5}
                          className="[&_[role=slider]]:bg-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Question Types</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {QUESTION_TYPES.map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={type.id}
                            checked={selectedQuestionTypes.includes(type.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedQuestionTypes([...selectedQuestionTypes, type.id]);
                              } else {
                                setSelectedQuestionTypes(selectedQuestionTypes.filter(t => t !== type.id));
                              }
                            }}
                          />
                          <Label htmlFor={type.id} className="text-sm font-normal cursor-pointer">
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setStep(3)} disabled={selectedQuestionTypes.length === 0}>
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Choose Generation Method */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Assignment Summary</h4>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p><strong>Chapter:</strong> {selectedChapter?.title}</p>
                      {selectedTopic && <p><strong>Topic:</strong> {selectedTopic.title}</p>}
                      <p><strong>Total Marks:</strong> {totalMarks}</p>
                      <p><strong>Duration:</strong> {durationMinutes} minutes</p>
                      <p><strong>Question Types:</strong> {selectedQuestionTypes.length} selected</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-24 flex flex-col gap-2 opacity-50 cursor-not-allowed"
                            disabled
                          >
                            <User className="h-6 w-6" />
                            <span>Teacher Made</span>
                            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Manual question creation will be available soon</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      className="h-24 flex flex-col gap-2"
                      onClick={handleGenerateAI}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-6 w-6" />
                          <span>AI Generate</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex justify-start">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Preview & Confirm */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assignment Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Generated Questions ({generatedQuestions?.length || 0})</Label>
                    <div className="border rounded-lg max-h-[300px] overflow-auto">
                      {generatedQuestions?.map((q, idx) => (
                        <div key={idx} className="p-3 border-b last:border-b-0">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm">Q{idx + 1}.</span>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-xs">
                                {q.type || "MCQ"}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {q.marks || 1} marks
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  q.difficulty === "easy" ? "border-green-500 text-green-600" :
                                  q.difficulty === "hard" ? "border-red-500 text-red-600" :
                                  "border-yellow-500 text-yellow-600"
                                }`}
                              >
                                {q.difficulty || "medium"}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm">{q.question || q.text}</p>
                          {q.options && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {q.options.map((opt: string, i: number) => (
                                <div key={i} className={q.correct_answer === opt ? "text-green-600 font-medium" : ""}>
                                  {String.fromCharCode(65 + i)}. {opt}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(3)}>
                      Regenerate
                    </Button>
                    <Button onClick={handleConfirmAssignment} disabled={createAssignment.isPending}>
                      {createAssignment.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Confirm & Save"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {assignmentsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : assignments?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No assignments yet. Create your first assignment!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Chapter / Topic</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments?.map((assignment: any) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{assignment.title}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {assignment.chapter?.title || "-"}
                      {assignment.topic?.title && (
                        <span className="text-muted-foreground"> / {assignment.topic.title}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{assignment.total_marks || "-"}</TableCell>
                  <TableCell>{assignment.duration_minutes ? `${assignment.duration_minutes} min` : "-"}</TableCell>
                  <TableCell>
                    {assignment.valid_until 
                      ? format(new Date(assignment.valid_until), "MMM dd, yyyy")
                      : "-"
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={assignment.source_type === "ai_generated" ? "default" : "secondary"}>
                      {assignment.source_type === "ai_generated" ? "AI" : "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(assignment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
