import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface Props {
  formData: any;
  onChange: (field: string, value: any) => void;
}

const counter = (val: string | undefined, max: number) => {
  const len = (val || "").length;
  const over = len > max;
  return (
    <span className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
      {len}/{max}
    </span>
  );
};

export const CourseSEOTab = ({ formData, onChange }: Props) => {
  const effectiveTitle =
    formData.seo_title || `${formData.name || "Course"} — Online Coaching & Live Classes`;
  const effectiveDesc = formData.seo_description || formData.short_description || "";
  const effectiveOgTitle = formData.og_title || effectiveTitle;
  const effectiveOgDesc = formData.og_description || effectiveDesc;
  const effectiveOgImage = formData.og_image_url || formData.thumbnail_url || "";

  const slug = formData.slug || "<slug>";
  const projectRef = "oxwhqvsoelqqsblmqkxx";
  const rawSeoUrl = `https://${projectRef}.functions.supabase.co/seo-head?path=/course/${slug}`;

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground space-y-2">
        <p>
          These fields control the page <code>&lt;title&gt;</code>, meta description, keywords,
          Open Graph preview and canonical URL shown on{" "}
          <code>/course/{slug}</code> for Google, ChatGPT, WhatsApp, Facebook
          and other crawlers. Leave any field empty to fall back to the course name / short
          description / thumbnail.
        </p>
        <p>
          <strong>Test raw SEO HTML:</strong>{" "}
          <a
            href={rawSeoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline break-all"
          >
            {rawSeoUrl}
          </a>
        </p>
        <p className="text-xs">
          Note: social-share crawlers (WhatsApp, Facebook, LinkedIn, Twitter) cache previews.
          After updating, use the Facebook Sharing Debugger or Twitter Card Validator to
          force a refresh.
        </p>
      </div>


      {/* Search engine block */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo_title">SEO Title</Label>
              {counter(formData.seo_title, 60)}
            </div>
            <Input
              id="seo_title"
              value={formData.seo_title || ""}
              onChange={(e) => onChange("seo_title", e.target.value)}
              placeholder={`${formData.name || "Course name"} — Online Coaching & Live Classes`}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo_description">Meta Description</Label>
              {counter(formData.seo_description, 160)}
            </div>
            <Textarea
              id="seo_description"
              value={formData.seo_description || ""}
              onChange={(e) => onChange("seo_description", e.target.value)}
              placeholder={formData.short_description || "Short summary for Google snippet (max 160 chars)"}
              rows={3}
              maxLength={320}
            />
            {!formData.seo_description && formData.short_description && (
              <p className="text-xs text-muted-foreground">
                Falls back to short description.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo_keywords">Keywords (comma-separated)</Label>
            <Input
              id="seo_keywords"
              value={formData.seo_keywords || ""}
              onChange={(e) => onChange("seo_keywords", e.target.value)}
              placeholder="CBSE class 10, class 10 online coaching, NCERT video lectures"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo_canonical_url">Canonical URL override (optional)</Label>
            <Input
              id="seo_canonical_url"
              value={formData.seo_canonical_url || ""}
              onChange={(e) => onChange("seo_canonical_url", e.target.value)}
              placeholder={`https://simplelecture.com/course/${formData.slug || "<slug>"}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* OG / Social block */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social preview (Open Graph)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="og_title">OG Title</Label>
              {counter(formData.og_title, 70)}
            </div>
            <Input
              id="og_title"
              value={formData.og_title || ""}
              onChange={(e) => onChange("og_title", e.target.value)}
              placeholder={effectiveTitle}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="og_description">OG Description</Label>
              {counter(formData.og_description, 200)}
            </div>
            <Textarea
              id="og_description"
              value={formData.og_description || ""}
              onChange={(e) => onChange("og_description", e.target.value)}
              placeholder={effectiveDesc || "Shown when the page is shared on WhatsApp / Facebook / LinkedIn"}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="og_image_url">OG Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="og_image_url"
                value={formData.og_image_url || ""}
                onChange={(e) => onChange("og_image_url", e.target.value)}
                placeholder={formData.thumbnail_url || "https://...png (1200x630 recommended)"}
              />
              {formData.og_image_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onChange("og_image_url", "")}
                  title="Reset to course thumbnail"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!formData.og_image_url && formData.thumbnail_url && (
              <p className="text-xs text-muted-foreground">
                Falls back to course thumbnail.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Google result
            </p>
            <div className="rounded-md border p-4 bg-background">
              <div className="text-xs text-muted-foreground truncate">
                simplelecture.com › course › {formData.slug || "<slug>"}
              </div>
              <div className="text-[#1a0dab] text-lg leading-snug truncate">
                {effectiveTitle} | SimpleLecture
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {effectiveDesc || "No description set."}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              WhatsApp / Facebook card
            </p>
            <div className="rounded-md border overflow-hidden bg-background max-w-md">
              {effectiveOgImage ? (
                <img
                  src={effectiveOgImage}
                  alt=""
                  className="w-full h-40 object-cover bg-muted"
                />
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  No image
                </div>
              )}
              <div className="p-3">
                <div className="text-xs uppercase text-muted-foreground">
                  simplelecture.com
                </div>
                <div className="font-semibold leading-tight line-clamp-2">
                  {effectiveOgTitle}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {effectiveOgDesc || "No description."}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
