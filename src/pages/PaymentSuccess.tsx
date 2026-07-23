import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Download, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SEOHead } from '@/components/SEO';
import { SmartHeader } from '@/components/SmartHeader';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/mobile/BottomNav';
import { formatINR } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';

interface OrderDetails {
  orderId: string;
  amount: number;
  courses: { id: string; course_name: string }[];
}

const PaymentSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrderDetails = async () => {
      // Priority 1: location.state (normal JS handler flow)
      if (location.state?.orderId) {
        setOrderDetails({
          orderId: location.state.orderId,
          amount: location.state.amount,
          courses: location.state.courses || [],
        });
        setLoading(false);
        return;
      }

      // Priority 2: query param (WebView redirect flow)
      const orderId = searchParams.get('orderId');
      if (orderId) {
        try {
          const { data: payment } = await supabase
            .from('payments')
            .select('order_id, amount_inr, status')
            .eq('order_id', orderId)
            .single();

          if (payment) {
            // Get courses from order_items
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('course_id, courses(name)')
              .eq('payment_id', (
                await supabase.from('payments').select('id').eq('order_id', orderId).single()
              ).data?.id || '');

            const courses = orderItems?.map((item: any) => ({
              id: item.course_id,
              course_name: item.courses?.name || 'Course',
            })) || [];

            setOrderDetails({
              orderId: payment.order_id,
              amount: payment.amount_inr || 0,
              courses,
            });
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('[PaymentSuccess] Error fetching order:', err);
        }
      }

      // No order info at all — redirect home
      setLoading(false);
      navigate('/', { replace: true });
    };

    loadOrderDetails();
  }, [location.state, searchParams, navigate]);

  useEffect(() => {
    if (orderDetails) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [orderDetails]);

  if (loading) {
    return (
      <>
        <SmartHeader />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg">Loading your order details...</p>
          </div>
        </div>
      </>
    );
  }

  if (!orderDetails) return null;

  const { orderId, amount, courses } = orderDetails;

  return (
    <>
      <SEOHead title="Payment Successful | SimpleLecture" description="Your payment was successful" />
      <SmartHeader />
      <div className="min-h-screen bg-background flex items-center justify-center p-4 pb-20 md:pb-4">
        <Card className="max-w-2xl w-full p-4 md:p-8">
          <div className="text-center mb-6 md:mb-8">
            <CheckCircle className="h-16 w-16 md:h-20 md:w-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Thank You for Your Purchase!</h1>
            <p className="text-sm md:text-base text-muted-foreground">Your payment was successful</p>
          </div>

          <div className="bg-muted p-4 md:p-6 rounded-lg mb-4 md:mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Order ID</p>
                <p className="font-mono font-semibold">{orderId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatINR(amount)}</p>
              </div>
            </div>

            {courses.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Courses Purchased:</p>
                <div className="space-y-2">
                  {courses.map((course) => (
                    <div key={course.id} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">{course.course_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-primary/10 p-6 rounded-lg mb-6">
            <h3 className="font-bold mb-3 text-lg">Enrollment Confirmed!</h3>
            <p className="mb-3 text-sm">You now have full access to:</p>
            <ul className="list-disc list-inside space-y-1 text-sm mb-4">
              <li>All course videos and materials</li>
              <li>AI-powered doubt clearing assistant</li>
              <li>Practice quizzes and assignments</li>
              <li>Daily practice tests (DPT)</li>
              <li>Certificate upon completion</li>
              <li>Live doubt sessions (if applicable)</li>
            </ul>
            <div className="bg-background/80 p-3 rounded-md">
              <p className="text-sm font-semibold">
                Access valid for: <span className="text-primary">1 Year from today</span>
              </p>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground mb-6">
            <p>A confirmation email has been sent to your registered email address</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <Button onClick={() => navigate('/student-dashboard')} className="flex-1" size="lg">
              Go to My Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="sm:flex-none">
              <Download className="mr-2 h-4 w-4" />
              Receipt
            </Button>
          </div>
        </Card>
      </div>
      <Footer />
      <BottomNav />
    </>
  );
};

export default PaymentSuccess;
