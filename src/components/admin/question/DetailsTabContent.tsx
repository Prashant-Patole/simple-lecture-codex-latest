import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RichContentEditor } from "./RichContentEditor";

interface DetailsTabContentProps {
  formData: any;
  onChange: (field: string, value: any) => void;
}

export const DetailsTabContent: React.FC<DetailsTabContentProps> = ({
  formData,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Difficulty Level</Label>
          <Select
            value={formData.difficulty}
            onValueChange={(value) => onChange('difficulty', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Marks</Label>
          <Input
            type="number"
            min="1"
            value={formData.marks}
            onChange={(e) => onChange('marks', parseInt(e.target.value))}
            placeholder="Enter marks"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Question Type (Auto-detected)</Label>
        <Input
          value={formData.question_type}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Automatically determined based on question format
        </p>
      </div>

      <div className="space-y-2">
        <Label>Explanation (Optional)</Label>
        <RichContentEditor
          value={formData.explanation || ''}
          onChange={(value) => onChange('explanation', value)}
          onImagesChange={(images) => onChange('explanation_images', images)}
          placeholder="Provide a detailed explanation for the answer..."
          showFormulaSupport={formData.contains_formula}
          allowImagePaste={true}
          questionId={formData.id || 'new'}
          imageType="explanation"
          currentImages={formData.explanation_images || []}
        />
      </div>
    </div>
  );
};
