import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, RefreshCw, Save, Edit, Check, X } from "lucide-react";
import { useAITopicContent, GeneratedTopicContent, GeneratedExample, GeneratedQuestion } from "@/hooks/useAITopicContent";
import { useUpdateTopicContent } from "@/hooks/useSubjectManagement";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface AIGenerateTopicContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId?: string | null;
  topicData?: any;
  chapterTitle: string;
  chapterDescription?: string;
  subjectName: string;
  categoryName: string;
}

export function AIGenerateTopicContentDialog({
  open,
  onOpenChange,
  topicId,
  topicData,
  chapterTitle,
  chapterDescription,
  subjectName,
  categoryName,
}: AIGenerateTopicContentDialogProps) {
  const [generatedData, setGeneratedData] = useState<GeneratedTopicContent | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editingExampleIndex, setEditingExampleIndex] = useState<number | null>(null);
  const [editedExample, setEditedExample] = useState<GeneratedExample | null>(null);
  const [saveQuestionsToBank, setSaveQuestionsToBank] = useState(false);
  const [activeTab, setActiveTab] = useState("content");

  const generateContent = useAITopicContent();
  const updateTopicContent = useUpdateTopicContent();

  const handleGenerate = () => {
    if (!topicData) return;

    generateContent.mutate({
      topicTitle: topicData.title,
      topicDescription: topicData.content_markdown || "",
      chapterTitle,
      chapterDescription: chapterDescription || "",
      subjectName,
      categoryName,
      estimatedDurationMinutes: topicData.estimated_duration_minutes || 60,
    }, {
      onSuccess: (data) => {
        setGeneratedData(data);
        setEditedContent(data.content);
      },
    });
  };

  const handleRegenerateSection = (section: 'content' | 'examples' | 'questions') => {
    handleGenerate();
  };

  const handleSaveContent = () => {
    if (!topicId || !generatedData) return;

    // Combine content and examples into notes_markdown
    const examplesMarkdown = generatedData.examples.map((ex, i) => 
      `\n\n## ${ex.title}\n\n**Problem:** ${ex.problem}\n\n**Solution:**\n${ex.solution}\n\n*Difficulty: ${ex.difficulty}*`
    ).join('\n');

    const questionsMarkdown = generatedData.practiceQuestions.map((q, i) => {
      if (q.type === 'mcq') {
        return `\n\n### Question ${i + 1} (MCQ - ${q.difficulty})\n${q.question}\n\n${q.options?.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n')}\n\n**Answer:** ${q.correctAnswer}\n**Explanation:** ${q.explanation}`;
      } else {
        return `\n\n### Question ${i + 1} (Descriptive - ${q.difficulty})\n${q.question}\n\n**Answer:** ${q.correctAnswer}\n**Explanation:** ${q.explanation}`;
      }
    }).join('\n');

    const notesMarkdown = `# Examples\n${examplesMarkdown}\n\n# Practice Questions\n${questionsMarkdown}`;

    updateTopicContent.mutate({
      topicId,
      content_markdown: editedContent,
      notes_markdown: notesMarkdown,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setGeneratedData(null);
        setEditingContent(false);
      },
    });
  };

  const startEditContent = () => {
    setEditingContent(true);
  };

  const cancelEditContent = () => {
    setEditingContent(false);
    setEditedContent(generatedData?.content || "");
  };

  const saveEditContent = () => {
    if (generatedData) {
      setGeneratedData({ ...generatedData, content: editedContent });
    }
    setEditingContent(false);
  };

  const startEditExample = (index: number) => {
    setEditingExampleIndex(index);
    setEditedExample({ ...generatedData!.examples[index] });
  };

  const saveEditExample = () => {
    if (generatedData && editingExampleIndex !== null && editedExample) {
      const newExamples = [...generatedData.examples];
      newExamples[editingExampleIndex] = editedExample;
      setGeneratedData({ ...generatedData, examples: newExamples });
      setEditingExampleIndex(null);
      setEditedExample(null);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI-Powered Content Generation
          </DialogTitle>
          <DialogDescription>
            Generate comprehensive learning content, examples, and practice questions for: <strong>{topicData?.title}</strong>
          </DialogDescription>
        </DialogHeader>

        {!generatedData ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Click the button below to generate detailed learning content, worked examples, and practice questions using AI.
              This will take approximately 30-60 seconds.
            </p>
            <Button 
              onClick={handleGenerate} 
              disabled={generateContent.isPending}
              className="w-full"
            >
              {generateContent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Content...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Content with AI
                </>
              )}
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="examples">Examples ({generatedData.examples.length})</TabsTrigger>
              <TabsTrigger value="questions">Questions ({generatedData.practiceQuestions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Learning Content</h3>
                <div className="flex gap-2">
                  {!editingContent ? (
                    <>
                      <Button variant="outline" size="sm" onClick={startEditContent}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRegenerateSection('content')}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Regenerate
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={cancelEditContent}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={saveEditContent}>
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {editingContent ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
              ) : (
                <Card>
                  <CardContent className="pt-6 prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {editedContent}
                    </ReactMarkdown>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="examples" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Worked Examples</h3>
                <Button variant="outline" size="sm" onClick={() => handleRegenerateSection('examples')}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
              </div>

              <div className="space-y-4">
                {generatedData.examples.map((example, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{example.title}</CardTitle>
                          <Badge className={getDifficultyColor(example.difficulty)} variant="secondary">
                            {example.difficulty}
                          </Badge>
                        </div>
                        {editingExampleIndex !== index && (
                          <Button variant="ghost" size="sm" onClick={() => startEditExample(index)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {editingExampleIndex === index && editedExample ? (
                        <div className="space-y-3">
                          <div>
                            <Label>Problem</Label>
                            <Textarea
                              value={editedExample.problem}
                              onChange={(e) => setEditedExample({ ...editedExample, problem: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Solution</Label>
                            <Textarea
                              value={editedExample.solution}
                              onChange={(e) => setEditedExample({ ...editedExample, solution: e.target.value })}
                              className="mt-1 min-h-[100px]"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingExampleIndex(null)}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={saveEditExample}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <strong>Problem:</strong>
                            <p className="text-sm text-muted-foreground mt-1">{example.problem}</p>
                          </div>
                          <div>
                            <strong>Solution:</strong>
                            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {example.solution}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Practice Questions</h3>
                <Button variant="outline" size="sm" onClick={() => handleRegenerateSection('questions')}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
              </div>

              <div className="space-y-4">
                {generatedData.practiceQuestions.map((question, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                          <Badge variant="outline">{question.type === 'mcq' ? 'MCQ' : 'Descriptive'}</Badge>
                          <Badge className={getDifficultyColor(question.difficulty)} variant="secondary">
                            {question.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="text-base text-foreground mt-2">
                        {question.question}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {question.type === 'mcq' && question.options && (
                        <div className="space-y-1">
                          {question.options.map((option, optIndex) => (
                            <div 
                              key={optIndex} 
                              className={`p-2 rounded text-sm ${option === question.correctAnswer ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-muted'}`}
                            >
                              {String.fromCharCode(65 + optIndex)}. {option}
                            </div>
                          ))}
                        </div>
                      )}
                      <div>
                        <strong className="text-sm">Correct Answer:</strong>
                        <p className="text-sm text-muted-foreground">{question.correctAnswer}</p>
                      </div>
                      <div>
                        <strong className="text-sm">Explanation:</strong>
                        <p className="text-sm text-muted-foreground">{question.explanation}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                <Checkbox 
                  id="save-questions" 
                  checked={saveQuestionsToBank}
                  onCheckedChange={(checked) => setSaveQuestionsToBank(checked as boolean)}
                />
                <Label htmlFor="save-questions" className="text-sm cursor-pointer">
                  Save practice questions to Question Bank (MCQs only)
                </Label>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {generatedData && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveContent} 
              disabled={updateTopicContent.isPending}
            >
              {updateTopicContent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save to Topic
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
