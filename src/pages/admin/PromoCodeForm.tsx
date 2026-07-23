import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useCreatePromoCode, useUpdatePromoCode } from "@/hooks/usePromoCodes";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const PromoCodeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const createPromoCode = useCreatePromoCode();
  const updatePromoCode = useUpdatePromoCode();

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    validFrom: '',
    validUntil: '',
    maxUses: '',
    isActive: true,
  });

  const { data: existingPromo } = useQuery({
    queryKey: ['promo-code', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingPromo) {
      setFormData({
        code: existingPromo.code,
        description: existingPromo.description || '',
        discountType: existingPromo.discount_percent ? 'percentage' : 'fixed',
        discountValue: String(existingPromo.discount_percent || existingPromo.discount_amount || ''),
        validFrom: existingPromo.valid_from ? existingPromo.valid_from.split('T')[0] : '',
        validUntil: existingPromo.valid_until ? existingPromo.valid_until.split('T')[0] : '',
        maxUses: existingPromo.max_uses ? String(existingPromo.max_uses) : '',
        isActive: existingPromo.is_active,
      });
    }
  }, [existingPromo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error('Promo code is required');
      return;
    }

    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      toast.error('Valid discount value is required');
      return;
    }

    const promoData = {
      code: formData.code.toUpperCase().trim(),
      description: formData.description.trim() || null,
      discount_percent: formData.discountType === 'percentage' ? parseFloat(formData.discountValue) : null,
      discount_amount: formData.discountType === 'fixed' ? parseFloat(formData.discountValue) : null,
      valid_from: formData.validFrom || null,
      valid_until: formData.validUntil || null,
      max_uses: formData.maxUses ? parseInt(formData.maxUses) : null,
      is_active: formData.isActive,
    };

    try {
      if (isEdit && id) {
        await updatePromoCode.mutateAsync({ id, updates: promoData });
      } else {
        await createPromoCode.mutateAsync(promoData);
      }
      navigate('/admin/promo-codes');
    } catch (error) {
      console.error('Error saving promo code:', error);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/admin/promo-codes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Promo Codes
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{isEdit ? 'Edit' : 'Create'} Promo Code</h1>
        <p className="text-muted-foreground">
          {isEdit ? 'Update the promo code details' : 'Create a new promotional discount code'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Promo Code Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="code">Promo Code *</Label>
                <Input
                  id="code"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2024"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Use uppercase letters and numbers</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summer sale discount"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label>Discount Type *</Label>
              <RadioGroup
                value={formData.discountType}
                onValueChange={(value: 'percentage' | 'fixed') =>
                  setFormData({ ...formData, discountType: value })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label htmlFor="percentage" className="cursor-pointer">Percentage Discount (%)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="cursor-pointer">Fixed Amount (₹)</Label>
                </div>
              </RadioGroup>

              <div className="space-y-2">
                <Label htmlFor="discountValue">
                  {formData.discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount'} *
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  required
                  min="0"
                  step={formData.discountType === 'percentage' ? '1' : '0.01'}
                  max={formData.discountType === 'percentage' ? '100' : undefined}
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder={formData.discountType === 'percentage' ? '20' : '500'}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valid From</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">Maximum Uses (Optional)</Label>
              <Input
                id="maxUses"
                type="number"
                min="0"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                placeholder="Leave empty for unlimited uses"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable this promo code
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button type="submit" disabled={createPromoCode.isPending || updatePromoCode.isPending}>
            {createPromoCode.isPending || updatePromoCode.isPending
              ? 'Saving...'
              : isEdit
              ? 'Update Promo Code'
              : 'Create Promo Code'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/promo-codes')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PromoCodeForm;
