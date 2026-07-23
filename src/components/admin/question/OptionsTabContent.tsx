import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { RichContentEditor } from "./RichContentEditor";
import { Input } from "@/components/ui/input";

interface OptionsTabContentProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  onOptionChange: (option: string, value: string) => void;
  onOptionImageChange: (option: string, images: string[]) => void;
}

export const OptionsTabContent: React.FC<OptionsTabContentProps> = ({
  formData,
  onChange,
  onOptionChange,
  onOptionImageChange,
}) => {
  const isMCQ = ['single_choice', 'multiple_choice'].includes(formData.question_format);
  const isTrueFalse = formData.question_format === 'true_false';
  const isMultipleChoice = formData.question_format === 'multiple_choice';

  if (!isMCQ && !isTrueFalse) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Correct Answer</Label>
          <Input
            value={formData.correct_answer}
            onChange={(e) => onChange('correct_answer', e.target.value)}
            placeholder="Enter the correct answer"
          />
        </div>
      </div>
    );
  }

  if (isTrueFalse) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Correct Answer</Label>
          <RadioGroup
            value={formData.correct_answer}
            onValueChange={(value) => onChange('correct_answer', value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="True" id="true" />
              <Label htmlFor="true" className="font-normal cursor-pointer">True</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="False" id="false" />
              <Label htmlFor="false" className="font-normal cursor-pointer">False</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    );
  }

  const options = ['A', 'B', 'C', 'D'];

  return (
    <div className="space-y-6">
      {options.map((option) => (
        <div key={option} className="space-y-2 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold">Option {option}</Label>
            {isMultipleChoice && (
              <Checkbox
                checked={formData.correct_answer?.includes(option) || false}
                onCheckedChange={(checked) => {
                  const currentAnswers = formData.correct_answer?.split(',') || [];
                  const newAnswers = checked
                    ? [...currentAnswers, option]
                    : currentAnswers.filter((a: string) => a !== option);
                  onChange('correct_answer', newAnswers.join(','));
                }}
              />
            )}
          </div>
          <RichContentEditor
            value={formData.options?.[option] || ''}
            onChange={(value) => onOptionChange(option, value)}
            onImagesChange={(images) => onOptionImageChange(option, images)}
            placeholder={`Enter option ${option} text... You can paste images!`}
            showFormulaSupport={formData.contains_formula}
            allowImagePaste={true}
            questionId={formData.id || 'new'}
            imageType={`option_${option.toLowerCase()}` as any}
            currentImages={formData.option_images?.[option] || []}
          />
        </div>
      ))}

      {!isMultipleChoice && (
        <div className="space-y-2">
          <Label>Select Correct Answer</Label>
          <RadioGroup
            value={formData.correct_answer}
            onValueChange={(value) => onChange('correct_answer', value)}
            className="flex gap-4"
          >
            {options.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`correct-${option}`} />
                <Label htmlFor={`correct-${option}`} className="font-normal cursor-pointer">
                  Option {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}
    </div>
  );
};
