import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { SEOHead } from '@/components/SEO';
import { SmartHeader } from '@/components/SmartHeader';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/mobile/BottomNav';
import { useCart } from '@/hooks/useCart';
import { formatINR } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const Cart = () => {
  const { items, loading, removeFromCart, total } = useCart();
  const [discountCode, setDiscountCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const applyDiscount = async () => {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', discountCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast({
          title: 'Invalid Code',
          description: 'Discount code not found or expired',
          variant: 'destructive',
        });
        return;
      }

      const discountAmount = data.discount_percent
        ? (total * data.discount_percent) / 100
        : data.discount_amount || 0;

      setDiscount(discountAmount);
      setDiscountApplied(true);
      toast({
        title: 'Discount Applied',
        description: `You saved ${formatINR(discountAmount)}!`,
      });
    } catch (error) {
      console.error('Error applying discount:', error);
    }
  };

  const finalAmount = total - discount;

  if (checkingAuth || loading) {
    return (
      <>
        {!isMobile && <SmartHeader />}
        <div className="min-h-screen flex items-center justify-center">
          <p>Loading...</p>
        </div>
        {isMobile ? <BottomNav /> : <Footer />}
      </>
    );
  }

  // If user is not logged in, show login prompt
  if (!user) {
    return (
      <>
        <SEOHead title="Shopping Cart | SimpleLecture" description="Your shopping cart" />
        {!isMobile && <SmartHeader />}
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="container mx-auto px-4 py-16">
            <Card className="max-w-md mx-auto p-8 text-center">
              <LogIn className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Login Required</h2>
              <p className="text-muted-foreground mb-6">
                Please login or sign up to view your cart and make purchases
              </p>
              <div className="flex gap-3">
                <Link to="/auth?tab=login" className="flex-1">
                  <Button size="lg" className="w-full">Login</Button>
                </Link>
                <Link to="/auth?tab=signup" className="flex-1">
                  <Button size="lg" variant="outline" className="w-full">Sign Up</Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
        {isMobile ? <BottomNav /> : <Footer />}
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <SEOHead title="Shopping Cart | SimpleLecture" description="Your shopping cart" />
        {!isMobile && <SmartHeader />}
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-16">
            <Card className="max-w-md mx-auto p-8 text-center">
              <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">Start exploring our programs</p>
              <Link to="/programs">
                <Button size="lg">Explore Programs</Button>
              </Link>
            </Card>
          </div>
        </div>
        {isMobile ? <BottomNav /> : <Footer />}
      </>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <>
        <SEOHead title="Shopping Cart | SimpleLecture" description="Review your selected programs" />
        
        {/* Mobile Header */}
        <div className="bg-gradient-to-br from-primary via-primary to-primary px-4 pt-10 pb-6 rounded-b-[1.5rem]">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-white text-lg font-bold">Shopping Cart</h1>
          </div>
        </div>

        <div className="min-h-screen bg-background pb-40 px-4 pt-4">
          {/* Cart Items */}
          <div className="space-y-3 mb-6">
            {items.map((item) => (
              <Card key={item.id} className="p-3 border-0 shadow-sm">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2">{item.course_name}</h3>
                    <p className="text-base font-bold text-primary mt-1">{formatINR(item.course_price)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Discount Code */}
          <Card className="p-4 mb-4 border-0 shadow-sm">
            <label className="text-sm font-medium mb-2 block">Discount Code</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                disabled={discountApplied}
                className="text-sm"
              />
              <Button
                onClick={applyDiscount}
                disabled={discountApplied || !discountCode}
                variant="outline"
                size="sm"
              >
                Apply
              </Button>
            </div>
          </Card>

          {/* Order Summary */}
          <Card className="p-4 border-0 shadow-sm">
            <h2 className="font-bold mb-3">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatINR(total)}</span>
              </div>
              {discountApplied && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatINR(discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary">{formatINR(finalAmount)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Sticky Checkout Button */}
        <div className="fixed bottom-16 left-0 right-0 bg-background border-t p-4 z-40">
          <Button
            className="w-full bg-primary hover:bg-primary"
            size="lg"
            onClick={() => navigate('/checkout', { state: { discount, discountCode } })}
          >
            Proceed to Checkout • {formatINR(finalAmount)}
          </Button>
        </div>

        <BottomNav />
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <SEOHead title="Shopping Cart | SimpleLecture" description="Review your selected programs" />
      <SmartHeader />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Link to="/courses">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Continue Shopping
            </Button>
          </Link>

          <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Shopping Cart</h1>

          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-3 md:space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="p-4 md:p-6">
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-muted rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg mb-1 line-clamp-2">{item.course_name}</h3>
                      <p className="text-xl md:text-2xl font-bold text-primary">{formatINR(item.course_price)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-5 w-5 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="p-4 md:p-6 sticky top-4">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{formatINR(total)}</span>
                  </div>

                  {discountApplied && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatINR(discount)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatINR(finalAmount)}</span>
                  </div>
                </div>

                {/* Discount Code */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Discount Code</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      disabled={discountApplied}
                    />
                    <Button
                      onClick={applyDiscount}
                      disabled={discountApplied || !discountCode}
                      variant="outline"
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate('/checkout', { state: { discount, discountCode } })}
                >
                  Proceed to Checkout
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Cart;
