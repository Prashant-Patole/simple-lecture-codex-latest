import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  email: z.string().trim().max(255, "Email too long").optional().or(z.literal('')).transform(v => v || ''),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number (10 digits)"),
});

interface LeadCaptureFormProps {
  onSubmit: (name: string, email: string, mobile: string) => Promise<boolean>;
}

export const LeadCaptureForm = ({ onSubmit }: LeadCaptureFormProps) => {
  const [formData, setFormData] = useState({ name: "", email: "", mobile: "" });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validated = leadSchema.parse(formData);
      console.log("Lead form validated, creating lead:", validated);
      setIsSubmitting(true);
      const success = await onSubmit(validated.name, validated.email, validated.mobile);
      console.log("Lead creation result:", success);
      if (!success) {
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Lead form validation error:", error);
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 space-y-2">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Welcome to SimpleLecture! 👋</h3>
        <p className="text-xs text-muted-foreground">
          Share your details so we can assist you better.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor="name" className="text-xs">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Your full name"
            disabled={isSubmitting}
            className="h-8 text-sm"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email" className="text-xs">Email (Optional)</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="your.email@example.com"
            disabled={isSubmitting}
            className="h-8 text-sm"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="mobile" className="text-xs">Mobile Number *</Label>
          <Input
            id="mobile"
            type="tel"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            placeholder="10-digit mobile number"
            maxLength={10}
            disabled={isSubmitting}
            className="h-8 text-sm"
          />
          {errors.mobile && <p className="text-xs text-destructive">{errors.mobile}</p>}
        </div>

        <Button type="submit" className="w-full h-9" disabled={isSubmitting}>
          {isSubmitting ? "Starting Chat..." : "Start Chat"}
        </Button>
      </form>
    </div>
  );
};
