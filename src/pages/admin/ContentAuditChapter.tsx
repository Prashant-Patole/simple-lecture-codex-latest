import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft, HelpCircle, CheckCircle2, XCircle, Film, Eye, EyeOff, Play
} from "lucide-react";
import { useTopicAuditDetails, useChapterBreadcrumb } from "@/hooks/useContentAudit";
import { useMemo } from "react";

export default function ContentAuditChapter() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const { data: breadcrumb, isLoading: bcLoading } = useChapterBreadcrumb(chapterId || null);
  const { data: topics, isLoading } = useTopicAuditDetails(chapterId || null);

  const chapterQuestionStats = useMemo(() => {
    if (!topics) return { total: 0, verified: 0 };
    return topics.reduce(
      (acc, t) => ({
        total: acc.total + t.questionCount,
        verified: acc.verified + t.verifiedQuestionCount,
      }),
      { total: 0, verified: 0 }
    );
  }, [topics]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={() => breadcrumb ? navigate(`/admin/content-audit/subject/${breadcrumb.subjectId}`) : navigate("/admin/content-audit")}
        >
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
                <BreadcrumbLink asChild>
                  <Link to={breadcrumb ? `/admin/content-audit/subject/${breadcrumb.subjectId}` : "#"}>
                    {bcLoading ? "..." : breadcrumb?.subjectName}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {bcLoading ? "..." : `Ch ${breadcrumb?.chapterNumber}: ${breadcrumb?.chapterTitle}`}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-bold mt-1">
            {bcLoading ? <Skeleton className="h-7 w-64" /> : `Ch ${breadcrumb?.chapterNumber}: ${breadcrumb?.chapterTitle}`}
          </h1>
        </div>
      </div>

      {/* Chapter-level question summary */}
      {!isLoading && topics && topics.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Questions:</span>
            <Badge variant="secondary">{chapterQuestionStats.total}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Verified:</span>
            <Badge className={chapterQuestionStats.verified > 0 ? "bg-emerald-600/90 text-primary-foreground" : ""} variant={chapterQuestionStats.verified > 0 ? "default" : "outline"}>
              {chapterQuestionStats.verified}
            </Badge>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : !topics?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No topics in this chapter.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                     <th className="p-3">#</th>
                     <th className="p-3">Topic</th>
                     <th className="p-3 text-center" title="Completed AI lecture jobs / Published to students">
                       <Film className="h-3.5 w-3.5 inline" /> Jobs
                     </th>
                     <th className="p-3 text-center" title="Watch generated video">
                       Watch
                     </th>
                   </tr>
                </thead>
                <tbody>
                  {topics.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-muted-foreground">{t.topicNumber}</td>
                       <td className="p-3 font-medium max-w-[300px] truncate">{t.title}</td>
                       <td className="p-3 text-center">
                         {t.completedJobCount > 0 ? (
                           <div className="flex items-center justify-center gap-1">
                             <Badge variant="secondary" className="text-xs">{t.completedJobCount}</Badge>
                             {t.publishedJobCount > 0 ? (
                               <Badge className="bg-emerald-600/90 text-primary-foreground text-xs">
                                 <Eye className="h-3 w-3 mr-0.5" />{t.publishedJobCount}
                               </Badge>
                             ) : (
                               <Badge variant="outline" className="text-xs text-amber-600">
                                 <EyeOff className="h-3 w-3 mr-0.5" />0
                               </Badge>
                             )}
                           </div>
                         ) : (
                           <XCircle className="h-4 w-4 text-destructive/60 mx-auto" />
                         )}
                       </td>
                       <td className="p-3 text-center">
                         {t.videoPlayerUrl ? (
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-7 w-7"
                             onClick={() => window.open(t.videoPlayerUrl!, "_blank")}
                             title="Watch video"
                           >
                             <Play className="h-4 w-4 text-emerald-600" />
                           </Button>
                         ) : (
                           <span className="text-muted-foreground/40">—</span>
                         )}
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
