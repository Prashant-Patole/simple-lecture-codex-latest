import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/admin/DifficultyBadge";
import { Plus, Trash2, Edit2, Save, X, Loader2, Upload, FileText, Brain, CheckCircle, AlertCircle } from "lucide-react";
import { usePYQQuestions, useCreatePYQQuestion, useUpdatePYQQuestion, useDeletePYQQuestion, PYQQuestion } from "@/hooks/usePYQQuestions";
import { useSubjectChapters } from "@/hooks/useLearningCourse";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDatalab } from "@/hooks/useDatalab";
import { useAnalyzeDocument } from "@/hooks/useAnalyzeDocument";
import { useExtractPYQQuestionsAI, type ExtractedPYQQuestion } from "@/hooks/useExtractPYQQuestionsAI";
import { useBulkInsertPYQQuestions } from "@/hooks/useBulkInsertPYQQuestions";
import { DocumentAnalysisPreview } from "@/components/admin/DocumentAnalysisPreview";
import type { DocumentAnalysis } from "@/types/documentAnalysis";

interface SubjectPYQTabProps {
  subjectId: string;
}

const PYQ_TYPES = [
  { value: "consolidated", label: "Consolidated" },
  { value: "important", label: "Important" },
  { value: "predictive", label: "Predictive" },
] as const;

type Step = "form" | "parsing" | "analyzing" | "analysis_preview" | "extracting" | "preview" | "saving";

const emptyForm: {
  question_text: string;
  question_format: "mcq" | "subjective" | "true_false";
  pyq_type: "consolidated" | "important" | "predictive";
  options: Record<string, any> | null;
  marks: number;
  difficulty: "Low" | "Medium" | "Intermediate" | "Advanced";
  chapter_id: string | null;
  topic_id: string | null;
  question_image_url: string | null;
  is_verified: boolean;
} = {
  question_text: "",
  question_format: "subjective",
  pyq_type: "consolidated",
  options: null,
  marks: 1,
  difficulty: "Medium",
  chapter_id: null,
  topic_id: null,
  question_image_url: null,
  is_verified: false,
};

