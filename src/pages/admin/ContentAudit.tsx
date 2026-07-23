import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Video, HelpCircle, CheckCircle2, Eye, ChevronRight
} from "lucide-react";
import {
  useAuditCourses,
  useSubjectAuditDetails,
  type SubjectAuditDetail,
} from "@/hooks/useContentAudit";

function SubjectRow({ subject, detail }: { subject: { id: string; name: string }; detail?: SubjectAuditDetail }) {
  const navigate = useNavigate();

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => navigate(`/admin/content-audit/subject/${subject.id}`)}
    >
      <span className="font-medium text-sm flex-1 truncate">{subject.name}</span>
      {detail ? (
        <>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{detail.chapterCount} ch / {detail.topicCount} topics</span>
          <div className="flex items-center gap-1 w-24" title="Admin: any video content exists">
            <Video className="h-3.5 w-3.5 text-muted-foreground" />
            <Progress value={detail.videoCoverage} className="h-2 flex-1" />
            <span className="text-xs w-8 text-right">{detail.videoCoverage}%</span>
          </div>
          <div className="flex items-center gap-1 w-24" title="Student: published videos">
            <Eye className="h-3.5 w-3.5 text-emerald-500" />
            <Progress value={detail.publishedVideoCoverage} className="h-2 flex-1" />
            <span className="text-xs w-8 text-right">{detail.publishedVideoCoverage}%</span>
          </div>
          <div className="flex items-center gap-1 w-24" title="Admin: any questions exist">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <Progress value={detail.questionCoverage} className="h-2 flex-1" />
            <span className="text-xs w-8 text-right">{detail.questionCoverage}%</span>
          </div>
          <div className="flex items-center gap-1 w-24" title="Student: verified questions">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <Progress value={detail.verifiedQuestionCoverage} className="h-2 flex-1" />
            <span className="text-xs w-8 text-right">{detail.verifiedQuestionCoverage}%</span>
          </div>
        </>
      ) : (
        <Skeleton className="h-5 w-20" />
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

export default function ContentAudit() {
  const { data: courses, isLoading } = useAuditCourses();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<string[]>([]);

  const activeSubjectIds = useMemo(() => {
    if (!courses) return [];
    return courses
      .filter((c) => expandedCourses.includes(c.id))
      .flatMap((c) => c.subjects.map((s) => s.id));
  }, [courses, expandedCourses]);

  const { data: subjectDetails } = useSubjectAuditDetails(activeSubjectIds);

  const categories = useMemo(() => {
    if (!courses) return [];
    const cats = new Set(courses.map((c) => c.category).filter(Boolean));
    return Array.from(cats).sort() as string[];
  }, [courses]);

  const filtered = useMemo(() => {
    if (!courses) return [];
    let result = courses;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.subjects.some((s) => s.name.toLowerCase().includes(q))
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((c) => c.category === categoryFilter);
    }
    if (missingOnly) {
      result = result.filter((c) => {
        const subjIds = c.subjects.map((s) => s.id);
        if (!subjectDetails) return true;
        return subjIds.some((sid) => {
          const d = subjectDetails.get(sid);
          return !d || d.videoCoverage < 100 || d.questionCoverage < 100;
        });
      });
    }
    return result;
  }, [courses, search, categoryFilter, missingOnly, subjectDetails]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Audit</h1>
        <p className="text-muted-foreground text-sm">Check video and question coverage across courses, subjects, chapters, and topics.</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Admin coverage</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-emerald-500" /> Published to students</span>
          <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" /> All questions</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Verified questions</span>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses or subjects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="missing-only" checked={missingOnly} onCheckedChange={setMissingOnly} />
              <Label htmlFor="missing-only" className="text-sm">Missing content only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No courses found matching your filters.</CardContent></Card>
      ) : (
        <Accordion type="multiple" value={expandedCourses} onValueChange={setExpandedCourses} className="space-y-2">
          {filtered.map((course) => (
            <AccordionItem key={course.id} value={course.id} className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline bg-card">
                <div className="flex items-center gap-4 w-full mr-4">
                  <span className="font-semibold text-left flex-1 truncate">{course.name}</span>
                  {course.category && <Badge variant="outline" className="text-xs">{course.category}</Badge>}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{course.subjectCount} subjects</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0">
                {course.subjects.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No subjects linked to this course.</p>
                ) : (
                  <div>
                    {course.subjects.map((subj) => (
                      <SubjectRow key={subj.id} subject={subj} detail={subjectDetails?.get(subj.id)} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
