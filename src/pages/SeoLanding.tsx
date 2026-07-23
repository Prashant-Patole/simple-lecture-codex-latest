import { useParams, Link, Navigate } from "react-router-dom";
import { SmartHeader } from "@/components/SmartHeader";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/mobile/BottomNav";
import { SEOHead } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { LANDING_PAGE_MAP } from "@/lib/seo/landingPages";

const SeoLanding = () => {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? LANDING_PAGE_MAP[slug] : undefined;

  if (!config) {
    return <Navigate to="/" replace />;
  }

  const canonical = `https://simplelecture.com/learn/${config.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": canonical,
        url: canonical,
        name: config.title,
        description: config.description,
        isPartOf: {
          "@type": "WebSite",
          name: "SimpleLecture",
          url: "https://simplelecture.com",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://simplelecture.com/" },
          { "@type": "ListItem", position: 2, name: "Learn", item: "https://simplelecture.com/programs" },
          { "@type": "ListItem", position: 3, name: config.h1, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: config.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={config.title}
        description={config.description}
        keywords={config.keywords}
        canonicalUrl={canonical}
        structuredData={structuredData}
      />
      <SmartHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background border-b">
          <div className="container mx-auto px-4 py-12 md:py-20">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" /> India's AI-Powered Learning Platform
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                {config.h1}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                {config.heroSubtitle}
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {config.ctaCourseSlug ? (
                  <Button size="lg" asChild>
                    <Link to={`/course/${config.ctaCourseSlug}`}>
                      {config.ctaText || "Start Learning"} <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" asChild>
                    <Link to="/programs">{config.ctaText || "Browse Courses"} <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" asChild>
                  <Link to="/contact">Book Free Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <p className="text-base md:text-lg leading-relaxed text-foreground/90">{config.intro}</p>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-8 md:py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
            What You Get
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {config.features.map((f) => (
              <Card key={f.title} className="h-full">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Why us */}
        <section className="bg-muted/40 py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
                Why SimpleLecture
              </h2>
              <ul className="space-y-3">
                {config.whyUs.map((w) => (
                  <li key={w} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {config.faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary/5 border-t">
          <div className="container mx-auto px-4 py-12 md:py-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to start your learning journey?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of students already learning on SimpleLecture.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {config.ctaCourseSlug ? (
                <Button size="lg" asChild>
                  <Link to={`/course/${config.ctaCourseSlug}`}>
                    {config.ctaText || "Start Learning"}
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild>
                  <Link to="/programs">Browse All Courses</Link>
                </Button>
              )}
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth?tab=signup">Create Free Account</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Related */}
        {config.relatedLinks && config.relatedLinks.length > 0 && (
          <section className="container mx-auto px-4 py-10 border-t">
            <h2 className="text-lg font-semibold mb-4">Related Programs</h2>
            <div className="flex flex-wrap gap-2">
              {config.relatedLinks.map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  className="px-4 py-2 rounded-full bg-muted hover:bg-muted/70 text-sm transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
};

export default SeoLanding;
