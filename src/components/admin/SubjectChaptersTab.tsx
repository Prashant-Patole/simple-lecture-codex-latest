import { useState, useMemo, useCallback, memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Sparkles, Upload, Download, Loader2, GripVertical, List, HelpCircle } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
} from "@/hooks/useSubjectManagement";
import {
  useSubjectChaptersWithTopics,
  useBatchUpdateChapterOrder,
  useBatchUpdateTopicOrder,
  useOptimizedBulkImport,
} from "@/hooks/useSubjectChaptersOptimized";
import { SubjectSubtopicsSection } from "./SubjectSubtopicsSection";
import { VideoPreview } from "./VideoPreview";
import { toast } from "@/hooks/use-toast";
import { AIRephraseModal } from "./AIRephraseModal";
import { AIGenerateCurriculumDialog } from "./AIGenerateCurriculumDialog";
import { AIGenerateTopicContentDialog } from "./AIGenerateTopicContentDialog";
import { ChapterBulkOperations } from "./ChapterBulkOperations";
import { CurriculumTreeView } from "./CurriculumTreeView";
import { ImportResultsDialog, ImportResults } from "./ImportResultsDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useDatalab } from "@/hooks/useDatalab";
import { useAddAIAssistantDocument } from "@/hooks/useAIAssistantDocuments";

interface SubjectChaptersTabProps {
  subjectId: string;
  subjectName: string;
  categoryId?: string; // Passed from parent to avoid duplicate query
  categoryName?: string;
}

