import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trophy, Medal, Award, Star, GraduationCap } from 'lucide-react';
import { useStudentBadges, useBadgeSummary } from '@/hooks/useStudentBadges';
import { useCertificateDetails } from '@/hooks/useCertificateDetails';
import { useIsMobile } from '@/hooks/use-mobile';
import CourseCertificate from '@/components/rewards/CourseCertificate';
import { BottomNav } from '@/components/mobile/BottomNav';

const badgeConfig = {
  bronze: { label: 'Bronze (Topic)', emoji: '🥉', icon: Award, color: 'from-amber-600 to-amber-700', text: 'text-amber-800' },
  silver: { label: 'Silver (Chapter)', emoji: '🥈', icon: Medal, color: 'from-gray-300 to-gray-400', text: 'text-gray-700' },
  gold: { label: 'Gold', emoji: '🥇', icon: Trophy, color: 'from-yellow-400 to-yellow-500', text: 'text-yellow-800' },
  master: { label: 'Master', emoji: '⭐', icon: Star, color: 'from-primary to-primary', text: 'text-primary' },
  course_complete: { label: 'Course Complete', emoji: '🎓', icon: GraduationCap, color: 'from-emerald-500 to-teal-600', text: 'text-emerald-800' },
};

const MyRewards = () => {
  const navigate = useNavigate();
  const { badges, summary, isLoading } = useBadgeSummary();
  const { data: certificates, isLoading: certsLoading } = useCertificateDetails();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {!isMobile && <DashboardHeader />}
        <main className="flex-1 p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </main>
        {isMobile ? <BottomNav /> : <Footer />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="My Rewards | SimpleLecture" description="View your earned badges and achievements" />
      {!isMobile && <DashboardHeader />}

      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 px-4 pt-8 pb-12 md:py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-white text-xl md:text-3xl font-bold">My Rewards</h1>
          </div>
          <p className="text-white/80 text-sm md:text-base ml-11">Track your learning achievements</p>
        </div>
      </div>

      {/* Summary Cards */}
      <main className="flex-1 bg-background px-4 -mt-6 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {(Object.entries(badgeConfig) as [keyof typeof badgeConfig, typeof badgeConfig[keyof typeof badgeConfig]][]).map(([type, cfg]) => (
              <Card key={type} className="text-center">
                <CardContent className="p-3 md:p-4">
                  <div className="text-2xl md:text-3xl mb-1">{cfg.emoji}</div>
                  <div className="text-lg md:text-2xl font-bold">{summary[type]}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">{cfg.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Total */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Total Badges Earned: <span className="font-bold text-foreground">{summary.total}</span>
            </p>
          </div>

          {/* Certificates Section */}
          {certificates && certificates.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">🎓 Certificates</h2>
              {certificates.map((cert) => (
                <CourseCertificate
                  key={cert.badgeId}
                  studentName={cert.studentName}
                  courseName={cert.courseName}
                  completionDate={cert.completionDate}
                  enrollmentDate={cert.enrollmentDate}
                  subjects={cert.subjects}
                />
              ))}
            </div>
          )}

          {/* Badge List */}
          {(!badges || badges.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-40" />
                <h3 className="text-lg font-semibold mb-2">No badges yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Watch full lecture videos to earn Bronze badges. Complete all topics in a chapter to earn Silver, and keep going for Gold, Master, and Course Complete!
                </p>
                <Button className="mt-4" onClick={() => navigate('/my-courses')}>
                  Start Learning
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">All Badges</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {badges.map((badge) => {
                  const cfg = badgeConfig[badge.badge_type as keyof typeof badgeConfig];
                  return (
                    <Card key={badge.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-3 p-3">
                          <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${cfg.color} flex items-center justify-center shrink-0`}>
                            <span className="text-xl">{cfg.emoji}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{badge.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(badge.earned_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {isMobile ? <BottomNav /> : <Footer />}
    </div>
  );
};

export default MyRewards;
