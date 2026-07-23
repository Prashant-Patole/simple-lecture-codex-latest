import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface CoursePricingTabProps {
  formData: any;
  onChange: (field: string, value: any) => void;
}

export const CoursePricingTab = ({ formData, onChange }: CoursePricingTabProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Base Pricing</CardTitle>
          <CardDescription>Set the standard pricing for this course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_inr">Current Price (₹)</Label>
              <Input
                id="price_inr"
                type="number"
                value={formData.price_inr || 0}
                onChange={(e) => onChange("price_inr", parseInt(e.target.value))}
                placeholder="2000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="original_price_inr">Original Price (₹)</Label>
              <Input
                id="original_price_inr"
                type="number"
                value={formData.original_price_inr || 0}
                onChange={(e) => onChange("original_price_inr", parseInt(e.target.value))}
                placeholder="3000"
              />
              <p className="text-xs text-muted-foreground">Shows as strikethrough price</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI-Based Tutoring</CardTitle>
          <CardDescription>Pricing for courses with AI tutoring features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable AI Tutoring</Label>
              <p className="text-sm text-muted-foreground">
                Allow students to interact with AI tutor
              </p>
            </div>
            <Switch
              checked={formData.ai_tutoring_enabled || false}
              onCheckedChange={(checked) => onChange("ai_tutoring_enabled", checked)}
            />
          </div>
          
          {formData.ai_tutoring_enabled && (
            <div className="space-y-2 pl-4 border-l-2 border-primary">
              <Label htmlFor="ai_tutoring_price">AI Tutoring Price (₹)</Label>
              <Input
                id="ai_tutoring_price"
                type="number"
                value={formData.ai_tutoring_price || 2000}
                onChange={(e) => onChange("ai_tutoring_price", parseInt(e.target.value))}
                placeholder="2000"
              />
              <p className="text-xs text-muted-foreground">
                Additional cost for AI tutoring access
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Tutoring with Live Classes</CardTitle>
          <CardDescription>Premium pricing for AI tutoring plus live instructor sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Live Classes</Label>
              <p className="text-sm text-muted-foreground">
                Combine AI tutoring with live instructor sessions
              </p>
            </div>
            <Switch
              checked={formData.live_classes_enabled || false}
              onCheckedChange={(checked) => onChange("live_classes_enabled", checked)}
            />
          </div>
          
          {formData.live_classes_enabled && (
            <div className="space-y-2 pl-4 border-l-2 border-primary">
              <Label htmlFor="live_classes_price">Live Classes Price (₹)</Label>
              <Input
                id="live_classes_price"
                type="number"
                value={formData.live_classes_price || 2000}
                onChange={(e) => onChange("live_classes_price", parseInt(e.target.value))}
                placeholder="2000"
              />
              <p className="text-xs text-muted-foreground">
                Premium pricing including live sessions
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Base Course:</span>
              <span className="font-semibold">₹{formData.price_inr?.toLocaleString() || 0}</span>
            </div>
            {formData.ai_tutoring_enabled && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">With AI Tutoring:</span>
                  <span className="font-semibold">₹{formData.ai_tutoring_price?.toLocaleString() || 0}</span>
                </div>
              </>
            )}
            {formData.live_classes_enabled && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">With Live Classes:</span>
                  <span className="font-semibold">₹{formData.live_classes_price?.toLocaleString() || 0}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
