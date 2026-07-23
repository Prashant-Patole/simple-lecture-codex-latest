import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface QuestionFiltersProps {
  filters: {
    difficulty: string;
    verified: string;
    aiGenerated: string;
    chapterId: string;
    topicId: string;
    searchQuery: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  chapters: any[];
  topics: any[];
  activeFilterCount: number;
}

export function QuestionFilters({
  filters,
  onFilterChange,
  onClearFilters,
  chapters,
  topics,
  activeFilterCount,
}: QuestionFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Filters</h3>
              {activeFilterCount > 0 && (
                <Badge variant="secondary">{activeFilterCount} active</Badge>
              )}
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search Questions</Label>
              <Input
                placeholder="Search by question text..."
                value={filters.searchQuery}
                onChange={(e) => onFilterChange("searchQuery", e.target.value)}
              />
            </div>

            {/* Chapter */}
            <div className="space-y-2">
              <Label>Chapter</Label>
              <Select
                value={filters.chapterId}
                onValueChange={(value) => onFilterChange("chapterId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Chapters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chapters</SelectItem>
                  {chapters?.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select
                value={filters.topicId}
                onValueChange={(value) => onFilterChange("topicId", value)}
                disabled={!filters.chapterId || filters.chapterId === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {topics?.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={filters.difficulty}
                onValueChange={(value) => onFilterChange("difficulty", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Difficulties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Verification Status */}
            <div className="space-y-2">
              <Label>Verification Status</Label>
              <Select
                value={filters.verified}
                onValueChange={(value) => onFilterChange("verified", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Questions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Questions</SelectItem>
                  <SelectItem value="verified">Verified Only</SelectItem>
                  <SelectItem value="unverified">Unverified Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AI Generated */}
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={filters.aiGenerated}
                onValueChange={(value) => onFilterChange("aiGenerated", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="ai">AI Generated</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