export const SubjectPYQTab = ({ subjectId }: SubjectPYQTabProps) => {
  const [activeType, setActiveType] = useState<string>("consolidated");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<Step>("form");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPyqType, setUploadPyqType] = useState<"consolidated" | "important" | "predictive">("consolidated");
  const [uploadChapterId, setUploadChapterId] = useState<string | null>(null);
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [parsedMarkdown, setParsedMarkdown] = useState<string>("");
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedPYQQuestion[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 50 });

  const { data: questions, isLoading } = usePYQQuestions(subjectId, activeType);
  const { data: chapters } = useSubjectChapters(subjectId);
  const createMutation = useCreatePYQQuestion();
  const updateMutation = useUpdatePYQQuestion();
  const deleteMutation = useDeletePYQQuestion();

  // Upload hooks
  const { parsePdfFile, isLoading: isParsing, progress: parseProgress } = useDatalab();
  const analyzeDocument = useAnalyzeDocument();
  const extractPYQ = useExtractPYQQuestionsAI();
  const bulkInsert = useBulkInsertPYQQuestions();

  // Animated progress for extraction step
  useEffect(() => {
    if (uploadStep !== "extracting") {
      setExtractionProgress({ current: 0, total: 50 });
      return;
    }
    const total = documentAnalysis?.totalEstimatedQuestions || 50;
    setExtractionProgress({ current: 0, total });
    const interval = setInterval(() => {
      setExtractionProgress((prev) => {
        if (prev.current >= prev.total - 3) return { ...prev, current: Math.min(prev.current + 0.3, prev.total - 1) };
        return { ...prev, current: Math.min(prev.current + Math.random() * 3 + 1, prev.total - 1) };
      });
    }, 800);
    return () => clearInterval(interval);
  }, [uploadStep, documentAnalysis?.totalEstimatedQuestions]);

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadStep("form");
    setParsedJson(null);
    setParsedMarkdown("");
    setDocumentAnalysis(null);
    setExtractedQuestions([]);
    setUploadPyqType("consolidated");
    setUploadChapterId(null);
  };

  const handleSubmit = () => {
    if (!form.question_text.trim()) return;
    const payload = {
      ...form,
      subject_id: subjectId,
      pyq_type: activeType as PYQQuestion["pyq_type"],
      options: form.question_format === "mcq" ? form.options : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload }, { onSuccess: resetForm });
    } else {
      createMutation.mutate(payload as any, { onSuccess: resetForm });
    }
  };

  const startEdit = (q: PYQQuestion) => {
    setForm({
      question_text: q.question_text,
      question_format: q.question_format,
      pyq_type: q.pyq_type,
      options: q.options || null,
      marks: q.marks,
      difficulty: q.difficulty,
      chapter_id: q.chapter_id || null,
      topic_id: q.topic_id || null,
      question_image_url: q.question_image_url || null,
      is_verified: q.is_verified,
    });
    setEditingId(q.id);
    setShowForm(true);
  };

  const getOptionText = (opt: any): string => {
    if (typeof opt === "string") return opt;
    if (opt?.text) return opt.text;
    return String(opt);
  };

  // === Upload workflow handlers ===
  const handleStartUpload = async () => {
    if (!selectedFile) return;
    try {
      console.log("[PYQ] Step 1: Starting parse for file:", selectedFile.name, "size:", selectedFile.size);
      setUploadStep("parsing");
      const result = await parsePdfFile(selectedFile, undefined, { skipImages: true });
      if (!result?.success) {
        console.error("[PYQ] Parse failed or returned no success:", result);
        setUploadStep("form");
        return;
      }
      console.log("[PYQ] Step 2: Parse complete. JSON keys:", result.content_json ? Object.keys(result.content_json).length : 0, "Markdown length:", (result.content_markdown || "").length);
      setParsedJson(result.content_json);
      setParsedMarkdown(result.content_markdown || "");

      setUploadStep("analyzing");
      console.log("[PYQ] Step 3: Starting document analysis...");
      try {
        const analysis = await analyzeDocument.mutateAsync({
          contentMarkdown: result.content_markdown,
          contentJson: result.content_json,
          documentName: selectedFile.name,
        });
        console.log("[PYQ] Step 3: Analysis complete. Estimated questions:", analysis.totalEstimatedQuestions);
        setDocumentAnalysis(analysis);
        setUploadStep("analysis_preview");
      } catch (analysisErr: any) {
        console.error("[PYQ] Analysis failed, proceeding to extraction:", analysisErr.message);
        await proceedExtraction(result.content_json, result.content_markdown || "");
      }
    } catch (err: any) {
      console.error("[PYQ] Upload pipeline failed:", err.message, err);
      setUploadStep("form");
    }
  };

  const handleConfirmAnalysis = async () => {
    const hasContent = (parsedMarkdown?.trim().length ?? 0) > 100 || parsedJson != null;
    if (!hasContent) return;
    await proceedExtraction(parsedJson, parsedMarkdown, documentAnalysis ?? undefined);
  };

  const proceedExtraction = async (json: any, markdown: string, analysis?: DocumentAnalysis) => {
    setUploadStep("extracting");
    console.log("[PYQ] Step 4: Starting extraction. JSON present:", json != null, "Markdown length:", markdown.length);
    try {
      const result = await extractPYQ.mutateAsync({
        contentJson: json,
        contentMarkdown: markdown,
        documentAnalysis: analysis,
      });
      console.log("[PYQ] Step 4: Extraction result. Questions:", result.questions?.length || 0, "Success:", result.success);
      if (result.questions?.length > 0) {
        setExtractedQuestions(result.questions);
      }
      setUploadStep("preview");
    } catch (err: any) {
      console.error("[PYQ] Extraction failed:", err.message, err);
      setUploadStep("preview");
    }
  };

  const handleSaveExtracted = async () => {
    if (extractedQuestions.length === 0) return;
    setUploadStep("saving");
    console.log("[PYQ] Step 5: Saving", extractedQuestions.length, "questions. Type:", uploadPyqType, "Chapter:", uploadChapterId);
    try {
      await bulkInsert.mutateAsync({
        questions: extractedQuestions,
        subjectId,
        pyqType: uploadPyqType,
        chapterId: uploadChapterId,
      });
      console.log("[PYQ] Step 5: Save complete!");
      setUploadOpen(false);
      resetUpload();
    } catch (err: any) {
      console.error("[PYQ] Save failed:", err.message, err);
      setUploadStep("preview");
    }
  };

  const removeExtractedQuestion = (idx: number) => {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PYQ Questions</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList className="mb-4">
            {PYQ_TYPES.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {PYQ_TYPES.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <div className="flex justify-end gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={() => { resetUpload(); setUploadOpen(true); }}>
                  <Upload className="h-4 w-4 mr-1" /> Upload Document
                </Button>
                <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Question
                </Button>
              </div>

              {/* Manual add form */}
              {showForm && (
                <Card className="mb-4 border-primary/30">
                  <CardContent className="pt-4 space-y-3">
                    <Textarea
                      placeholder="Question text..."
                      value={form.question_text}
                      onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Select value={form.question_format} onValueChange={(v: any) => setForm({ ...form, question_format: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">MCQ</SelectItem>
                          <SelectItem value="subjective">Subjective</SelectItem>
                          <SelectItem value="true_false">True/False</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={form.difficulty} onValueChange={(v: any) => setForm({ ...form, difficulty: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Intermediate">Intermediate</SelectItem>
                          <SelectItem value="Advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" min={1} value={form.marks} onChange={(e) => setForm({ ...form, marks: parseInt(e.target.value) || 1 })} placeholder="Marks" />
                      <Select value={form.chapter_id || "none"} onValueChange={(v) => setForm({ ...form, chapter_id: v === "none" ? null : v })}>
                        <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Chapter</SelectItem>
                          {chapters?.map((ch: any) => (
                            <SelectItem key={ch.chapter_id} value={ch.chapter_id}>Ch {ch.chapter_number}: {ch.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.question_format === "mcq" && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Options (A, B, C, D):</p>
                        {["A", "B", "C", "D"].map((key) => (
                          <Input
                            key={key}
                            placeholder={`Option ${key}`}
                            value={form.options?.[key]?.text || ""}
                            onChange={(e) => setForm({
                              ...form,
                              options: { ...form.options, [key]: { text: e.target.value } },
                            })}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        <Save className="h-3 w-3 mr-1" /> {editingId ? "Update" : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Existing questions list */}
              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !questions?.length ? (
                <p className="text-center text-muted-foreground py-8">No {t.label} questions yet.</p>
              ) : (
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <Card key={q.id} className="border">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{idx + 1}. {q.question_text}</p>
                            {q.question_format === "mcq" && q.options && (
                              <div className="mt-1 grid grid-cols-2 gap-1">
                                {Object.entries(q.options).map(([key, val]) => (
                                  <span key={key} className="text-xs text-muted-foreground">{key}. {getOptionText(val)}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{q.question_format}</Badge>
                              <DifficultyBadge level={q.difficulty} className="text-xs" />
                              <Badge variant="secondary" className="text-xs">{q.marks} mark{q.marks !== 1 ? "s" : ""}</Badge>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(q)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(q.id)} disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Upload Document Dialog */}
        <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) { setUploadOpen(false); resetUpload(); } else setUploadOpen(true); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Upload PYQ Document</DialogTitle>
              <DialogDescription>Upload a document to extract questions (no answers).</DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-auto">
              {/* Step 1: Form */}
              {uploadStep === "form" && (
                <div className="space-y-4 p-1">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Document File</label>
                    <Input
                      type="file"
                      accept=".pdf,.docx,.doc,.pptx,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">PYQ Type</label>
                      <Select value={uploadPyqType} onValueChange={(v: any) => setUploadPyqType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PYQ_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Chapter (optional)</label>
                      <Select value={uploadChapterId || "none"} onValueChange={(v) => setUploadChapterId(v === "none" ? null : v)}>
                        <SelectTrigger><SelectValue placeholder="No Chapter" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Chapter</SelectItem>
                          {chapters?.map((ch: any) => (
                            <SelectItem key={ch.chapter_id} value={ch.chapter_id}>Ch {ch.chapter_number}: {ch.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleStartUpload} disabled={!selectedFile} className="w-full">
                    <Upload className="h-4 w-4 mr-2" /> Start Processing
                  </Button>
                </div>
              )}

              {/* Step 2: Parsing */}
              {uploadStep === "parsing" && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium">Parsing document...</p>
                  <p className="text-xs text-muted-foreground">{parseProgress}</p>
                </div>
              )}

              {/* Step 3: Analyzing */}
              {uploadStep === "analyzing" && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Brain className="h-10 w-10 animate-pulse text-primary" />
                  <p className="text-sm font-medium">Analyzing document structure...</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      console.log("[PYQ] Skipping analysis, proceeding to extraction");
                      proceedExtraction(parsedJson, parsedMarkdown);
                    }}
                  >
                    Skip Analysis →
                  </Button>
                </div>
              )}

              {/* Step 4: Analysis preview */}
              {uploadStep === "analysis_preview" && documentAnalysis && (
                <DocumentAnalysisPreview
                  analysis={documentAnalysis}
                  onConfirm={handleConfirmAnalysis}
                  onCancel={() => { setUploadOpen(false); resetUpload(); }}
                  isExtracting={false}
                  extractionInput={{
                    hasJson: parsedJson != null,
                    hasMarkdown: (parsedMarkdown?.trim().length ?? 0) > 100,
                  }}
                />
              )}

              {/* Step 5: Extracting */}
              {uploadStep === "extracting" && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Brain className="h-10 w-10 animate-pulse text-primary" />
                  <p className="text-sm font-medium">Extracting questions (no answers)...</p>
                  <div className="w-64">
                    <Progress value={(extractionProgress.current / extractionProgress.total) * 100} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ~{Math.round(extractionProgress.current)} / {extractionProgress.total} questions
                  </p>
                </div>
              )}

              {/* Step 6: Preview */}
              {uploadStep === "preview" && (
                <div className="space-y-3 p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {extractedQuestions.length > 0 ? (
                          <><CheckCircle className="h-4 w-4 inline mr-1 text-green-600" />{extractedQuestions.length} questions extracted</>
                        ) : (
                          <><AlertCircle className="h-4 w-4 inline mr-1 text-destructive" />No questions found</>
                        )}
                      </p>
                      {extractedQuestions.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          The AI could not identify question patterns in this document. Try a different document format or add questions manually.
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{uploadPyqType}</Badge>
                  </div>

                  {extractedQuestions.length > 0 && (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2 pr-3">
                        {extractedQuestions.map((q, idx) => (
                          <Card key={idx} className="border">
                            <CardContent className="py-2 px-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium">{q.question_number}. {q.question_text.slice(0, 200)}{q.question_text.length > 200 ? "..." : ""}</p>
                                  {q.question_format === "mcq" && q.options && (
                                    <div className="mt-1 grid grid-cols-2 gap-1">
                                      {Object.entries(q.options).map(([key, val]) => (
                                        <span key={key} className="text-[10px] text-muted-foreground">{key}. {getOptionText(val)}</span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex gap-1 mt-1">
                                    <Badge variant="outline" className="text-[10px]">{q.question_format}</Badge>
                                    <Badge variant="secondary" className="text-[10px]">{q.difficulty}</Badge>
                                    <Badge variant="secondary" className="text-[10px]">{q.marks}m</Badge>
                                  </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeExtractedQuestion(idx)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setUploadOpen(false); resetUpload(); }}>Cancel</Button>
                    <Button onClick={handleSaveExtracted} disabled={extractedQuestions.length === 0 || bulkInsert.isPending} className="flex-1">
                      {bulkInsert.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      <Save className="h-4 w-4 mr-1" /> Save {extractedQuestions.length} Questions
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 7: Saving */}
              {uploadStep === "saving" && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium">Saving questions...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
