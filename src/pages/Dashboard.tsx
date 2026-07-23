import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SEOHead } from '@/components/SEO';
import { ArrowRight, LifeBuoy, MessagesSquare, Sparkles, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { StudentIDCard } from '@/components/dashboard/StudentIDCard';
import UpcomingClasses from '@/components/dashboard/UpcomingClasses';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { EnrolledCoursesSection } from '@/components/dashboard/EnrolledCoursesSection';
import { StudyPlanThreeDayStrip } from '@/components/dashboard/StudyPlanThreeDayStrip';
import { Footer } from '@/components/Footer';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { useEffect } from 'react';
import { useEnrollments } from '@/hooks/useEnrollments';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useIsChecker } from '@/hooks/useIsChecker';

const SSLC_COURSE_ID = '4c10bc8e-acbc-4b76-b7f5-54376c030cb0';

const SSLCPromoCard = () => (
  <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-900/20 border-amber-300 dark:border-amber-700 shadow-md">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-amber-200 dark:bg-amber-800 flex items-center justify-center flex-shrink-0">
        <Sparkles className="h-6 w-6 text-amber-700 dark:text-amber-300" />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-foreground">🔥 SSLC Model Question Papers</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Up to <span className="font-bold text-amber-700 dark:text-amber-400">80% chances</span> to get questions from our Model Question Papers! Don't miss this opportunity.
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5">Predicted</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5">Important</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5">PYQ</span>
        </div>
        <Button asChild size="sm" className="mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0">
          <Link to={`/learning/${SSLC_COURSE_ID}?tab=pyqs`}>
            <Star className="h-4 w-4 mr-1" />
            Explore SSLC Program
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const { isChecker, isLoading: checkerLoading } = useIsChecker();
  const isMobile = useIsMobile();
  const { data: enrollments } = useEnrollments();
  const isEnrolledInSSLC = enrollments?.some(e => (e as any).course_id === SSLC_COURSE_ID || (e.courses as any)?.id === SSLC_COURSE_ID);


  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Redirect checker users to /my-courses
  useEffect(() => {
    if (!checkerLoading && isChecker) {
      navigate('/my-courses', { replace: true });
    }
  }, [isChecker, checkerLoading, navigate]);

  // Show skeleton while checking auth or checker role
  if (isLoading || checkerLoading) {
    return <DashboardSkeleton />;
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return <DashboardSkeleton />;
  }

  // Don't render if checker (will redirect)
  if (isChecker) {
    return <DashboardSkeleton />;
  }

  if (isMobile) {
    return (
      <>
        <SEOHead title="My Dashboard | SimpleLecture" description="Your learning dashboard" />
        <MobileLayout title="Dashboard">
          <div className="space-y-4">
            <StudentIDCard />
            {!isEnrolledInSSLC && <SSLCPromoCard />}
            <StudyPlanThreeDayStrip />
            <EnrolledCoursesSection />
            <UpcomingClasses />
            <div className="grid grid-cols-1 gap-3">
              <Card className="p-4 bg-gradient-to-br from-primary/20 to-primary/20 dark:from-primary/30 dark:to-primary/20 border-primary/30 dark:border-primary hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-4">
                  <LifeBuoy className="h-8 w-8 text-primary dark:text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">Having a problem?</h3>
                    <p className="text-sm text-muted-foreground">Get quick support for any issues.</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/support">Support</Link>
                  </Button>
                </div>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-primary/20 to-primary/20 dark:from-primary/30 dark:to-primary/20 border-primary/30 dark:border-primary hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-4">
                  <MessagesSquare className="h-8 w-8 text-primary dark:text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">Got a question?</h3>
                    <p className="text-sm text-muted-foreground">Ask & learn from the community.</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/forum">Forum</Link>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </MobileLayout>
      </>
    );
  }

  return (
    <>
      <SEOHead title="My Dashboard | SimpleLecture" description="Your learning dashboard" />
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8 space-y-6">
          <StudentIDCard />
          {!isEnrolledInSSLC && <SSLCPromoCard />}
          <StudyPlanThreeDayStrip />
          <EnrolledCoursesSection />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UpcomingClasses />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-gradient-to-br from-primary/20 to-primary/20 dark:from-primary/30 dark:to-primary/20 border-primary/30 dark:border-primary hover:shadow-lg transition-shadow">
              <div className="flex flex-col items-center text-center space-y-3">
                <LifeBuoy className="h-10 w-10 text-primary dark:text-primary flex-shrink-0" />
                <h3 className="text-lg font-semibold">Having a problem?</h3>
                <p className="text-sm text-muted-foreground">We're here to help! Get quick support for account, payment, or technical issues.</p>
                <Button asChild variant="outline">
                  <Link to="/support">Support</Link>
                </Button>
              </div>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-primary/20 to-primary/20 dark:from-primary/30 dark:to-primary/20 border-primary/30 dark:border-primary hover:shadow-lg transition-shadow">
              <div className="flex flex-col items-center text-center space-y-3">
                <MessagesSquare className="h-10 w-10 text-primary dark:text-primary flex-shrink-0" />
                <h3 className="text-lg font-semibold">Got a question?</h3>
                <p className="text-sm text-muted-foreground">Join the discussion! Ask questions, share ideas, and learn from the community.</p>
                <Button asChild variant="outline">
                  <Link to="/forum">Forum</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default Dashboard;
