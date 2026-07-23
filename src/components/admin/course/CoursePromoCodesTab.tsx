import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Tag } from "lucide-react";
import { toast } from "sonner";

interface Props {
  courseId?: string;
}

const blankForm = {
  code: "",
  description: "",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: "",
  validFrom: "",
  validUntil: "",
  maxUses: "",
  isActive: true,
};

export function CoursePromoCodesTab({ courseId }: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["course-promo-codes", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("course_id", courseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("Course ID missing");
      if (!form.code.trim()) throw new Error("Promo code is required");
      const value = parseFloat(form.discountValue);
      if (!value || value <= 0) throw new Error("Valid discount value is required");

      const payload: any = {
        code: form.code.toUpperCase().trim(),
        description: form.description.trim() || null,
        discount_percent: form.discountType === "percentage" ? value : null,
        discount_amount: form.discountType === "fixed" ? Math.round(value) : null,
        valid_from: form.validFrom || null,
        valid_until: form.validUntil || null,
        max_uses: form.maxUses ? parseInt(form.maxUses) : null,
        is_active: form.isActive,
        course_id: courseId,
      };

      if (editingId) {
        const { error } = await supabase
          .from("discount_codes")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discount_codes").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-promo-codes", courseId] });
      toast.success(editingId ? "Promo code updated" : "Promo code created");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-promo-codes", courseId] });
      toast.success("Promo code deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm(blankForm);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setShowForm(true);
    setForm({
      code: p.code,
      description: p.description || "",
      discountType: p.discount_percent ? "percentage" : "fixed",
      discountValue: String(p.discount_percent || p.discount_amount || ""),
      validFrom: p.valid_from ? p.valid_from.split("T")[0] : "",
      validUntil: p.valid_until ? p.valid_until.split("T")[0] : "",
      maxUses: p.max_uses ? String(p.max_uses) : "",
      isActive: p.is_active,
    });
  };

  if (!courseId) {
    return (
      <p className="text-muted-foreground text-sm">
        Save the course first to manage promo codes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Course Promo Codes</h3>
          <p className="text-sm text-muted-foreground">
            These promo codes apply only to this course.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Promo Code
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Promo Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="SUMMER20"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="20% off summer offer"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Discount Type *</Label>
              <RadioGroup
                value={form.discountType}
                onValueChange={(v: "percentage" | "fixed") =>
                  setForm({ ...form, discountType: v })
                }
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="pct" />
                  <Label htmlFor="pct" className="cursor-pointer">
                    Percentage (%)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fix" />
                  <Label htmlFor="fix" className="cursor-pointer">
                    Fixed Amount (₹)
                  </Label>
                </div>
              </RadioGroup>
              <div className="space-y-2">
                <Label>
                  {form.discountType === "percentage"
                    ? "Discount Percentage"
                    : "Discount Amount (₹)"}{" "}
                  *
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={form.discountType === "percentage" ? "100" : undefined}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  placeholder={form.discountType === "percentage" ? "20" : "500"}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Maximum Uses (optional)</Label>
              <Input
                type="number"
                min="0"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Leave empty for unlimited"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(c) => setForm({ ...form, isActive: c })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? "Saving..."
                  : editingId
                  ? "Update Promo Code"
                  : "Create Promo Code"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : promos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No promo codes for this course yet.
          </p>
        ) : (
          promos.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Tag className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold">{p.code}</span>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">
                        {p.discount_percent
                          ? `${p.discount_percent}% OFF`
                          : `₹${p.discount_amount} OFF`}
                      </Badge>
                    </div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {p.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Used {p.times_used || 0}
                      {p.max_uses ? ` / ${p.max_uses}` : ""}
                      {p.valid_until
                        ? ` · expires ${new Date(p.valid_until).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete promo code ${p.code}?`)) {
                        deleteMutation.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
