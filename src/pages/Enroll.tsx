import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SmartHeader } from '@/components/SmartHeader';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  Tag, 
  Sparkles,
  ArrowLeft,
  Shield,
  Clock,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuth } from '@/contexts/AuthContext';
import { EnrollAuthStep } from '@/components/enroll/EnrollAuthStep';
import { EnrollStepIndicator } from '@/components/enroll/EnrollStepIndicator';
import { BottomNav } from '@/components/mobile/BottomNav';
import { useIsMobile } from '@/hooks/use-mobile';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Enroll = () => {
  const { courseSlug } = useParams<{ courseSlug: string }>();
  const navigate = useNavigate();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const { isAuthenticated, isLoading: authLoading, user: authUser } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [discount, setDiscount] = useState<any>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentStep, setCurrentStep] = useState<'auth' | 'payment'>(isAuthenticated ? 'payment' : 'auth');
  const isMobile = useIsMobile();
  const paymentHandled = useRef(false);
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    state: '',
    city: '',
  });

  // Sync step with auth state
  useEffect(() => {
    if (isAuthenticated) setCurrentStep('payment');
  }, [isAuthenticated]);

  // Pre-fill form data from user profile, auth metadata, or auth step
  useEffect(() => {
    const meta = authUser?.user_metadata as Record<string, any> | undefined;
    const profileName = userData?.profile?.full_name;
    const metaName = meta?.full_name;
    const profilePhone = userData?.profile?.phone_number;
    const metaPhone = meta?.phone;
    const profileEmail = userData?.email;
    const authEmail = authUser?.email;

    setFormData(prev => ({
      fullName: profileName || metaName || prev.fullName || '',
      email: profileEmail || authEmail || prev.email || '',
      phone: profilePhone || metaPhone || prev.phone || '',
      state: prev.state,
      city: prev.city,
    }));
  }, [userData, authUser]);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Fetch course details
  const { data: course, isLoading } = useQuery({
    queryKey: ['course-enroll', courseSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          course_subjects (
            popular_subjects (
              name
            )
          )
        `)
        .eq('slug', courseSlug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseSlug,
  });

  // Featured course-specific promo (active + within validity window)
  const { data: featuredPromo } = useQuery({
    queryKey: ['featured-course-promo', course?.id],
    queryFn: async () => {
      if (!course?.id) return null;
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('discount_codes')
        .select('code, description, discount_percent, discount_amount, valid_until')
        .eq('course_id', course.id)
        .eq('is_active', true)
        .gt('valid_until', nowIso)
        .order('discount_percent', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!course?.id,
  });

  // Check if user is already enrolled
  useEffect(() => {
    const checkEnrollment = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !course) return;

      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', user.id)
        .eq('course_id', course.id)
        .eq('is_active', true)
        .single();

      if (enrollment) {
        toast.info('You are already enrolled in this course');
        navigate('/dashboard');
      }
    };

    checkEnrollment();
  }, [course, navigate]);

  const handleApplyPromo = async (codeOverride?: string) => {
    const code = (codeOverride ?? promoCode).trim();
    if (!code || !course) return;

    setIsApplyingPromo(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo-code', {
        body: { code: code.toUpperCase(), course_id: course.id }
      });

      if (error) throw error;

      if (data.valid) {
        setDiscount(data);
        toast.success('Promo code applied successfully!');
      } else {
        toast.error(data.message || 'Invalid promo code');
        setDiscount(null);
      }
    } catch (error: any) {
      console.error('Error applying promo:', error);
      toast.error('Failed to apply promo code');
      setDiscount(null);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const calculatePriceAfterDiscount = () => {
    if (!course) return 0;
    const basePrice = course.price_inr || 0;
    
    if (!discount) return basePrice;

    if (discount.discount_percent) {
      return basePrice - (basePrice * discount.discount_percent / 100);
    } else if (discount.discount_amount) {
      return Math.max(0, basePrice - discount.discount_amount);
    }
    
    return basePrice;
  };

  const calculateGST = (amount: number) => Math.round(amount * 0.18);
  const calculateTotalWithGST = (amount: number) => amount + calculateGST(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreedToTerms) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    if (!course) return;

    if (!formData.fullName || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to continue');
        navigate('/auth');
        return;
      }

      const subtotal = calculatePriceAfterDiscount();
      const gst = calculateGST(subtotal);
      const finalAmount = subtotal + gst;

      // Free course short-circuit: create enrollment via edge function, skip Razorpay
      if (finalAmount <= 0) {
        const { data: freeData, error: freeErr } = await supabase.functions.invoke('enroll-free-course', {
          body: { courseId: course.id },
        });
        if (freeErr || !freeData?.enrolled) {
          throw new Error(freeErr?.message || freeData?.error || 'Failed to enroll');
        }
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        toast.success('Enrolled — enjoy the course!');
        navigate(`/learning/${course.slug}`);
        return;
      }


      // Create payment order
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-payment-order', {
        body: {
          amount: finalAmount,
          courses: [{ id: course.id, name: course.name, price: finalAmount }],
          customerInfo: formData,
          promoCode: discount ? promoCode.toUpperCase() : null,
          userId: user.id
        }
      });

      if (orderError) throw orderError;

      // Open Razorpay checkout
      if (orderData.razorpayOrderId && orderData.razorpayKeyId && window.Razorpay) {
        const options = {
          key: orderData.razorpayKeyId,
          amount: finalAmount * 100,
          currency: 'INR',
          name: 'SimpleLecture',
          description: `Payment for ${course.name}`,
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: formData.fullName,
            email: formData.email,
            contact: formData.phone
          },
          theme: { color: '#6366f1' },
          callback_url: `${window.location.origin}/payment-callback`,
          handler: async (response: any) => {
            paymentHandled.current = true;
            try {
              console.log('[Enroll] Razorpay handler fired, verifying payment...', response.razorpay_payment_id);
              const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId: orderData.orderId,
                  userId: user.id,
                  courses: [{ id: course.id, price: finalAmount }]
                }
              });

              if (verifyError || !verifyData?.verified) {
                console.warn('[Enroll] Verification issue, proceeding anyway. Error:', verifyError, 'Data:', verifyData);
                toast.info('Payment received! Your enrollment is being processed.');
              } else {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                toast.success('Enrollment successful!');
              }

              navigate('/payment-success', {
                state: {
                  orderId: orderData.orderId,
                  amount: finalAmount,
                  courses: [{ id: course.id, course_name: course.name }]
                }
              });
            } catch (err) {
              console.error('[Enroll] Verification error:', err);
              toast.info('Payment received! Your enrollment is being processed.');
              navigate('/payment-success', {
                state: {
                  orderId: orderData.orderId,
                  amount: finalAmount,
                  courses: [{ id: course.id, course_name: course.name }]
                }
              });
            }
          },
          modal: {
            ondismiss: () => {
              if (!paymentHandled.current) {
                setIsProcessing(false);
                toast.info('Payment cancelled');
              }
            }
          }
        };

        paymentHandled.current = false;
        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', (response: any) => {
          toast.error(response.error.description || 'Payment failed');
          setIsProcessing(false);
        });
        razorpay.open();
      } else {
        // Demo mode fallback
        console.log('Demo mode - Razorpay not available');
        toast.error('Payment gateway not configured. Please contact support.');
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('Enrollment error:', error);
      toast.error(error.message || 'Failed to process enrollment');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SmartHeader minimal />
        <main className="flex-1 container mx-auto px-4 py-12">
          <Skeleton className="h-96 mb-8" />
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col">
        <SmartHeader minimal />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Course Not Found</h1>
            <Button asChild>
              <Link to="/programs">Browse All Programs</Link>
            </Button>
          </div>
        </main>
        {!isMobile && <Footer />}
      </div>
    );
  }

  const subjects = course.course_subjects?.map((cs: any) => cs.popular_subjects?.name).filter(Boolean) || [];
  const originalPrice = course.price_inr || 0;
  const priceAfterDiscount = calculatePriceAfterDiscount();
  const discountAmount = originalPrice - priceAfterDiscount;
  const gstAmount = calculateGST(priceAfterDiscount);
  const totalWithGST = calculateTotalWithGST(priceAfterDiscount);

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <SEOHead
        title={`Enroll in ${course.name} | SimpleLecture`}
        description={`Enroll in ${course.name} and start learning today`}
      />
      <SmartHeader minimal />

      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-6 md:py-8">
          {/* Back Button */}
          <Button variant="ghost" asChild className="mb-4 md:mb-6 -ml-2">
            <Link to={`/programs/${courseSlug}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Link>
          </Button>

          {/* Step Indicator */}
          <EnrollStepIndicator currentStep={currentStep} />

          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            {/* Left Column: Auth or Payment Form */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              {currentStep === 'auth' ? (
                <EnrollAuthStep
                  onAuthenticated={(authData) => {
                    setFormData(prev => ({
                      ...prev,
                      fullName: authData.fullName || prev.fullName,
                      email: authData.email || prev.email,
                      phone: authData.phone || prev.phone,
                    }));
                    // Force refetch profile data for pre-fill
                    queryClient.invalidateQueries({ queryKey: ['current-user'] });
                    setCurrentStep('payment');
                  }}
                />
              ) : userLoading ? (
                <Card>
                  <CardHeader className="pb-2 md:pb-4">
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2 md:pb-4">
                    <CardTitle className="text-xl md:text-2xl">Complete Your Enrollment</CardTitle>
                    <p className="text-sm text-muted-foreground">Fill in your details to get started</p>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="fullName">Full Name *</Label>
                          <Input
                            id="fullName"
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            placeholder="Enter your full name"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="email">Email Address *</Label>
                            <Input
                              id="email"
                              type="email"
                              required
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              placeholder="your@email.com"
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone Number *</Label>
                            <Input
                              id="phone"
                              type="tel"
                              required
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              placeholder="+91 XXXXX XXXXX"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="state">State</Label>
                            <Input
                              id="state"
                              value={formData.state}
                              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                              placeholder="Your state"
                            />
                          </div>
                          <div>
                            <Label htmlFor="city">City</Label>
                            <Input
                              id="city"
                              value={formData.city}
                              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                              placeholder="Your city"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="terms"
                          checked={agreedToTerms}
                          onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                        />
                        <Label htmlFor="terms" className="text-sm cursor-pointer">
                          I agree to the terms and conditions and privacy policy
                        </Label>
                      </div>

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        disabled={isProcessing || !agreedToTerms}
                      >
                        {isProcessing ? 'Processing...' : (totalWithGST <= 0 ? 'Enroll Free' : `Pay ₹${totalWithGST.toLocaleString()}`)}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Order Summary */}
            <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
              {/* Course Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Course Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {course.thumbnail_url && (
                    <img
                      src={course.thumbnail_url}
                      alt={course.name}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <h3 className="font-bold text-lg">{course.name}</h3>
                    {subjects.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {subjects.map((subject: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Promo Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Tag className="h-5 w-5" />
                    Have a Promo Code?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {featuredPromo && !discount && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoCode(featuredPromo.code);
                        handleApplyPromo(featuredPromo.code);
                      }}
                      className="group relative w-full overflow-hidden rounded-lg border-2 border-dashed border-primary/60 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 p-3 text-left transition hover:border-primary hover:shadow-lg"
                    >
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="h-5 w-5 text-primary animate-pulse shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-primary">
                                {featuredPromo.code}
                              </span>
                              <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white border-0">
                                {featuredPromo.discount_percent
                                  ? `${featuredPromo.discount_percent}% OFF`
                                  : `₹${featuredPromo.discount_amount} OFF`}
                              </Badge>
                            </div>
                            {featuredPromo.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {featuredPromo.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-primary whitespace-nowrap">
                          Tap to apply →
                        </span>
                      </div>
                    </button>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      disabled={!!discount}
                    />
                    {discount ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDiscount(null);
                          setPromoCode('');
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleApplyPromo()}
                        disabled={isApplyingPromo || !promoCode.trim()}
                      >
                        {isApplyingPromo ? 'Checking...' : 'Apply'}
                      </Button>
                    )}
                  </div>
                  {discount && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                        ✓ {discount.description}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Price Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Price Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Course Price</span>
                    <span>₹{originalPrice.toLocaleString()}</span>
                  </div>
                  
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span>-₹{discountAmount.toLocaleString()}</span>
                    </div>
                  )}

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>₹{priceAfterDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span>GST (18%)</span>
                    <span>₹{gstAmount.toLocaleString()}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between font-bold text-lg">
                    <span>Total Amount</span>
                    <span className="text-primary">₹{totalWithGST.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* What's Included */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    What's Included
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Full course access</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>1 Year validity</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-primary" />
                    <span>Certificate on completion</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Secure payment</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {!isMobile && <Footer />}
      <BottomNav />
    </div>
  );
};

export default Enroll;
