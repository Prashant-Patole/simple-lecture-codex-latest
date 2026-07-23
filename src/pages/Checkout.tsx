import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { SEOHead } from '@/components/SEO';
import { SmartHeader } from '@/components/SmartHeader';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/mobile/BottomNav';
import { useCart } from '@/hooks/useCart';
import { formatINR } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();
  const { toast } = useToast();

  const discount = location.state?.discount || 0;
  const promoCode = location.state?.promoCode || null;
  const finalAmount = total - discount;

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    state: '',
    city: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Load Razorpay script on-demand (only when user actually pays)
  const ensureRazorpay = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if ((window as any).Razorpay) return resolve(true);
      const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay]');
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.dataset.razorpay = 'true';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast({
        title: 'Terms Required',
        description: 'Please accept terms and conditions',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create payment order with correct data structure
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-payment-order',
        {
          body: {
            userId: user.id,
            amount: finalAmount,
            courses: items.map((item) => ({
              id: item.course_id,
              price: item.course_price,
              name: item.course_name
            })),
            customerInfo: formData,
            promoCode
          },
        }
      );

      if (orderError) throw orderError;

      console.log('Order created:', orderData);

      // If Razorpay order was created, open checkout
      if (orderData.razorpayOrderId && orderData.razorpayKeyId) {
        await ensureRazorpay();
      }
      if (orderData.razorpayOrderId && orderData.razorpayKeyId && window.Razorpay) {
        const options = {
          key: orderData.razorpayKeyId,
          amount: finalAmount * 100,
          currency: 'INR',
          name: 'SimpleLecture',
          description: `Payment for ${items.length} course(s)`,
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: formData.fullName,
            email: formData.email,
            contact: formData.phone
          },
          theme: {
            color: '#6366f1'
          },
          callback_url: `${window.location.origin}/payment-callback`,
          handler: async (response: any) => {
            console.log('Razorpay payment response:', response);
            
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              'verify-payment',
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId: orderData.orderId,
                  userId: user.id,
                  courses: items.map((item) => ({
                    id: item.course_id,
                    price: item.course_price
                  }))
                }
              }
            );

            if (verifyError || !verifyData?.verified) {
              toast({
                title: 'Payment Verification Failed',
                description: 'Please contact support if amount was deducted',
                variant: 'destructive',
              });
              navigate('/payment-failed');
              return;
            }

            await clearCart();
            navigate('/payment-success', {
              state: {
                orderId: orderData.orderId,
                amount: finalAmount,
                courses: items.map(item => ({
                  id: item.course_id,
                  course_name: item.course_name
                })),
              },
            });
          },
          modal: {
            ondismiss: () => {
              setProcessing(false);
              toast({
                title: 'Payment Cancelled',
                description: 'You cancelled the payment',
              });
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', (response: any) => {
          console.error('Payment failed:', response.error);
          toast({
            title: 'Payment Failed',
            description: response.error.description || 'Payment could not be processed',
            variant: 'destructive',
          });
          setProcessing(false);
        });
        razorpay.open();
      } else {
        // Fallback: demo mode without Razorpay
        console.log('Running in demo mode - no Razorpay configured');
        
        // Create enrollments directly for demo
        const { error: verifyError } = await supabase.functions.invoke(
          'verify-payment',
          {
            body: {
              razorpay_order_id: 'demo_order',
              razorpay_payment_id: 'demo_payment',
              razorpay_signature: 'demo_signature',
              orderId: orderData.orderId,
              userId: user.id,
              courses: items.map((item) => ({
                id: item.course_id,
                price: item.course_price
              }))
            }
          }
        );

        // Update payment status to success for demo
        await supabase
          .from('payments')
          .update({ status: 'success', completed_at: new Date().toISOString() })
          .eq('order_id', orderData.orderId);

        await clearCart();
        navigate('/payment-success', {
          state: {
            orderId: orderData.orderId,
            amount: finalAmount,
            courses: items.map(item => ({
              id: item.course_id,
              course_name: item.course_name
            })),
          },
        });
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Payment Failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  return (
    <>
      <SEOHead title="Checkout | SimpleLecture" description="Complete your purchase" />
      <SmartHeader />
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Checkout</h1>

          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <Card className="p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">Contact Information</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-4">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                    />
                    <label htmlFor="terms" className="text-sm cursor-pointer">
                      I accept the terms and conditions
                    </label>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={processing}>
                    {processing ? 'Processing...' : `Pay ${formatINR(finalAmount)}`}
                  </Button>
                </form>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1 order-1 lg:order-2">
              <Card className="p-4 md:p-6 lg:sticky lg:top-4">
                <h2 className="text-lg md:text-xl font-bold mb-4">Order Summary</h2>

                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.course_name}</span>
                      <span>{formatINR(item.course_price)}</span>
                    </div>
                  ))}

                  <Separator />

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{formatINR(total)}</span>
                  </div>

                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount {promoCode && `(${promoCode})`}</span>
                      <span>-{formatINR(discount)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-2xl">{formatINR(finalAmount)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <BottomNav />
    </>
  );
};

export default Checkout;
