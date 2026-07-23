import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBulkImportQuestions } from "@/hooks/useSubjectQuestions";
import { toast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
}

interface QuestionRow {
  topic_id: string;
  question_text: string;
  question_format: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer: string;
  explanation?: string;
  difficulty: string;
  marks: number;
  contains_formula?: boolean;
  formula_type?: string;
}

export function ExcelImportModal({ isOpen, onClose, subjectId }: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const bulkImportMutation = useBulkImportQuestions();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrors([]);
      setSuccessCount(0);
      setProgress(0);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        topic_id: "Example: 616b36c6-5820-4c1d-8110-ec899a5d232d",
        question_text: "What is the unit of electric charge?",
        question_format: "single_choice",
        option_a: "Ampere",
        option_b: "Coulomb",
        option_c: "Volt",
        option_d: "Ohm",
        correct_answer: "B",
        explanation: "Coulomb is the SI unit of electric charge",
        difficulty: "easy",
        marks: 1,
        contains_formula: false,
        formula_type: "plain"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions Template");
    
    // Set column widths
    const colWidths = [
      { wch: 40 }, // topic_id
      { wch: 50 }, // question_text
      { wch: 15 }, // question_format
      { wch: 30 }, // option_a
      { wch: 30 }, // option_b
      { wch: 30 }, // option_c
      { wch: 30 }, // option_d
      { wch: 10 }, // correct_answer
      { wch: 40 }, // explanation
      { wch: 10 }, // difficulty
      { wch: 8 },  // marks
      { wch: 15 }, // contains_formula
      { wch: 12 }  // formula_type
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, "questions_template.xlsx");
    toast({
      title: "Template Downloaded",
      description: "Excel template has been downloaded. Fill it with your questions and upload.",
    });
  };

  const processExcelFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);
    setErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as QuestionRow[];

      setProgress(30);

      if (jsonData.length === 0) {
        throw new Error("No data found in Excel file");
      }

      // Validate and transform data
      const questions = jsonData.map((row, index) => {
        if (!row.topic_id || !row.question_text || !row.correct_answer) {
          throw new Error(`Row ${index + 1}: Missing required fields (topic_id, question_text, correct_answer)`);
        }

        const options: Record<string, any> = {};
        if (row.option_a) options.A = { text: row.option_a };
        if (row.option_b) options.B = { text: row.option_b };
        if (row.option_c) options.C = { text: row.option_c };
        if (row.option_d) options.D = { text: row.option_d };

        return {
          topic_id: row.topic_id,
          question_text: row.question_text,
          question_type: row.question_format === "true_false" ? "true_false" : 
                        (row.question_format === "single_choice" || row.question_format === "multiple_choice") ? "mcq" : "subjective",
          question_format: row.question_format || "single_choice",
          options: Object.keys(options).length > 0 ? options : null,
          correct_answer: row.correct_answer,
          explanation: row.explanation || null,
          difficulty: row.difficulty || "medium",
          marks: row.marks || 1,
          is_verified: false,
          is_ai_generated: false,
          contains_formula: row.contains_formula || false,
          formula_type: row.formula_type || null,
          question_image_url: null,
          option_images: null,
        };
      });

      setProgress(60);

      // Import questions
      const result = await bulkImportMutation.mutateAsync({ questions });
      
      setProgress(100);
      setSuccessCount(result.success);
      setErrors(result.errors);

      if (result.errors.length === 0) {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${result.success} questions`,
        });
        setTimeout(() => {
          onClose();
          resetForm();
        }, 2000);
      } else {
        toast({
          title: "Import Completed with Errors",
          description: `Imported ${result.success} questions, but ${result.errors.length} batches failed`,
          variant: "destructive",
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setErrors([errorMessage]);
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setProgress(0);
    setErrors([]);
    setSuccessCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
      resetForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Questions from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Download Template */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Step 1: Download Template</CardTitle>
              <CardDescription>
                Download the Excel template to see the required format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Excel Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload File */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Step 2: Upload Your File</CardTitle>
              <CardDescription>
                Upload your completed Excel file with questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label htmlFor="excel-file">Excel File (.xlsx)</Label>
                <Input
                  ref={fileInputRef}
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    {file.name}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Import Progress */}
          {isProcessing && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Import Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    {progress < 30 ? "Reading file..." :
                     progress < 60 ? "Validating data..." :
                     progress < 100 ? "Importing questions..." : "Complete!"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {(successCount > 0 || errors.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Import Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {successCount > 0 && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Successfully imported {successCount} questions
                    </AlertDescription>
                  </Alert>
                )}
                
                {errors.map((error, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Cancel"}
            </Button>
            
            <Button
              onClick={processExcelFile}
              disabled={!file || isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Questions
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
