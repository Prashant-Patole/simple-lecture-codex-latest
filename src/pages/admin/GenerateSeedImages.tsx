import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGenerateSeedImages } from "@/hooks/useGenerateSeedImages";
import { Wand2, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function GenerateSeedImages() {
  const { generateAllImages, isGenerating, progress, generatedImages } = useGenerateSeedImages();
  const [sqlOutput, setSqlOutput] = useState<string>("");

  const handleGenerate = async () => {
    const results = await generateAllImages();
    
    // Generate SQL update statements
    const categoryUpdates = results
      .filter(r => r.entityType === 'category')
      .map(r => {
        const slug = r.entityName.toLowerCase().replace(/\s+/g, '-');
        return `UPDATE categories SET thumbnail_url = '${r.imageUrl}' WHERE slug = '${slug}';`;
      });

    const subjectUpdates = results
      .filter(r => r.entityType === 'subject')
      .map(r => {
        const slug = r.entityName.toLowerCase().replace(/\s+/g, '-');
        return `UPDATE popular_subjects SET thumbnail_url = '${r.imageUrl}' WHERE slug = '${slug}';`;
      });

    const courseUpdates = results
      .filter(r => r.entityType === 'course')
      .map(r => {
        const slug = r.entityName.toLowerCase().replace(/\s+/g, '-').replace(/\d+/g, '').replace(/-+/g, '-').trim();
        return `UPDATE courses SET thumbnail_url = '${r.imageUrl}' WHERE name = '${r.entityName}';`;
      });

    const sql = [
      "-- Update Categories",
      ...categoryUpdates,
      "",
      "-- Update Subjects",
      ...subjectUpdates,
      "",
      "-- Update Courses",
      ...courseUpdates,
    ].join("\n");

    setSqlOutput(sql);
  };

  const copySql = () => {
    navigator.clipboard.writeText(sqlOutput);
    toast.success("SQL copied to clipboard!");
  };

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate Seed Images</h1>
        <p className="text-muted-foreground">
          Generate AI images for all subjects, categories, and courses in seed data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Image Generation</CardTitle>
          <CardDescription>
            This will generate AI images for 9 categories, 6 subjects, and 4 courses (19 total images).
            The process may take several minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            <Wand2 className="mr-2 h-5 w-5" />
            {isGenerating ? "Generating Images..." : "Generate All Images"}
          </Button>

          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progress</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <Progress value={progressPercentage} />
            </div>
          )}

          {generatedImages.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">
                  Generated {generatedImages.length} images successfully!
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {generatedImages.map((img, idx) => (
                  <div key={idx} className="space-y-2">
                    <img
                      src={img.imageUrl}
                      alt={img.entityName}
                      className="w-full aspect-video object-cover rounded-lg"
                    />
                    <p className="text-xs font-medium truncate">{img.entityName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{img.entityType}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {sqlOutput && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>SQL Update Statements</CardTitle>
              <Button onClick={copySql} variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy SQL
              </Button>
            </div>
            <CardDescription>
              Run these SQL statements to update the database with generated image URLs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              {sqlOutput}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
