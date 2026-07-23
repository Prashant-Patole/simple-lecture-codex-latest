import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft, Video, HelpCircle, CheckCircle2, AlertTriangle, XCircle, Eye
} from "lucide-react";
import { useChapterAuditDetails, useSubjectName } from "@/hooks/useContentAudit";

function CoverageBadge({ value, total, label }: { value: number; total: number; label: string }) {
  if (total === 0) return <Badge variant="outline" className="text-muted-foreground text-xs">No {label}</Badge>;
  if (value === total) return <Badge className="bg-emerald-600/90 hover:bg-emerald-700 text-primary-foreground text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />All {label}</Badge>;
  if (value > 0) return <Badge className="bg-amber-500/90 hover:bg-amber-600 text-primary-foreground text-xs"><AlertTriangle className="h-3 w-3 mr-1" />{value}/{total}</Badge>;
  return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />No {label}</Badge>;
}

export default function ContentAuditSubject() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { data: subject, isLoading: nameLoading } = useSubjectName(subjectId || null);
  const { data: chapters, isLoading } = useChapterAuditDetails(subjectId || null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/content-audit")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/admin/content-audit">Content Audit</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{nameLoading ? "..." : subject?.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold mt-1">{nameLoading ? <Skeleton className="h-7 w-48" /> : subject?.name}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Admin videos</span>
        <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-emerald-500" /> Published</span>
        <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" /> Questions</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Verified</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !chapters?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No chapters found for this subject.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {chapters.map((ch) => {
            const videoPct = ch.topicCount > 0 ? Math.round((ch.topicsWithVideo / ch.topicCount) * 100) : 0;
            const pubPct = ch.topicCount > 0 ? Math.round((ch.topicsWithPublishedVideo / ch.topicCount) * 100) : 0;
            const qPct = ch.topicCount > 0 ? Math.round((ch.topicsWithQuestions / ch.topicCount) * 100) : 0;
            const verPct = ch.topicCount > 0 ? Math.round((ch.topicsWithVerifiedQuestions / ch.topicCount) * 100) : 0;

            return (
              <Card
                key={ch.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/admin/content-audit/chapter/${ch.id}`)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-muted-foreground text-sm w-12 shrink-0">Ch {ch.chapterNumber}</span>
                    <span className="font-medium text-sm flex-1 min-w-[150px] truncate">{ch.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{ch.topicCount} topics</span>

                    <div className="flex items-center gap-1 w-24 shrink-0" title={`Admin videos: ${videoPct}%`}>
                      <Video className="h-3.5 w-3.5 text-muted-foreground" />
                      <Progress value={videoPct} className="h-2 flex-1" />
                      <span className="text-xs w-8 text-right">{videoPct}%</span>
                    </div>
                    <div className="flex items-center gap-1 w-24 shrink-0" title={`Published: ${pubPct}%`}>
                      <Eye className="h-3.5 w-3.5 text-emerald-500" />
                      <Progress value={pubPct} className="h-2 flex-1" />
                      <span className="text-xs w-8 text-right">{pubPct}%</span>
                    </div>
                    <CoverageBadge value={ch.topicsWithQuestions} total={ch.topicCount} label="Qs" />
                    <CoverageBadge value={ch.topicsWithVerifiedQuestions} total={ch.topicCount} label="Verified" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
