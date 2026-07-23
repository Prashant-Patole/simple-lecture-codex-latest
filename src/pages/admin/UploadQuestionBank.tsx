import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, Eye, Sparkles, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCategoriesWithSubjects } from "@/hooks/useCategoriesWithSubjects";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";
import { useAdminPopularSubjects } from "@/hooks/useAdminPopularSubjects";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { useSubtopics } from "@/hooks/useSubtopics";
import { useUploadedDocuments, useUploadDocument, useProcessDocument, useExtractQuestions } from "@/hooks/useUploadedDocuments";
import { useProcessingJobs, useCheckJobStatus } from "@/hooks/useProcessingJobs";
import { useEffect } from "react";
import { MathpixPreview } from "@/components/admin/MathpixPreview";
import { toast } from "sonner";

type DocumentPurpose = "dpp" | "proficiency_test" | "previous_year" | "exam" | "general";

export default function UploadQuestionBank() {
  const [categoryId, setCategoryId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [documentPurpose, setDocumentPurpose] = useState<DocumentPurpose>("general");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [solutionsFile, setSolutionsFile] = useState<File | null>(null);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const navigate = useNavigate();

  const { data: categories } = useCategoriesWithSubjects();
  const { data: allSubjects } = useAdminPopularSubjects();
  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(chapterId);
  const { data: subtopics } = useSubtopics(topicId);
  
  const subjects = allSubjects?.filter((s) => s.category_id === categoryId) || [];

  const { data: documents } = useUploadedDocuments({
    categoryId,
    subjectId,
    chapterId,
    topicId,
  });

  const uploadMutation = useUploadDocument();
  const processMutation = useProcessDocument();
  const extractMutation = useExtractQuestions();
  const checkStatusMutation = useCheckJobStatus();

  const handleQuestionsFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error("Questions file must be a PDF");
        return;
      }
      setQuestionsFile(file);
    }
  };

  const handleSolutionsFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error("Solutions file must be a PDF");
        return;
      }
      setSolutionsFile(file);
    }
  };

  const handleUpload = async () => {
    if (!questionsFile || !solutionsFile || !categoryId || !subjectId || !chapterId || !topicId) {
      toast.error("Please select both PDFs and all required fields");
      return;
    }

    await uploadMutation.mutateAsync({
      questionsFile,
      solutionsFile,
      categoryId,
      subjectId,
      chapterId,
      topicId,
      subtopicId: subtopicId || undefined,
      documentPurpose,
    });

    setIsUploadOpen(false);
    setQuestionsFile(null);
    setSolutionsFile(null);
  };

  const getStatusBadge = (status: string, job?: any) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">✅ Completed</Badge>;
      case 'processing':
        const progress = job?.progress_percentage || 0;
        const step = job?.current_step || 'Initializing...';
        return (
          <div className="space-y-1">
            <Badge className="bg-yellow-100 text-yellow-800">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Processing ({progress}%)
            </Badge>
            <p className="text-xs text-muted-foreground">{step}</p>
          </div>
        );
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">❌ Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">⏳ Ready to Process</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Upload Question Bank (Dual PDF)</h2>
        <p className="text-muted-foreground">
          Upload separate PDFs for questions and solutions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select category and subject to view uploaded documents</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <SearchableCategorySelector
              value={categoryId}
              onChange={(value) => {
                setCategoryId(value);
                setSubjectId("");
                setChapterId("");
                setTopicId("");
                setSubtopicId("");
              }}
              label="Category"
              placeholder="Search category..."
            />
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(value) => {
              setSubjectId(value);
              setChapterId("");
              setTopicId("");
              setSubtopicId("");
            }} disabled={!categoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chapter</Label>
            <Select value={chapterId} onValueChange={(value) => {
              setChapterId(value);
              setTopicId("");
              setSubtopicId("");
            }} disabled={!subjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select chapter" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {chapters?.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Topic *</Label>
            <Select value={topicId} onValueChange={(value) => {
              setTopicId(value);
              setSubtopicId("");
            }} disabled={!chapterId}>
              <SelectTrigger>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {topics?.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subtopic (Optional)</Label>
            <Select value={subtopicId} onValueChange={setSubtopicId} disabled={!topicId}>
              <SelectTrigger>
                <SelectValue placeholder="Select subtopic" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {subtopics?.map((subtopic) => (
                  <SelectItem key={subtopic.id} value={subtopic.id}>
                    {subtopic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        
        <CardContent className="pt-0">
          <div className="flex justify-end">
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Dual PDFs
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Upload Question Bank (Dual PDFs)</DialogTitle>
                  <DialogDescription>
                    Upload separate PDFs for questions and solutions
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Document Purpose *</Label>
                    <Select value={documentPurpose} onValueChange={(v) => setDocumentPurpose(v as DocumentPurpose)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="dpp">Daily Practice Problems (DPP)</SelectItem>
                        <SelectItem value="proficiency_test">Proficiency Test</SelectItem>
                        <SelectItem value="previous_year">Previous Year Paper</SelectItem>
                        <SelectItem value="exam">Exam Paper</SelectItem>
                        <SelectItem value="general">General Question Bank</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This helps categorize questions when creating tests later
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Questions PDF *</Label>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handleQuestionsFileSelect}
                    />
                    {questionsFile && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">Q</Badge>
                        {questionsFile.name} ({(questionsFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Solutions PDF *</Label>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handleSolutionsFileSelect}
                    />
                    {solutionsFile && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700">S</Badge>
                        {solutionsFile.name} ({(solutionsFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>

                  {questionsFile && solutionsFile && (
                    <Alert>
                      <AlertDescription>
                        Total size: {((questionsFile.size + solutionsFile.size) / 1024).toFixed(2)} KB
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsUploadOpen(false);
                    setQuestionsFile(null);
                    setSolutionsFile(null);
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={!questionsFile || !solutionsFile || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Upload Both PDFs
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
          <CardDescription>Manage uploaded documents and extract questions</CardDescription>
        </CardHeader>
        <CardContent>
          {documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Names</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Hierarchy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => {
                  const DocumentRow = () => {
                    const { data: jobs } = useProcessingJobs({ 
                      documentId: doc.id,
                      jobType: 'mathpix_processing'
                    });
                    
                    const activeJob = jobs?.find(
                      (job: any) => job.status === 'running' || job.status === 'pending'
                    );

                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Q</Badge>
                              <span className="text-sm">{doc.questions_file_name || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">S</Badge>
                              <span className="text-sm">{doc.solutions_file_name || 'N/A'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.file_type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{doc.popular_subjects?.name}</span>
                            {' > '}
                            <span className="text-muted-foreground">{doc.subject_chapters?.title}</span>
                            {doc.subject_topics?.title && (
                              <>
                                {' > '}
                                <span className="font-medium">{doc.subject_topics.title}</span>
                              </>
                            )}
                            {doc.subtopics?.title && (
                              <>
                                {' > '}
                                <span className="text-xs">{doc.subtopics.title}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(doc.status, activeJob)}
                          
                          {activeJob?.result_data && typeof activeJob.result_data === 'object' && 'replit_job_id' in activeJob.result_data && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-xs">
                                🔄 Replit Job: {String((activeJob.result_data as any).replit_job_id)}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm text-muted-foreground">
                            <span>{format(new Date(doc.created_at), 'dd/MM/yyyy')}</span>
                            <span className="text-xs text-muted-foreground/70">
                              {format(new Date(doc.created_at), 'HH:mm')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {doc.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!doc.questions_file_url || !doc.solutions_file_url) {
                                    toast.error("Both PDFs must be uploaded before processing");
                                    return;
                                  }
                                  extractMutation.mutate({ documentId: doc.id });
                                }}
                                disabled={extractMutation.isPending || !!activeJob}
                              >
                                {(extractMutation.isPending || activeJob) ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Processing with Replit...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    Process & Extract with Replit
                                  </>
                                )}
                              </Button>
                            )}

                            {doc.status === 'processing' && activeJob && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  checkStatusMutation.mutate(activeJob.id);
                                }}
                                disabled={checkStatusMutation.isPending}
                              >
                                {checkStatusMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Checking...
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-1" />
                                    Check Status
                                  </>
                                )}
                              </Button>
                            )}
                            
                            {doc.status === 'completed' && (doc.questions_mmd_content || doc.solutions_mmd_content) && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPreviewDocument(doc);
                                    setIsPreviewOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Preview
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => navigate(`/admin/question-bank/verify/${doc.id}`)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Verify Questions
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  };

                  return <DocumentRow key={doc.id} />;
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents uploaded yet</p>
              <p className="text-sm">Upload dual PDFs to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-7xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Document Preview: {previewDocument?.questions_file_name}
            </DialogTitle>
            <DialogDescription>
              View extracted MMD content from both PDFs
            </DialogDescription>
          </DialogHeader>

          {previewDocument && (
            <div className="grid grid-cols-2 gap-4">
              <div className="border-r pr-4">
                <div className="sticky top-0 bg-background pb-2 mb-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">Questions</Badge>
                    {previewDocument.questions_file_name}
                  </h3>
                </div>
                {previewDocument.questions_mmd_content ? (
                  <MathpixPreview 
                    mmdText={previewDocument.questions_mmd_content}
                  />
                ) : (
                  <Alert>
                    <AlertDescription>No questions content available</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="pl-4">
                <div className="sticky top-0 bg-background pb-2 mb-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700">Solutions</Badge>
                    {previewDocument.solutions_file_name}
                  </h3>
                </div>
                {previewDocument.solutions_mmd_content ? (
                  <MathpixPreview 
                    mmdText={previewDocument.solutions_mmd_content}
                  />
                ) : (
                  <Alert>
                    <AlertDescription>No solutions content available</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