export function SubjectChaptersTab({ subjectId, subjectName, categoryId, categoryName }: SubjectChaptersTabProps) {
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isAIGenerateOpen, setIsAIGenerateOpen] = useState(false);
  const [showTreeView, setShowTreeView] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [generateContentTopicId, setGenerateContentTopicId] = useState<string | null>(null);
  const [generateContentDialogOpen, setGenerateContentDialogOpen] = useState(false);
  const [currentChapterForContent, setCurrentChapterForContent] = useState<any>(null);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [isImportResultsOpen, setIsImportResultsOpen] = useState(false);
  
  const { data: categories } = useAdminCategories();

  // Use categoryId prop instead of duplicate query - O(1) instead of extra API call
  // Memoize category hierarchy - O(1) instead of O(2-10) calls per render
  const categoryHierarchy = useMemo(() => {
    if (!categoryId || !categories) {
      return { parentCategory: 'General', subCategory: 'General' };
    }
    
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      return { parentCategory: 'General', subCategory: 'General' };
    }
    
    // If this is a level 1 category (has parent), find the parent
    if (category.level === 1 && category.parent_id) {
      const parent = categories.find(c => c.id === category.parent_id);
      return {
        parentCategory: parent?.name || 'General',
        subCategory: category.name
      };
    }
    
    // If level 0, use same name for both
    return {
      parentCategory: category.name,
      subCategory: category.name
    };
  }, [categoryId, categories]);
  const [currentTopicForContent, setCurrentTopicForContent] = useState<any>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [editingChapter, setEditingChapter] = useState<any>(null);
  const [editingTopic, setEditingTopic] = useState<any>(null);
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null);
  const [deleteTopicId, setDeleteTopicId] = useState<string | null>(null);
  
  // AI Rephrase states
  const [rephraseModalOpen, setRephraseModalOpen] = useState(false);
  const [rephraseText, setRephraseText] = useState("");
  const [rephraseType, setRephraseType] = useState<"chapter" | "topic">("chapter");
  const [rephraseCallback, setRephraseCallback] = useState<((text: string) => void) | null>(null);

  // Form states
  const [chapterForm, setChapterForm] = useState({
    chapter_number: 1,
    title: "",
    description: "",
    sequence_order: 1,
    video_id: "",
    video_platform: "",
    notes_markdown: "",
    pdf_url: "",
    content_json: null as any,
  });

  const [topicForm, setTopicForm] = useState({
    topic_number: "1" as string,
    title: "",
    estimated_duration_minutes: 60,
    video_id: "",
    video_platform: "",
    notes_markdown: "",
    content_markdown: "",
    pdf_url: "",
    sequence_order: 1,
    content_json: null as any,
    extracted_images: [] as { url: string; pageNumber?: number }[],
  });

  // Use optimized combined query - fetches ALL chapters with topics in ONE call
  const { data: chaptersWithTopics, isLoading } = useSubjectChaptersWithTopics(subjectId);
  
  // Memoize chapters array for compatibility with existing code
  const chapters = useMemo(() => chaptersWithTopics || [], [chaptersWithTopics]);
  
  // O(1) chapter lookup map
  const chapterMap = useMemo(() => 
    new Map(chapters.map(c => [c.id, c])),
    [chapters]
  );
  
  const createChapter = useCreateChapter();
  const updateChapter = useUpdateChapter();
  const deleteChapter = useDeleteChapter();
  const createTopic = useCreateTopic();
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();
  const bulkImport = useOptimizedBulkImport();
  const updateChapterOrder = useBatchUpdateChapterOrder();
  const updateTopicOrder = useBatchUpdateTopicOrder();
  
  // PDF parsing hooks for auto-parse after upload
  const { parsePdfFromUrl, isLoading: isParsingPdf } = useDatalab();
  const addDocument = useAddAIAssistantDocument();

  // Auto-parse handler for chapter PDF uploads
  const handleChapterPdfUploadAndParse = async (pdfUrl: string) => {
    const result = await parsePdfFromUrl(pdfUrl);
    if (result) {
      const parsedContent = result.content_json || result;
      const parsedPages = result.uploaded_images?.length || 0;
      // Note: extracted_images is only for topics, not chapters - don't set it here
      setChapterForm(prev => ({ 
        ...prev, 
        content_json: parsedContent,
      }));
      
      if (subjectId) {
        try {
          const fileName = pdfUrl.split('/').pop() || "document.pdf";
          await addDocument.mutateAsync({
            subjectId,
            chapterId: editingChapter?.id,
            displayName: `${chapterForm.title || 'Chapter'} (chapter)`,
            sourceType: "pdf",
            sourceUrl: pdfUrl,
            fileName,
            contentPreview: JSON.stringify(parsedContent).substring(0, 500),
            fullContent: parsedContent,
          });
          toast({
            title: "PDF Parsed & Saved",
            description: `Document parsed with ${parsedPages} pages`,
          });
        } catch (error) {
          toast({
            title: "PDF Parsed",
            description: `Parsed ${parsedPages} pages but couldn't save to Documents`,
          });
        }
      }
    }
  };

  // Auto-parse handler for topic PDF uploads
  const handleTopicPdfUploadAndParse = async (pdfUrl: string) => {
    const result = await parsePdfFromUrl(pdfUrl);
    if (result) {
      const parsedContent = result.content_json || result;
      const uploadedImages = result.uploaded_images || [];
      setTopicForm(prev => ({ 
        ...prev, 
        content_json: parsedContent,
        extracted_images: uploadedImages.map(img => ({ url: img.url, pageNumber: img.pageNumber })),
      }));
      
      if (subjectId) {
        try {
          const chapterName = selectedChapter ? chapters?.find(c => c.id === selectedChapter)?.title : undefined;
          const fileName = pdfUrl.split('/').pop() || "document.pdf";
          await addDocument.mutateAsync({
            subjectId,
            chapterId: selectedChapter || undefined,
            topicId: editingTopic?.id,
            displayName: chapterName ? `${topicForm.title || 'Topic'} (${chapterName})` : `${topicForm.title || 'Topic'} (topic)`,
            sourceType: "pdf",
            sourceUrl: pdfUrl,
            fileName,
            contentPreview: JSON.stringify(parsedContent).substring(0, 500),
            fullContent: parsedContent,
          });
          toast({
            title: "PDF Parsed & Saved",
            description: `Document parsed with ${uploadedImages.length} pages`,
          });
        } catch (error) {
          toast({
            title: "PDF Parsed",
            description: `Parsed ${uploadedImages.length} pages but couldn't save to Documents`,
          });
        }
      }
    }
  };

  // Fetch all subjects for bulk operations
  const { data: allSubjects } = useQuery({
    queryKey: ['all-subjects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('popular_subjects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  const handleCreateChapter = () => {
    // Validation
    if (!chapterForm.title.trim()) {
      console.error("❌ Validation failed: Chapter title is empty");
      toast({
        title: "Validation Error",
        description: "Chapter title is required",
        variant: "destructive",
      });
      return;
    }

    console.log("=== CREATE CHAPTER DEBUG ===");
    console.log("Subject ID:", subjectId);
    console.log("Chapter Form Data:", chapterForm);
    console.log("Current Chapters Count:", chapters?.length);

    // Sanitize video fields - convert empty strings to null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { extracted_images, ...chapterData } = chapterForm as any;
    const sanitizedForm = {
      ...chapterData,
      video_platform: chapterForm.video_platform || null,
      video_id: chapterForm.video_id || null,
    };

    createChapter.mutate(
      {
        subject_id: subjectId,
        ...sanitizedForm,
      },
      {
        onSuccess: (data) => {
          console.log("✅ Chapter created successfully:", data);
          toast({
            title: "Success",
            description: `Chapter "${chapterForm.title}" created successfully`,
          });
          setIsAddChapterOpen(false);
          setChapterForm({
            chapter_number: (chapters?.length || 0) + 1,
            title: "",
            description: "",
            sequence_order: (chapters?.length || 0) + 1,
            video_id: "",
            video_platform: "",
            notes_markdown: "",
            pdf_url: "",
            content_json: null,
          });
        },
        onError: (error: any) => {
          console.error("❌ Failed to create chapter:", error);
          console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });

          let errorMessage = error.message || "An unexpected error occurred";
          if (error.code === "23505") {
            errorMessage = `A chapter with number ${chapterForm.chapter_number} already exists for this subject`;
          }

          toast({
            title: "Error Creating Chapter",
            description: errorMessage,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpdateChapter = () => {
    if (!editingChapter) return;

    // Sanitize video fields - convert empty strings to null
    const sanitizedForm = {
      ...chapterForm,
      video_platform: chapterForm.video_platform || null,
      video_id: chapterForm.video_id || null,
    };

    updateChapter.mutate(
      {
        id: editingChapter.id,
        updates: sanitizedForm,
      },
      {
        onSuccess: () => {
          setEditingChapter(null);
          setChapterForm({
            chapter_number: 1,
            title: "",
            description: "",
            sequence_order: 1,
            video_id: "",
            video_platform: "",
            notes_markdown: "",
            pdf_url: "",
            content_json: null,
          });
        },
      }
    );
  };

  const handleDeleteChapter = () => {
    if (!deleteChapterId) return;
    deleteChapter.mutate(
      { id: deleteChapterId, subjectId },
      {
        onSuccess: () => setDeleteChapterId(null),
      }
    );
  };

  const handleCreateTopic = () => {
    if (!selectedChapter) {
      console.error("❌ No chapter selected for topic creation");
      toast({
        title: "Error",
        description: "No chapter selected. Please select a chapter first.",
        variant: "destructive",
      });
      return;
    }

    if (!topicForm.title.trim()) {
      console.error("❌ Validation failed: Topic title is empty");
      toast({
        title: "Validation Error",
        description: "Topic title is required",
        variant: "destructive",
      });
      return;
    }

    console.log("=== CREATE TOPIC DEBUG ===");
    console.log("Chapter ID:", selectedChapter);
    console.log("Topic Form Data:", topicForm);

    // Sanitize video fields - convert empty strings to null
    const sanitizedTopicForm = {
      ...topicForm,
      video_platform: topicForm.video_platform || null,
      video_id: topicForm.video_id || null,
    };

    createTopic.mutate(
      {
        chapter_id: selectedChapter,
        ...sanitizedTopicForm,
      },
      {
        onSuccess: (data) => {
          console.log("✅ Topic created successfully:", data);
          toast({
            title: "Success",
            description: `Topic "${topicForm.title}" created successfully`,
          });
          setIsAddTopicOpen(false);
          setTopicForm({
            topic_number: "1",
            title: "",
            estimated_duration_minutes: 60,
            video_id: "",
            video_platform: "",
            notes_markdown: "",
            content_markdown: "",
            pdf_url: "",
            sequence_order: 1,
            content_json: null,
            extracted_images: [],
          });
        },
        onError: (error: any) => {
          console.error("❌ Failed to create topic:", error);
          console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });

          let errorMessage = error.message || "An unexpected error occurred";
          if (error.code === "23505") {
            errorMessage = `A topic with number ${topicForm.topic_number} already exists in this chapter`;
          }

          toast({
            title: "Error Creating Topic",
            description: errorMessage,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpdateTopic = () => {
    if (!editingTopic) return;

    // Sanitize video fields - convert empty strings to null
    const sanitizedTopicForm = {
      ...topicForm,
      video_platform: topicForm.video_platform || null,
      video_id: topicForm.video_id || null,
    };

    updateTopic.mutate(
      {
        id: editingTopic.id,
        updates: sanitizedTopicForm,
      },
      {
        onSuccess: () => {
          setEditingTopic(null);
          setTopicForm({
            topic_number: "1",
            title: "",
            estimated_duration_minutes: 60,
            video_id: "",
            video_platform: "",
            notes_markdown: "",
            content_markdown: "",
            pdf_url: "",
            sequence_order: 1,
            content_json: null,
            extracted_images: [],
          });
        },
      }
    );
  };

  const handleDeleteTopic = () => {
    if (!deleteTopicId || !selectedChapter) return;
    deleteTopic.mutate(
      { id: deleteTopicId, chapterId: selectedChapter },
      {
        onSuccess: () => setDeleteTopicId(null),
      }
    );
  };

  const openRephraseModal = (text: string, type: "chapter" | "topic", callback: (text: string) => void) => {
    setRephraseText(text);
    setRephraseType(type);
    setRephraseCallback(() => callback);
    setRephraseModalOpen(true);
  };

  const handleRephraseAccept = (rephrasedText: string) => {
    if (rephraseCallback) {
      rephraseCallback(rephrasedText);
    }
    setRephraseModalOpen(false);
  };

  const handleExcelImport = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    // Debug: Log raw data to help identify parsing issues
    console.log(`[Excel Import] Total rows read: ${jsonData.length}`);
    console.log(`[Excel Import] First 3 rows:`, jsonData.slice(0, 3));
    console.log(`[Excel Import] Column keys:`, jsonData.length > 0 ? Object.keys(jsonData[0]) : 'No data');

    if (jsonData.length === 0) {
      toast({
        title: "Empty File",
        description: "The Excel file contains no data rows. Make sure data starts from row 2 (row 1 is headers).",
        variant: "destructive",
      });
      return { success: 0, errors: ["No data rows found in file"] };
    }

    // Parse Excel data into chapters with topics and subtopics
    const chaptersMap = new Map<number, any>();
    const topicsMap = new Map<string, any>();
    const parseWarnings: string[] = [];
    let skippedRows = 0;

    jsonData.forEach((row, rowIndex) => {
      // Try multiple possible column names for chapter_number
      const chapterNumRaw = row.chapter_number ?? row.Chapter_Number ?? row.ChapterNumber ?? row["Chapter Number"] ?? row.chapter ?? row.Chapter;
      const chapterNum = parseInt(String(chapterNumRaw));
      
      // Validate chapter number
      if (isNaN(chapterNum) || chapterNum <= 0) {
        skippedRows++;
        if (skippedRows <= 5) {
          parseWarnings.push(`Row ${rowIndex + 2}: Invalid chapter_number "${chapterNumRaw}"`);
        }
        return; // Skip this row
      }
      
      // Use parseFloat to preserve decimal topic numbers (1.1, 1.2, etc.)
      const topicNumRaw = row.topic_number ?? row.Topic_Number ?? row.TopicNumber ?? row["Topic Number"] ?? row.topic ?? row.Topic;
      const topicNum = topicNumRaw ? parseFloat(String(topicNumRaw)) : null;
      const subtopicOrderRaw = row.subtopic_order ?? row.Subtopic_Order ?? row.SubtopicOrder ?? row["Subtopic Order"];
      const subtopicOrder = subtopicOrderRaw ? parseInt(String(subtopicOrderRaw)) : null;

      // Get chapter title with fallback column names
      const chapterTitle = row.chapter_title ?? row.Chapter_Title ?? row.ChapterTitle ?? row["Chapter Title"] ?? `Chapter ${chapterNum}`;
      const chapterDescription = row.chapter_description ?? row.Chapter_Description ?? row.ChapterDescription ?? row["Chapter Description"] ?? "";

      // Create chapter if doesn't exist
      if (!chaptersMap.has(chapterNum)) {
        chaptersMap.set(chapterNum, {
          chapter_number: chapterNum,
          title: chapterTitle,
          description: chapterDescription,
          topics: [],
        });
      }

      // Get topic fields with fallback column names
      const topicTitle = row.topic_title ?? row.Topic_Title ?? row.TopicTitle ?? row["Topic Title"];
      const topicDuration = row.topic_duration_minutes ?? row.Topic_Duration_Minutes ?? row.TopicDurationMinutes ?? row["Topic Duration Minutes"];
      const topicContent = row.topic_content ?? row.Topic_Content ?? row.TopicContent ?? row["Topic Content"];

      // If topic exists, add/update it
      if (topicNum && !isNaN(topicNum) && topicTitle) {
        // Use original string value for unique key to preserve 1.1 vs 1.2 distinction
        const topicKey = `${chapterNum}-${String(topicNumRaw).trim()}`;
        
        if (!topicsMap.has(topicKey)) {
          topicsMap.set(topicKey, {
            topic_number: topicNum,
            title: topicTitle,
            estimated_duration_minutes: parseInt(String(topicDuration)) || 60,
            content_markdown: topicContent || "",
            subtopics: [],
          });
          chaptersMap.get(chapterNum)?.topics.push(topicsMap.get(topicKey));
        }

        // Get subtopic fields with fallback column names
        const subtopicTitle = row.subtopic_title ?? row.Subtopic_Title ?? row.SubtopicTitle ?? row["Subtopic Title"];
        const subtopicDescription = row.subtopic_description ?? row.Subtopic_Description ?? row.SubtopicDescription ?? row["Subtopic Description"];
        const subtopicDuration = row.subtopic_duration_minutes ?? row.Subtopic_Duration_Minutes ?? row.SubtopicDurationMinutes ?? row["Subtopic Duration Minutes"];

        // If subtopic exists, add it
        if (subtopicOrder && subtopicTitle) {
          topicsMap.get(topicKey)?.subtopics.push({
            title: subtopicTitle,
            description: subtopicDescription || "",
            estimated_duration_minutes: parseInt(String(subtopicDuration)) || 30,
            sequence_order: subtopicOrder,
          });
        }
      }
    });

    const chaptersArray = Array.from(chaptersMap.values());

    // Log parsing summary
    console.log(`[Excel Import] Parsed ${chaptersArray.length} chapters, skipped ${skippedRows} rows`);
    if (parseWarnings.length > 0) {
      console.warn(`[Excel Import] Parsing warnings:`, parseWarnings);
    }

    // Show warning if many rows were skipped
    if (skippedRows > 0) {
      const warningMsg = skippedRows > 5 
        ? `${skippedRows} rows skipped due to invalid/missing chapter_number (showing first 5 warnings in console)`
        : `${skippedRows} row(s) skipped: ${parseWarnings.join(', ')}`;
      
      toast({
        title: "Rows Skipped During Import",
        description: warningMsg,
        variant: "default",
      });
    }

    if (chaptersArray.length === 0) {
      toast({
        title: "No Valid Chapters Found",
        description: "Could not parse any chapters from the file. Check that column headers match: chapter_number, chapter_title, etc.",
        variant: "destructive",
      });
      return { success: 0, errors: ["No valid chapters could be parsed from the file"] };
    }

    const result = await bulkImport.mutateAsync({
      subjectId,
      chapters: chaptersArray,
    });

    // Show detailed results dialog
    setImportResults(result);
    setIsImportResultsOpen(true);

    return {
      success: result.chapters + result.topics + result.subtopics,
      errors: result.errors,
    };
  };

  const downloadTemplate = () => {
    // Template uses decimal topic numbers (1.1, 1.2, 2.1) to match common curriculum formats
    const template = [
      // Chapter 1 - Real Numbers (Maths style)
      {
        chapter_number: 1,
        chapter_title: "Real Numbers",
        chapter_description: "Fundamental concepts of real number system",
        topic_number: "",
        topic_title: "",
        topic_duration_minutes: "",
        topic_content: "",
        subtopic_order: "",
        subtopic_title: "",
        subtopic_description: "",
        subtopic_duration_minutes: "",
      },
      // Chapter 1, Topic 1.1
      {
        chapter_number: 1,
        chapter_title: "Real Numbers",
        chapter_description: "Fundamental concepts of real number system",
        topic_number: 1.1,
        topic_title: "Introduction to Real Numbers",
        topic_duration_minutes: 60,
        topic_content: "# Real Numbers\nUnderstanding rational and irrational numbers",
        subtopic_order: 1,
        subtopic_title: "Rational Numbers",
        subtopic_description: "Numbers that can be expressed as p/q",
        subtopic_duration_minutes: 30,
      },
      {
        chapter_number: 1,
        chapter_title: "Real Numbers",
        chapter_description: "Fundamental concepts of real number system",
        topic_number: 1.1,
        topic_title: "Introduction to Real Numbers",
        topic_duration_minutes: 60,
        topic_content: "# Real Numbers\nUnderstanding rational and irrational numbers",
        subtopic_order: 2,
        subtopic_title: "Irrational Numbers",
        subtopic_description: "Numbers that cannot be expressed as p/q",
        subtopic_duration_minutes: 30,
      },
      // Chapter 1, Topic 1.2
      {
        chapter_number: 1,
        chapter_title: "Real Numbers",
        chapter_description: "Fundamental concepts of real number system",
        topic_number: 1.2,
        topic_title: "The Fundamental Theorem of Arithmetic",
        topic_duration_minutes: 90,
        topic_content: "# Fundamental Theorem\nEvery composite number can be expressed as a product of primes",
        subtopic_order: 1,
        subtopic_title: "Prime Factorization",
        subtopic_description: "Breaking numbers into prime factors",
        subtopic_duration_minutes: 45,
      },
      {
        chapter_number: 1,
        chapter_title: "Real Numbers",
        chapter_description: "Fundamental concepts of real number system",
        topic_number: 1.2,
        topic_title: "The Fundamental Theorem of Arithmetic",
        topic_duration_minutes: 90,
        topic_content: "# Fundamental Theorem\nEvery composite number can be expressed as a product of primes",
        subtopic_order: 2,
        subtopic_title: "HCF and LCM",
        subtopic_description: "Finding HCF and LCM using prime factorization",
        subtopic_duration_minutes: 45,
      },
      // Chapter 2 - Polynomials
      {
        chapter_number: 2,
        chapter_title: "Polynomials",
        chapter_description: "Algebraic expressions and their properties",
        topic_number: "",
        topic_title: "",
        topic_duration_minutes: "",
        topic_content: "",
        subtopic_order: "",
        subtopic_title: "",
        subtopic_description: "",
        subtopic_duration_minutes: "",
      },
      // Chapter 2, Topic 2.1
      {
        chapter_number: 2,
        chapter_title: "Polynomials",
        chapter_description: "Algebraic expressions and their properties",
        topic_number: 2.1,
        topic_title: "Introduction to Polynomials",
        topic_duration_minutes: 60,
        topic_content: "# Polynomials\nBasic concepts and definitions",
        subtopic_order: 1,
        subtopic_title: "Degree of a Polynomial",
        subtopic_description: "Understanding polynomial degrees",
        subtopic_duration_minutes: 30,
      },
      {
        chapter_number: 2,
        chapter_title: "Polynomials",
        chapter_description: "Algebraic expressions and their properties",
        topic_number: 2.1,
        topic_title: "Introduction to Polynomials",
        topic_duration_minutes: 60,
        topic_content: "# Polynomials\nBasic concepts and definitions",
        subtopic_order: 2,
        subtopic_title: "Types of Polynomials",
        subtopic_description: "Linear, quadratic, cubic polynomials",
        subtopic_duration_minutes: 30,
      },
      // Chapter 2, Topic 2.2
      {
        chapter_number: 2,
        chapter_title: "Polynomials",
        chapter_description: "Algebraic expressions and their properties",
        topic_number: 2.2,
        topic_title: "Zeros of a Polynomial",
        topic_duration_minutes: 90,
        topic_content: "# Zeros of Polynomials\nFinding roots of polynomial equations",
        subtopic_order: 1,
        subtopic_title: "Relationship between Zeros and Coefficients",
        subtopic_description: "Sum and product of zeros",
        subtopic_duration_minutes: 45,
      },
      {
        chapter_number: 2,
        chapter_title: "Polynomials",
        chapter_description: "Algebraic expressions and their properties",
        topic_number: 2.2,
        topic_title: "Zeros of a Polynomial",
        topic_duration_minutes: 90,
        topic_content: "# Zeros of Polynomials\nFinding roots of polynomial equations",
        subtopic_order: 2,
        subtopic_title: "Division Algorithm",
        subtopic_description: "Dividing polynomials",
        subtopic_duration_minutes: 45,
      },
      // Chapter 3 - Linear Equations
      {
        chapter_number: 3,
        chapter_title: "Pair of Linear Equations in Two Variables",
        chapter_description: "Solving simultaneous equations",
        topic_number: "",
        topic_title: "",
        topic_duration_minutes: "",
        topic_content: "",
        subtopic_order: "",
        subtopic_title: "",
        subtopic_description: "",
        subtopic_duration_minutes: "",
      },
      {
        chapter_number: 3,
        chapter_title: "Pair of Linear Equations in Two Variables",
        chapter_description: "Solving simultaneous equations",
        topic_number: 3.1,
        topic_title: "Graphical Method",
        topic_duration_minutes: 90,
        topic_content: "# Graphical Method\nSolving equations by plotting graphs",
        subtopic_order: 1,
        subtopic_title: "Consistent and Inconsistent Systems",
        subtopic_description: "Types of solutions",
        subtopic_duration_minutes: 45,
      },
      {
        chapter_number: 3,
        chapter_title: "Pair of Linear Equations in Two Variables",
        chapter_description: "Solving simultaneous equations",
        topic_number: 3.1,
        topic_title: "Graphical Method",
        topic_duration_minutes: 90,
        topic_content: "# Graphical Method\nSolving equations by plotting graphs",
        subtopic_order: 2,
        subtopic_title: "Graphical Representation",
        subtopic_description: "Plotting and interpreting graphs",
        subtopic_duration_minutes: 45,
      },
      {
        chapter_number: 3,
        chapter_title: "Pair of Linear Equations in Two Variables",
        chapter_description: "Solving simultaneous equations",
        topic_number: 3.2,
        topic_title: "Algebraic Methods",
        topic_duration_minutes: 120,
        topic_content: "# Algebraic Methods\nSubstitution and elimination techniques",
        subtopic_order: 1,
        subtopic_title: "Substitution Method",
        subtopic_description: "Solving by substitution",
        subtopic_duration_minutes: 40,
      },
      {
        chapter_number: 3,
        chapter_title: "Pair of Linear Equations in Two Variables",
        chapter_description: "Solving simultaneous equations",
        topic_number: 3.2,
        topic_title: "Algebraic Methods",
        topic_duration_minutes: 120,
        topic_content: "# Algebraic Methods\nSubstitution and elimination techniques",
        subtopic_order: 2,
        subtopic_title: "Elimination Method",
        subtopic_description: "Solving by elimination",
        subtopic_duration_minutes: 40,
      },
      {
        chapter_number: 3,
        chapter_title: "Pair of Linear Equations in Two Variables",
        chapter_description: "Solving simultaneous equations",
        topic_number: 3.2,
        topic_title: "Algebraic Methods",
        topic_duration_minutes: 120,
        topic_content: "# Algebraic Methods\nSubstitution and elimination techniques",
        subtopic_order: 3,
        subtopic_title: "Cross-Multiplication Method",
        subtopic_description: "Using cross-multiplication formula",
        subtopic_duration_minutes: 40,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // chapter_number
      { wch: 30 }, // chapter_title
      { wch: 40 }, // chapter_description
      { wch: 15 }, // topic_number
      { wch: 30 }, // topic_title
      { wch: 25 }, // topic_duration_minutes
      { wch: 40 }, // topic_content
      { wch: 15 }, // subtopic_order
      { wch: 35 }, // subtopic_title
      { wch: 40 }, // subtopic_description
      { wch: 25 }, // subtopic_duration_minutes
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chapters");
    XLSX.writeFile(wb, `${subjectName}_chapters_template.xlsx`);
    
    toast({
      title: "Template Downloaded",
      description: "Excel template with 3 complete chapter examples downloaded",
    });
  };

  const handleDragEndChapters = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !chapters) return;

    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);

    const reorderedChapters = arrayMove(chapters, oldIndex, newIndex);
    const updates = reorderedChapters.map((chapter, index) => ({
      id: chapter.id,
      sequence_order: index + 1,
    }));

    updateChapterOrder.mutate({ chapters: updates, subjectId });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chapters & Topics</CardTitle>
              <CardDescription>
                Organize {subjectName} curriculum into chapters and topics
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTreeView(!showTreeView)}
                    >
                      <List className="mr-2 h-4 w-4" />
                      {showTreeView ? "Table View" : "Tree View"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle between table and tree view of curriculum</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={downloadTemplate}>
                      <Download className="mr-2 h-4 w-4" />
                      Template
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold">Excel Import Instructions:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Download the template with 3 example chapters</li>
                        <li>Fill chapter_number, chapter_title, chapter_description</li>
                        <li>Add topic_number, topic_title for each topic</li>
                        <li>Add subtopic_order, subtopic_title for subtopics</li>
                        <li>Duplicate chapters will be skipped automatically</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setIsExcelImportOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Bulk Import
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Import chapters from Excel file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="default"
                onClick={() => setIsAIGenerateOpen(true)}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Generate
              </Button>

              <Dialog
                open={isAddChapterOpen || !!editingChapter}
                onOpenChange={(open) => {
                  if (!open) {
                    setIsAddChapterOpen(false);
                    setEditingChapter(null);
                    setChapterForm({
                      chapter_number: 1,
                      title: "",
                      description: "",
                      sequence_order: 1,
                      video_id: "",
                      video_platform: "",
                      notes_markdown: "",
                      pdf_url: "",
                      content_json: null,
                    });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button onClick={() => setIsAddChapterOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Chapter
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingChapter ? "Edit Chapter" : "Add New Chapter"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingChapter ? "Update chapter details" : "Create a new chapter for this subject"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="chapter-number">Chapter Number *</Label>
                        <Input
                          id="chapter-number"
                          type="number"
                          value={chapterForm.chapter_number}
                          onChange={(e) =>
                            setChapterForm({
                              ...chapterForm,
                              chapter_number: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chapter-sequence">Sequence Order</Label>
                        <Input
                          id="chapter-sequence"
                          type="number"
                          value={chapterForm.sequence_order}
                          onChange={(e) =>
                            setChapterForm({
                              ...chapterForm,
                              sequence_order: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="chapter-title">Chapter Title *</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openRephraseModal(
                              chapterForm.title,
                              "chapter",
                              (text) => setChapterForm({ ...chapterForm, title: text })
                            )
                          }
                          disabled={!chapterForm.title}
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          AI Rephrase
                        </Button>
                      </div>
                      <Input
                        id="chapter-title"
                        placeholder="e.g., Mechanics"
                        value={chapterForm.title}
                        onChange={(e) =>
                          setChapterForm({ ...chapterForm, title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chapter-description">Description</Label>
                      <Textarea
                        id="chapter-description"
                        placeholder="Brief description of the chapter..."
                        rows={3}
                        value={chapterForm.description}
                        onChange={(e) =>
                          setChapterForm({ ...chapterForm, description: e.target.value })
                        }
                      />
                    </div>

                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddChapterOpen(false);
                        setEditingChapter(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={editingChapter ? handleUpdateChapter : handleCreateChapter}
                      disabled={
                        !chapterForm.title ||
                        createChapter.isPending ||
                        updateChapter.isPending
                      }
                    >
                      {createChapter.isPending || updateChapter.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingChapter ? (
                        "Update Chapter"
                      ) : (
                        "Add Chapter"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Operations Bar */}
          {chapters && chapters.length > 0 && !showTreeView && (
            <div className="mb-4">
              <ChapterBulkOperations
                subjectId={subjectId}
                chapters={chapters}
                subjects={allSubjects || []}
              />
            </div>
          )}

          {/* Scrollable chapters container */}
          <div className="max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : showTreeView ? (
              <CurriculumTreeView subjectId={subjectId} subjectName={subjectName} />
            ) : chapters && chapters.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndChapters}
              >
                <SortableContext
                  items={chapters.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {chapters.map((chapter) => (
                      <SortableChapterItem
                        key={chapter.id}
                        chapter={chapter}
                        isExpanded={expandedChapters.has(chapter.id)}
                        onToggle={() => toggleChapter(chapter.id)}
                        onEdit={() => {
                          setEditingChapter(chapter);
                          setChapterForm({
                            chapter_number: chapter.chapter_number,
                            title: chapter.title,
                            description: chapter.description || "",
                            sequence_order: chapter.sequence_order,
                            video_id: chapter.video_id || "",
                            video_platform: chapter.video_platform || "",
                            notes_markdown: chapter.notes_markdown || "",
                            pdf_url: chapter.pdf_url || "",
                            content_json: (chapter as any).content_json || null,
                          });
                        }}
                        onDelete={() => setDeleteChapterId(chapter.id)}
                        onAddTopic={() => {
                          setSelectedChapter(chapter.id);
                          setIsAddTopicOpen(true);
                        }}
                        onEditTopic={(topic) => {
                          setSelectedChapter(chapter.id);
                          setEditingTopic(topic);
                          setTopicForm({
                            topic_number: topic.topic_number,
                            title: topic.title,
                            estimated_duration_minutes: topic.estimated_duration_minutes || 60,
                            video_id: topic.video_id || "",
                            video_platform: topic.video_platform || "",
                            notes_markdown: topic.notes_markdown || "",
                            content_markdown: topic.content_markdown || "",
                            pdf_url: topic.pdf_url || "",
                            sequence_order: topic.sequence_order,
                            content_json: (topic as any).content_json || null,
                            extracted_images: (topic as any).extracted_images || [],
                          });
                        }}
                        onDeleteTopic={(topicId) => {
                          setSelectedChapter(chapter.id);
                          setDeleteTopicId(topicId);
                        }}
                        onGenerateContent={(topicId, topicData, chapterData) => {
                          setGenerateContentTopicId(topicId);
                          setCurrentChapterForContent(chapterData);
                          setCurrentTopicForContent(topicData);
                          setGenerateContentDialogOpen(true);
                        }}
                        subjectId={subjectId}
                        subjectName={subjectName}
                        categoryId={categoryId || ''}
                        parentCategoryName={categoryHierarchy.parentCategory}
                        subCategoryName={categoryHierarchy.subCategory}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <p>No chapters added yet</p>
                <p className="text-sm mt-2">Click "Add Chapter" to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Topic Dialog */}
      <Dialog
        open={isAddTopicOpen || !!editingTopic}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddTopicOpen(false);
            setEditingTopic(null);
            setTopicForm({
              topic_number: "1",
              title: "",
              estimated_duration_minutes: 60,
              video_id: "",
              video_platform: "",
              notes_markdown: "",
              content_markdown: "",
              pdf_url: "",
              sequence_order: 1,
              content_json: null,
              extracted_images: [],
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Edit Topic" : "Add New Topic"}</DialogTitle>
            <DialogDescription>
              {editingTopic ? "Update topic details" : "Create a new topic for this chapter"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="topic-number">Topic Number *</Label>
                <Input
                  id="topic-number"
                  type="text"
                  value={topicForm.topic_number}
                  onChange={(e) =>
                    setTopicForm({
                      ...topicForm,
                      topic_number: e.target.value || "1",
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic-duration">Duration (minutes)</Label>
                <Input
                  id="topic-duration"
                  type="number"
                  value={topicForm.estimated_duration_minutes}
                  onChange={(e) =>
                    setTopicForm({
                      ...topicForm,
                      estimated_duration_minutes: parseInt(e.target.value) || 60,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="topic-title">Topic Title *</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    openRephraseModal(
                      topicForm.title,
                      "topic",
                      (text) => setTopicForm({ ...topicForm, title: text })
                    )
                  }
                  disabled={!topicForm.title}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI Rephrase
                </Button>
              </div>
              <Input
                id="topic-title"
                placeholder="e.g., Newton's Laws"
                value={topicForm.title}
                onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddTopicOpen(false);
                setEditingTopic(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingTopic ? handleUpdateTopic : handleCreateTopic}
              disabled={
                !topicForm.title || createTopic.isPending || updateTopic.isPending
              }
            >
              {createTopic.isPending || updateTopic.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingTopic ? (
                "Update Topic"
              ) : (
                "Add Topic"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Chapter Confirmation */}
      <AlertDialog open={!!deleteChapterId} onOpenChange={() => setDeleteChapterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the chapter and all its topics. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChapter}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Topic Confirmation */}
      <AlertDialog open={!!deleteTopicId} onOpenChange={() => setDeleteTopicId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the topic. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTopic}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Rephrase Modal */}
      <AIRephraseModal
        open={rephraseModalOpen}
        onOpenChange={setRephraseModalOpen}
        originalText={rephraseText}
        type={rephraseType}
        onAccept={handleRephraseAccept}
      />

      {/* Excel Import Modal */}
      <Dialog open={isExcelImportOpen} onOpenChange={setIsExcelImportOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Chapters, Topics & Subtopics
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file with chapter, topic, and subtopic structure. Existing chapters will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instructions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Excel Format Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Chapter only:</strong> Fill chapter_number, chapter_title, chapter_description. Leave topic fields empty.</li>
                  <li><strong>Chapter with Topic:</strong> Repeat chapter info + fill topic_number, topic_title, topic_duration_minutes.</li>
                  <li><strong>Topic with Subtopic:</strong> Repeat chapter & topic info + fill subtopic_order, subtopic_title, subtopic_description.</li>
                  <li>Chapters with duplicate chapter_number will be skipped automatically.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Download Template Button */}
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Excel Template with Examples
            </Button>

            {/* File Upload Section */}
            <div className="space-y-2">
              <Label htmlFor="chapters-excel">Upload Excel File (.xlsx)</Label>
              <Input
                id="chapters-excel"
                type="file"
                accept=".xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      await handleExcelImport(file);
                      setIsExcelImportOpen(false);
                    } catch (error) {
                      console.error("Import error:", error);
                    }
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExcelImportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Curriculum Dialog */}
      <AIGenerateCurriculumDialog
        open={isAIGenerateOpen}
        onOpenChange={setIsAIGenerateOpen}
        subjectId={subjectId}
        subjectName={subjectName}
        categoryName={categoryName}
      />

      {/* AI Generate Topic Content Dialog */}
      <AIGenerateTopicContentDialog
        open={generateContentDialogOpen}
        onOpenChange={setGenerateContentDialogOpen}
        topicId={generateContentTopicId}
        topicData={currentTopicForContent}
        chapterTitle={currentChapterForContent?.title || ""}
        chapterDescription={currentChapterForContent?.description}
        subjectName={subjectName}
        categoryName={categoryName || ""}
      />

      {/* Import Results Dialog */}
      <ImportResultsDialog
        isOpen={isImportResultsOpen}
        onClose={() => setIsImportResultsOpen(false)}
        results={importResults}
      />
    </div>
  );
}

// Sortable Chapter Item Wrapper
interface SortableChapterItemProps extends ChapterItemProps {
  chapter: any;
}

function SortableChapterItem(props: SortableChapterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ChapterItem {...props} dragHandleProps={{ attributes, listeners }} />
    </div>
  );
}

// Chapter Item Component with Topics - Now receives topics from props (no N+1 query!)
interface ChapterItemProps {
  chapter: any;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddTopic: () => void;
  onEditTopic: (topic: any) => void;
  onDeleteTopic: (topicId: string) => void;
  onGenerateContent: (topicId: string, topicData: any, chapterData: any) => void;
  dragHandleProps?: any;
  subjectId: string;
  subjectName: string;
  categoryId: string;
  parentCategoryName: string;
  subCategoryName: string;
}

// Memoized ChapterItem to prevent re-renders during drag operations
const ChapterItem = memo(function ChapterItem({
  chapter,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onGenerateContent,
  dragHandleProps,
  subjectId,
  subjectName,
  categoryId,
  parentCategoryName,
  subCategoryName,
}: ChapterItemProps) {
  // Topics now come from the joined query via chapter.subject_topics - NO separate API call!
  const topics = chapter.subject_topics || [];

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  {...dragHandleProps?.attributes}
                  {...dragHandleProps?.listeners}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Chapter {chapter.chapter_number}</Badge>
                    <h3 className="font-semibold">{chapter.title}</h3>
                  </div>
                  {chapter.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {chapter.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Badge variant="secondary">{topics.length} topics</Badge>
                <Button variant="ghost" size="icon" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Topics</h4>
              <Button variant="outline" size="sm" onClick={onAddTopic}>
                <Plus className="h-4 w-4 mr-1" />
                Add Topic
              </Button>
            </div>
            {topics.length > 0 ? (
              <div className="space-y-2">
                {topics.map((topic: any) => (
                  <Card key={topic.id} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {topic.topic_number}
                            </Badge>
                            <span className="font-medium">{topic.title}</span>
                          </div>
                          {topic.estimated_duration_minutes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Duration: {topic.estimated_duration_minutes} mins
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {topic.video_id && (
                              <Badge variant="secondary" className="text-xs">
                                Video: {topic.video_platform}
                              </Badge>
                            )}
                            {topic.pdf_url && (
                              <Badge variant="secondary" className="text-xs">
                                Has PDF
                              </Badge>
                            )}
                           {topic.notes_markdown && (
                              <Badge variant="secondary" className="text-xs">
                                Has Notes
                              </Badge>
                            )}
                            {topic.content_markdown && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Sparkles className="h-3 w-3" />
                                AI Content
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onGenerateContent(topic.id, topic, chapter)}
                                  className="text-primary hover:text-primary/80"
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Generate Content
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Use AI to create detailed learning content, examples, and practice questions</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditTopic(topic)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteTopic(topic.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Subtopics Section */}
                      <SubjectSubtopicsSection
                        topicId={topic.id}
                        topicTitle={topic.title}
                        subjectId={subjectId}
                        subjectName={subjectName}
                        categoryId={categoryId}
                        parentCategoryName={parentCategoryName}
                        subCategoryName={subCategoryName}
                        chapterName={chapter.title}
                        chapterId={chapter.id}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No topics added yet
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
