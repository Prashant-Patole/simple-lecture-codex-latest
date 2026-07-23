import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Globe, 
  Check, 
  Sparkles, 
  ArrowLeft, 
  Volume2, 
  Languages, 
  Zap,
  BookOpen,
  HeadphonesIcon,
  ShieldCheck,
  Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn, formatINR } from "@/lib/utils";
import { SEOHead } from "@/components/SEO";
import { BottomNav } from "@/components/mobile/BottomNav";

// Language data with native scripts
const LANGUAGE_DATA: Record<string, { label: string; native: string; flag: string }> = {
  english: { label: "English", native: "English", flag: "🇬🇧" },
  hindi: { label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  kannada: { label: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳" },
  tamil: { label: "Tamil", native: "தமிழ்", flag: "🇮🇳" },
  telugu: { label: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
  malayalam: { label: "Malayalam", native: "മലയാളം", flag: "🇮🇳" },
  marathi: { label: "Marathi", native: "मराठी", flag: "🇮🇳" },
  bengali: { label: "Bengali", native: "বাংলা", flag: "🇮🇳" },
  gujarati: { label: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
  punjabi: { label: "Punjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  odia: { label: "Odia", native: "ଓଡ଼ିଆ", flag: "🇮🇳" },
  assamese: { label: "Assamese", native: "অসমীয়া", flag: "🇮🇳" },
  urdu: { label: "Urdu", native: "اردو", flag: "🇮🇳" },
};

const FEATURES = [
  { icon: Volume2, title: "AI Lectures in Selected Languages", description: "Watch video lectures in your chosen regional languages" },
  { icon: HeadphonesIcon, title: "AI Teaching Assistant", description: "Get doubt solving in your selected languages" },
  { icon: BookOpen, title: "Lifetime Access", description: "Unlock your chosen languages forever for this course" },
  { icon: Languages, title: "Buy More Anytime", description: "Add more languages to your purchase whenever you want" },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function LanguageTopup() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedToBuy, setSelectedToBuy] = useState<string[]>([]);

  // Fetch course data
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course-topup", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, thumbnail_url, available_languages, language_topup_price, language_topup_original_price")
        .eq("id", courseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Check existing purchases
  const { data: existingPurchase, isLoading: purchaseLoading } = useQuery({
    queryKey: ["topup-purchase-status", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from("language_topup_purchases")
        .select("*")
        .eq("course_id", courseId)
        .eq("user_id", user.id)
        .eq("status", "success")
        .maybeSingle();
      return data;
    },
    enabled: !!courseId,
  });

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const availableLanguages = (course?.available_languages as string[] | null) || ["english"];
  const purchasedLanguages: string[] = (existingPurchase?.selected_languages as string[]) || [];
  const pricePerLanguage = course?.language_topup_price || 0;
  const originalPricePerLanguage = course?.language_topup_original_price || 0;
  
  // Languages available to purchase (exclude English and already purchased)
  const languagesToBuy = availableLanguages.filter(
    lang => lang !== "english" && !purchasedLanguages.includes(lang)
  );
  
  // Calculate totals based on selection
  const totalPrice = pricePerLanguage * selectedToBuy.length;
  const totalOriginalPrice = originalPricePerLanguage * selectedToBuy.length;
  const discount = totalOriginalPrice > totalPrice && totalOriginalPrice > 0
    ? Math.round(((totalOriginalPrice - totalPrice) / totalOriginalPrice) * 100) 
    : 0;
  const savings = totalOriginalPrice - totalPrice;

  const toggleLanguage = (lang: string) => {
    setSelectedToBuy(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang) 
        : [...prev, lang]
    );
  };

  const selectAll = () => {
    setSelectedToBuy(languagesToBuy);
  };

  const clearSelection = () => {
    setSelectedToBuy([]);
  };

  const handlePurchase = async () => {
    if (selectedToBuy.length === 0) {
      toast({ title: "Select at least 1 language", variant: "destructive" });
      return;
    }

    try {
      setIsProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please login", description: "You need to login to purchase", variant: "destructive" });
        navigate("/auth");
        return;
      }

      // Create order via edge function
      const { data, error } = await supabase.functions.invoke("create-topup-order", {
        body: {
          userId: user.id,
          courseId,
          languages: selectedToBuy,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const { razorpayOrderId, razorpayKeyId, orderId, amount } = data;

      if (!razorpayOrderId || !window.Razorpay) {
        throw new Error("Payment gateway not available");
      }

      // Open Razorpay checkout
      const options = {
        key: razorpayKeyId,
        amount: amount * 100,
        currency: "INR",
        name: "SimpleLecture",
        description: `${selectedToBuy.length} Language${selectedToBuy.length > 1 ? 's' : ''}: ${course?.name}`,
        order_id: razorpayOrderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            const { error: verifyError } = await supabase.functions.invoke("verify-topup-payment", {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId,
                userId: user.id,
                courseId,
                languages: selectedToBuy,
              },
            });

            if (verifyError) throw verifyError;

            toast({
              title: "🎉 Languages Unlocked!",
              description: `You now have access to ${selectedToBuy.length} additional language${selectedToBuy.length > 1 ? 's' : ''}`,
            });
            navigate(`/learning/${courseId}`);
          } catch (err) {
            console.error("Payment verification failed:", err);
            toast({ title: "Payment verification failed", variant: "destructive" });
          }
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: "#8B5CF6",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Purchase error:", error);
      toast({ title: error instanceof Error ? error.message : "Something went wrong", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (courseLoading || purchaseLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-primary/20 dark:from-primary/20 dark:via-background dark:to-primary/20">
        <div className="container max-w-4xl py-12 px-4">
          <Skeleton className="h-12 w-48 mb-8" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Course not found</p>
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All languages already purchased state
  const allPurchased = languagesToBuy.length === 0 && purchasedLanguages.length > 0;
  
  if (allPurchased) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-background to-emerald-50 dark:from-green-950/20 dark:via-background dark:to-emerald-950/20">
        <SEOHead title={`Language Top-Up - ${course.name}`} description={`Unlock multi-language AI lectures for ${course.name}`} />
        <div className="container max-w-4xl py-12 px-4">
          <Button variant="ghost" onClick={() => navigate(`/learning/${courseId}`)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Course
          </Button>
          
          <Card className="border-2 border-green-500/50 bg-gradient-to-br from-green-500/10 to-emerald-500/10">
            <CardContent className="py-12 text-center">
              <div className="inline-flex p-4 rounded-full bg-green-500/20 mb-6">
                <ShieldCheck className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold mb-4 text-green-700 dark:text-green-400">
                All Languages Unlocked! 🎉
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                You have lifetime access to all available languages for this course
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <Badge className="bg-green-500 text-white px-4 py-2 text-sm">
                  <Check className="h-4 w-4 mr-1" />
                  English (Free)
                </Badge>
                {purchasedLanguages.map(lang => (
                  <Badge key={lang} className="bg-green-500 text-white px-4 py-2 text-sm">
                    <Check className="h-4 w-4 mr-1" />
                    {LANGUAGE_DATA[lang]?.label || lang}
                  </Badge>
                ))}
              </div>
              <Button 
                size="lg" 
                onClick={() => navigate(`/learning/${courseId}`)}
                className="bg-green-600 hover:bg-green-700"
              >
                Continue Learning
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-gradient-to-br from-primary/20 via-background to-primary/20 dark:from-primary/20 dark:via-background dark:to-primary/20">
      <SEOHead title={`Unlock Languages - ${course.name}`} description={`Get AI-powered lectures in multiple languages for ${course.name}`} />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        
        <div className="container max-w-4xl py-12 px-4 relative">
          <Button variant="ghost" onClick={() => navigate(`/learning/${courseId}`)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Course
          </Button>
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary dark:text-primary mb-6">
              <Globe className="h-5 w-5" />
              <span className="font-medium">Multi-Language Access</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary bg-clip-text text-transparent">
              Unlock Languages
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Learn in your native language with AI-powered lectures for <span className="font-semibold text-foreground">{course.name}</span>
            </p>
            <p className="text-lg mt-2 text-primary dark:text-primary font-medium">
              {formatINR(pricePerLanguage)} per language
            </p>
          </div>

          {/* English - Always Free */}
          <Card className="mb-6 border-2 border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-500/20">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <span className="text-lg font-semibold">English</span>
                    <p className="text-sm text-muted-foreground">Default language - Always included</p>
                  </div>
                </div>
                <Badge className="bg-green-500 text-white">FREE</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Already Purchased Languages */}
          {purchasedLanguages.length > 0 && (
            <Card className="mb-6 border-2 border-green-300 dark:border-green-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Already Purchased
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {purchasedLanguages.map(lang => (
                    <Badge key={lang} className="bg-green-500 text-white px-4 py-2">
                      <Check className="h-4 w-4 mr-1" />
                      {LANGUAGE_DATA[lang]?.native || lang} ({LANGUAGE_DATA[lang]?.label || lang})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Languages Available to Purchase */}
          {languagesToBuy.length > 0 && (
            <Card className="mb-8 border-2 border-primary/30 dark:border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="h-5 w-5 text-primary" />
                      Select Languages to Unlock
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Choose the languages you want • {formatINR(pricePerLanguage)} each
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    {selectedToBuy.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {languagesToBuy.map((lang) => {
                    const langData = LANGUAGE_DATA[lang];
                    const isSelected = selectedToBuy.includes(lang);
                    return (
                      <div
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer hover:scale-105",
                          isSelected
                            ? "bg-gradient-to-br from-primary/20 to-primary/20 border-primary shadow-lg shadow-violet-500/20"
                            : "border-muted hover:border-primary/30 dark:hover:border-primary"
                        )}
                      >
                        <div className="flex items-center justify-center mb-2">
                          <Checkbox 
                            checked={isSelected}
                            className="mr-2"
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleLanguage(lang)}
                          />
                          <span className="text-xl">{langData?.flag || "🌐"}</span>
                        </div>
                        <span className="text-xl font-bold text-primary dark:text-primary block">
                          {langData?.native || lang}
                        </span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {langData?.label || lang}
                        </p>
                        <p className="text-sm font-medium text-primary dark:text-primary mt-2">
                          {formatINR(pricePerLanguage)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Features */}
          <Card className="mb-8">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                What You Get
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {FEATURES.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10"
                  >
                    <div className="p-3 rounded-xl bg-primary/20">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pricing Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary rounded-2xl blur opacity-25 animate-pulse" />
            <Card className="relative border-2 border-primary/50 bg-card/95 backdrop-blur">
              <CardContent className="p-8">
                <div className="text-center">
                  {selectedToBuy.length > 0 ? (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-2 text-muted-foreground">
                        <span>{selectedToBuy.length} language{selectedToBuy.length > 1 ? 's' : ''}</span>
                        <span>×</span>
                        <span>{formatINR(pricePerLanguage)}</span>
                      </div>
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <span className="text-5xl font-bold text-primary dark:text-primary">
                          {formatINR(totalPrice)}
                        </span>
                        {discount > 0 && (
                          <>
                            <span className="text-2xl text-muted-foreground line-through">
                              {formatINR(totalOriginalPrice)}
                            </span>
                            <Badge className="bg-green-500 text-white text-lg px-3 py-1">
                              {discount}% OFF
                            </Badge>
                          </>
                        )}
                      </div>
                      {discount > 0 && (
                        <p className="text-green-600 dark:text-green-400 font-medium mb-6">
                          You save {formatINR(savings)}!
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="mb-6">
                      <p className="text-xl text-muted-foreground">
                        Select languages above to see pricing
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {formatINR(pricePerLanguage)} per language
                      </p>
                    </div>
                  )}
                  <p className="text-muted-foreground mb-6">
                    One-time payment • Lifetime access • Selected languages
                  </p>
                  <Button
                    size="lg"
                    onClick={handlePurchase}
                    disabled={isProcessing || selectedToBuy.length === 0}
                    className="w-full max-w-md h-14 text-lg bg-gradient-to-r from-primary to-primary hover:from-primary-dark hover:to-primary-dark shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>Processing...</>
                    ) : selectedToBuy.length === 0 ? (
                      <>Select at least 1 language</>
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" />
                        Unlock {selectedToBuy.length} Language{selectedToBuy.length > 1 ? 's' : ''} - {formatINR(totalPrice)}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Secure payment powered by Razorpay
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
