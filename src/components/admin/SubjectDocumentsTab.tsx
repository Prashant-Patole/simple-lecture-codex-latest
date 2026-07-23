import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, FileJson, FileText, Loader2, Check, Copy, Eye, EyeOff,
  Clock, Trash2, Link as LinkIcon, BookOpen, Filter, FileSpreadsheet,
  Presentation, Image as ImageIcon, FileCode, File, BrainCircuit
} from "lucide-react";
import { useDatalab } from "@/hooks/useDatalab";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useExtractJsonQuestions } from "@/hooks/useExtractJsonQuestions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIAssistantDocuments, useAddAIAssistantDocument, useDeleteAIAssistantDocument, AIAssistantDocument } from "@/hooks/useAIAssistantDocuments";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectChaptersTopics";
import { format } from "date-fns";
import { DocumentImageViewer } from "./DocumentImageViewer";
import { useB2Upload } from "@/hooks/useB2Upload";
import { generateB2Path } from "@/lib/b2PathGenerator";

interface SubjectDocumentsTabProps {
  subjectId: string;
  subjectName: string;
  currentJson?: any;
  currentPdfUrl?: string;
}

export function SubjectDocumentsTab({ 
  subjectId, 
  subjectName, 
  currentJson, 
  currentPdfUrl 
}: SubjectDocumentsTabProps) {
  const [jsonContent, setJsonContent] = useState<any>(currentJson || null);
  const [jsonText, setJsonText] = useState<string>(currentJson ? JSON.stringify(currentJson, null, 2) : "");
  const [pdfUrl, setPdfUrl] = useState<string>(currentPdfUrl || "");
  const [showPreview, setShowPreview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"markdown" | "json">("markdown");
  
  // Filter states
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  
  // Document viewer states
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<{url: string, label?: string, pageNumber?: number}[]>([]);
  const [viewerDocName, setViewerDocName] = useState("");
  
  // Upload assignment states
  const [uploadChapterId, setUploadChapterId] = useState<string | null>(null);
  const [uploadTopicId, setUploadTopicId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const { parsePdfFile, parsePdfFromUrl, isLoading, progress } = useDatalab();
  const { uploadFile: uploadToB2, uploading: b2Uploading, progress: b2Progress } = useB2Upload();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch chapters and topics
  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: filterTopics } = useChapterTopics(selectedChapterId || undefined);
  const { data: uploadTopics } = useChapterTopics(uploadChapterId || undefined);
  
  // Fetch AI assistant documents for this subject with filters
  const { data: documents, isLoading: isLoadingDocuments } = useAIAssistantDocuments(
    subjectId,
    selectedChapterId,
    selectedTopicId
  );
  const addDocument = useAddAIAssistantDocument();
  const deleteDocument = useDeleteAIAssistantDocument();
  const extractQuestions = useExtractJsonQuestions();
  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);

  const handleExtractQuestions = useCallback(async (doc: AIAssistantDocument) => {
    const fullContent = doc.full_content as any;
    if (!fullContent) {
      toast({ title: "No Content", description: "Document has no parsed content to extract from", variant: "destructive" });
      return;
    }
    setExtractingDocId(doc.id);
    extractQuestions.mutate({
      contentJson: fullContent,
      subjectId,
      chapterId: doc.chapter_id || subjectId,
      topicId: doc.topic_id || undefined,
      entityType: "chapter",
      entityName: doc.display_name || doc.file_name || "Document",
    }, {
      onSettled: () => setExtractingDocId(null),
    });
  }, [subjectId, extractQuestions, toast]);
  
  // Helper to get chapter/topic names
  const getChapterName = (chapterId: string | null) => {
    if (!chapterId || !chapters) return null;
    const chapter = chapters.find(c => c.id === chapterId);
    return chapter ? `Ch. ${chapter.chapter_number}: ${chapter.title}` : null;
  };
  
  const getTopicName = (topicId: string | null, chapterId: string | null) => {
    if (!topicId) return null;
    // We need to find topic from the right chapter's topics
    const chapter = chapters?.find(c => c.id === chapterId);
    if (!chapter) return null;
    return `Topic ${topicId.substring(0, 8)}...`; // Fallback since we don't have all topics loaded
  };

  // Supported document extensions
  const SUPPORTED_EXTENSIONS = ".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.svg,.html,.epub,.md,.markdown";
  
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadedFile(file); // Keep raw file for B2 upload on save
    const result = await parsePdfFile(file);
    if (result) {
      // Store full result including markdown, images, and metadata
      setJsonContent(result);
      setJsonText(JSON.stringify(result, null, 2));
    }
  };

  const handleParsePdfUrl = async () => {
    if (!pdfUrl) {
      toast({
        title: "No URL",
        description: "Please enter a PDF URL first",
        variant: "destructive",
      });
      return;
    }

    setUploadedFileName("");
    const result = await parsePdfFromUrl(pdfUrl);
    if (result) {
      // Store full result including markdown, images, and metadata
      setJsonContent(result);
      setJsonText(JSON.stringify(result, null, 2));
    }
  };

  const handleJsonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setJsonContent(parsed);
      setJsonText(JSON.stringify(parsed, null, 2));
      setUploadedFileName(file.name);
      toast({
        title: "JSON Loaded",
        description: "JSON file loaded successfully",
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Failed to parse JSON file",
        variant: "destructive",
      });
    }
  };

  const handleJsonTextChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonContent(parsed);
    } catch {
      // Invalid JSON, keep the text but don't update jsonContent
    }
  };

  // Source type for documents
  type DocumentSourceType = "pdf" | "json" | "url" | "docx" | "pptx" | "xlsx" | "image" | "html" | "markdown" | "epub" | "document";

  // Helper to detect source type from file extension
  const getSourceTypeFromFileName = (fileName: string): DocumentSourceType => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (ext === 'pdf') return 'pdf';
    if (['docx', 'doc'].includes(ext)) return 'docx';
    if (['pptx', 'ppt'].includes(ext)) return 'pptx';
    if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return 'image';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (ext === 'epub') return 'epub';
    if (ext === 'json') return 'json';
    return 'document';
  };

  const handleSave = async () => {
    if (!jsonContent) {
      toast({
        title: "No Content",
        description: "Please parse a document or upload JSON first",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Determine source type from file or URL
      let sourceType: DocumentSourceType = 'document';
      if (pdfUrl) {
        sourceType = 'url';
      } else if (uploadedFileName) {
        sourceType = getSourceTypeFromFileName(uploadedFileName);
      }
      
      // Extract markdown for preview (use content_markdown if available, else stringify)
      const markdownPreview = jsonContent.content_markdown 
        ? jsonContent.content_markdown.substring(0, 500)
        : JSON.stringify(jsonContent).substring(0, 500);
      
      // Upload original file to B2 if we have one
      let b2SourceUrl: string | undefined = pdfUrl || undefined;
      if (uploadedFile) {
        const displayName = uploadedFileName || uploadedFile.name;
        const b2Path = generateB2Path({
          parentCategoryName: "AI_Documents",
          subCategoryName: subjectName,
          subjectName: subjectName,
          entityType: "chapter",
          entityName: displayName.replace(/\.[^/.]+$/, ''), // strip extension
          fileName: uploadedFile.name,
        });

        const b2Result = await uploadToB2(uploadedFile, b2Path, {
          entityType: 'chapter',
          subjectId: subjectId,
        });

        if (!b2Result) {
          // Upload failed — abort save
          setIsSaving(false);
          return;
        }
        b2SourceUrl = b2Result.filePath;
      }
      
      await addDocument.mutateAsync({
        subjectId,
        chapterId: uploadChapterId || undefined,
        topicId: uploadTopicId || undefined,
        displayName: uploadedFileName || (pdfUrl ? new URL(pdfUrl).pathname.split('/').pop() : "Pasted JSON"),
        sourceType,
        sourceUrl: b2SourceUrl,
        fileName: uploadedFileName || undefined,
        contentPreview: markdownPreview,
        fullContent: jsonContent, // Full result with markdown, images, metadata
      });

      toast({
        title: "Saved",
        description: "Document saved to AI Assistant",
      });
      
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-documents", subjectId] });
      
      // Reset form
      setJsonContent(null);
      setJsonText("");
      setPdfUrl("");
      setUploadedFileName("");
      setUploadedFile(null);
      setUploadChapterId(null);
      setUploadTopicId(null);
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonText);
    toast({
      title: "Copied",
      description: "JSON copied to clipboard",
    });
  };

  const handleDeleteDocument = (docId: string) => {
    deleteDocument.mutate({ documentId: docId, subjectId });
  };

  const handleViewDocument = (doc: AIAssistantDocument) => {
    const fullContent = doc.full_content as any;
    const uploadedImages = fullContent?.uploaded_images || [];
    
    if (uploadedImages.length === 0) {
      toast({
        title: "No Preview Available",
        description: "This document doesn't have page images. Try re-uploading the PDF.",
        variant: "destructive",
      });
      return;
    }
    
    const images = uploadedImages.map((img: any, idx: number) => ({
      url: img.url,
      label: `Page ${img.pageNumber || idx + 1}`,
      pageNumber: img.pageNumber || idx + 1,
    }));
    
    setViewerImages(images);
    setViewerDocName(doc.display_name || doc.file_name || "Document");
    setViewerOpen(true);
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "url":
        return <LinkIcon className="h-4 w-4 text-blue-500" />;
      case "json":
        return <FileJson className="h-4 w-4 text-yellow-500" />;
      case "pdf":
        return <FileText className="h-4 w-4 text-red-500" />;
      case "docx":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "pptx":
        return <Presentation className="h-4 w-4 text-orange-500" />;
      case "xlsx":
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case "image":
        return <ImageIcon className="h-4 w-4 text-purple-500" />;
      case "html":
      case "markdown":
        return <FileCode className="h-4 w-4 text-cyan-500" />;
      case "epub":
        return <BookOpen className="h-4 w-4 text-amber-600" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const displayedDocuments = showAllDocuments ? documents : documents?.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Uploaded AI Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Assistant Documents
          </CardTitle>
          <CardDescription>
            Documents parsed and uploaded for the AI Teaching Assistant for {subjectName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filter by:</span>
            </div>
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div className="space-y-1">
                <Label className="text-xs">Chapter</Label>
                <Select 
                  value={selectedChapterId || "all"} 
                  onValueChange={(v) => {
                    setSelectedChapterId(v === "all" ? null : v);
                    setSelectedTopicId(null);
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All Chapters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chapters</SelectItem>
                    {chapters?.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.chapter_number}. {ch.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedChapterId && (
                <div className="space-y-1">
                  <Label className="text-xs">Topic</Label>
                  <Select 
                    value={selectedTopicId || "all"} 
                    onValueChange={(v) => setSelectedTopicId(v === "all" ? null : v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="All Topics in Chapter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics in Chapter</SelectItem>
                      {filterTopics?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.topic_number}. {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {(selectedChapterId || selectedTopicId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedChapterId(null);
                  setSelectedTopicId(null);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {isLoadingDocuments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No documents found{selectedChapterId ? " for selected filter" : ""}.</p>
              <p className="text-sm mt-1">Upload a PDF or JSON below to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedDocuments?.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getSourceIcon(doc.source_type)}
                            <span className="truncate max-w-[200px]">
                              {doc.display_name || doc.file_name || "Untitled Document"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.chapter_id ? (
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="secondary" className="text-xs">
                                {getChapterName(doc.chapter_id) || "Chapter"}
                                {doc.topic_id && " • Topic"}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">General</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {doc.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Clock className="h-3 w-3" />
                            <div className="flex flex-col">
                              <span>{doc.created_at ? format(new Date(doc.created_at), "MMM d, yyyy") : "-"}</span>
                              {doc.created_at && (
                                <span className="text-xs text-muted-foreground/70">
                                  {format(new Date(doc.created_at), "HH:mm")}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExtractQuestions(doc)}
                              disabled={extractingDocId === doc.id}
                              title="Extract questions from document"
                              className="text-primary hover:text-primary"
                            >
                              {extractingDocId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <BrainCircuit className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDocument(doc)}
                              title="View document pages"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-destructive hover:text-destructive"
                              title="Delete document"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {documents.length > 5 && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllDocuments(!showAllDocuments)}
                  >
                    {showAllDocuments 
                      ? "Show Less" 
                      : `See More (${documents.length - 5} more)`
                    }
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload New Document Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload New Document
          </CardTitle>
          <CardDescription>
            Upload documents (PDF, Word, PowerPoint, Excel, Images, HTML, Markdown) to parse with AI, or upload JSON directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Assign to Chapter/Topic */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" />
              Assign Document Location (Optional)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Chapter</Label>
                <Select 
                  value={uploadChapterId || "none"} 
                  onValueChange={(v) => {
                    setUploadChapterId(v === "none" ? null : v);
                    setUploadTopicId(null);
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="General Subject Document" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General Subject Document</SelectItem>
                    {chapters?.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.chapter_number}. {ch.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {uploadChapterId && (
                <div className="space-y-1">
                  <Label className="text-xs">Topic</Label>
                  <Select 
                    value={uploadTopicId || "none"} 
                    onValueChange={(v) => setUploadTopicId(v === "none" ? null : v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Chapter-level Document" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Chapter-level Document</SelectItem>
                      {uploadTopics?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.topic_number}. {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <Tabs defaultValue="document" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="document" className="gap-2">
                <Upload className="h-4 w-4" />
                Parse Document
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-2">
                <FileJson className="h-4 w-4" />
                Upload JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="document" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Upload Document</Label>
                <p className="text-xs text-muted-foreground">
                  Supports PDF, Word, PowerPoint, Excel, Images (PNG, JPG, GIF, SVG), HTML, EPUB, and Markdown files.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept={SUPPORTED_EXTENSIONS}
                    onChange={handleDocumentUpload}
                    disabled={isLoading}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Or Parse from Document URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/document.pdf"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleParsePdfUrl} 
                    disabled={isLoading || !pdfUrl}
                    variant="secondary"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Parse
                  </Button>
                </div>
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{progress}</span>
                </div>
              )}
            </TabsContent>

            <TabsContent value="json" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Upload JSON File</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleJsonFileUpload}
                />
              </div>

              <div className="space-y-2">
                <Label>Or Paste JSON</Label>
                <Textarea
                  placeholder='{"content": "..."}'
                  value={jsonText}
                  onChange={(e) => handleJsonTextChange(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
            </TabsContent>
          </Tabs>

          {jsonContent && (
            <div className="space-y-3">
              {/* Header with toggle */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Label>Parsed Content</Label>
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    {jsonContent.success !== false ? "Success" : "Parsed"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex gap-1">
                    <Button
                      variant={viewMode === "markdown" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("markdown")}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Markdown
                    </Button>
                    <Button
                      variant={viewMode === "json" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("json")}
                    >
                      <FileJson className="h-3.5 w-3.5 mr-1" />
                      JSON
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Metadata bar */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                <span>📄 Pages: {jsonContent.metadata?.pages || "N/A"}</span>
                <span>🖼️ Images: {jsonContent.uploaded_images?.length || 0}</span>
                <span className={jsonContent.success !== false ? "text-primary" : "text-muted-foreground"}>
                  ● Status: {jsonContent.success !== false ? "Ready" : "Check content"}
                </span>
              </div>
              
              {/* Content area with toggle */}
              {showPreview && (
                <ScrollArea className="h-[300px] rounded-lg border bg-muted/50 p-4">
                  {viewMode === "markdown" ? (
                    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                      {jsonContent.content_markdown || "No markdown content available. View JSON for full data."}
                    </pre>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(jsonContent, null, 2)}
                    </pre>
                  )}
                </ScrollArea>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || b2Uploading || !jsonContent}
              className="gap-2"
            >
              {b2Uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading to B2... {b2Progress}%
                </>
              ) : isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save to AI Assistant
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document Image Viewer */}
      <DocumentImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={viewerImages}
        fileName={viewerDocName}
      />
    </div>
  );
}
