import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { RichContentEditor } from "./RichContentEditor";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
interface QuestionTabContentProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  categories: any[];
  subjects: any[];
  chapters: any[];
  topics: any[];
  onAIRephrase?: () => void;
  isRephrasing?: boolean;
  simpleEditMode?: boolean;
}

export const QuestionTabContent: React.FC<QuestionTabContentProps> = ({
  formData,
  onChange,
  categories,
  subjects,
  chapters,
  topics,
  onAIRephrase,
  isRephrasing,
  simpleEditMode,
}) => {
  return (
    <div className="space-y-4">
      {/* Only show location selectors if NOT in simple edit mode */}
      {!simpleEditMode && (
        <>
          {/* Category Selector */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={formData.categoryId} onValueChange={(value) => onChange('categoryId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category (e.g., NEET, JEE, Boards)" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {(category as any).display_name || category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Selector */}
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Select 
              value={formData.subjectId} 
              onValueChange={(value) => onChange('subjectId', value)}
              disabled={!formData.categoryId}
            >
              <SelectTrigger>
                <SelectValue placeholder={!formData.categoryId ? "Select category first" : "Select subject"} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {subjects?.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chapter & Topic in 2-column grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Chapter *</Label>
              <Select 
                value={formData.chapter_id} 
                onValueChange={(value) => onChange('chapter_id', value)}
                disabled={!formData.subjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.subjectId ? "Select subject first" : "Select chapter"} />
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
              <Select 
                value={formData.topic_id} 
                onValueChange={(value) => onChange('topic_id', value)}
                disabled={!formData.chapter_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.chapter_id ? "Select chapter first" : "Select topic"} />
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
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>Question Format</Label>
        <RadioGroup
          value={formData.question_format}
          onValueChange={(value) => onChange('question_format', value)}
          className="flex flex-wrap gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single_choice" id="single" />
            <Label htmlFor="single" className="font-normal cursor-pointer">Single Choice</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multiple_choice" id="multiple" />
            <Label htmlFor="multiple" className="font-normal cursor-pointer">Multiple Choice</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="true_false" id="tf" />
            <Label htmlFor="tf" className="font-normal cursor-pointer">True/False</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="subjective" id="subjective" />
            <Label htmlFor="subjective" className="font-normal cursor-pointer">Subjective</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="contains_formula"
          checked={formData.contains_formula}
          onCheckedChange={(checked) => onChange('contains_formula', checked)}
        />
        <Label htmlFor="contains_formula" className="font-normal cursor-pointer">
          This question contains formulas (Math/Chemistry/Accounting)
        </Label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Question Text</Label>
          {onAIRephrase && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAIRephrase}
              disabled={isRephrasing || !formData.question_text}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isRephrasing ? 'Rephrasing...' : 'AI Rephrase'}
            </Button>
          )}
        </div>
        <RichContentEditor
          value={formData.question_text}
          onChange={(value) => onChange('question_text', value)}
          onImagesChange={(images) => onChange('question_images', images)}
          placeholder="Enter your question here... You can paste images directly!"
          showFormulaSupport={formData.contains_formula}
          allowImagePaste={true}
          questionId={formData.id || 'new'}
          imageType="question"
          currentImages={formData.question_images || []}
        />
        
        {/* LaTeX Preview */}
        {formData.question_text && formData.question_text.includes('$') && (
          <div className="mt-2 p-3 rounded-lg border bg-muted/30">
            <Label className="text-xs text-muted-foreground mb-2 block">Preview (LaTeX Rendered)</Label>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {formData.question_text}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
