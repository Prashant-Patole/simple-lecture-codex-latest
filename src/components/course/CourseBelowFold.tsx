import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Play,
  FileText,
  Target,
  Award,
  TrendingUp,
  Zap,
  Globe,
  HeadphonesIcon,
  CheckCircle2,
} from "lucide-react";

interface CourseBelowFoldProps {
  learningPoints: any[];
  courseIncludes: any[];
  faqs: any[];
  isMobile: boolean;
}

const features = [
  { icon: Play, title: "Live Classes", description: "Interactive sessions with expert instructors" },
  { icon: FileText, title: "Study Materials", description: "Comprehensive notes and resources" },
  { icon: Target, title: "Practice Tests", description: "Regular assessments and mock tests" },
  { icon: HeadphonesIcon, title: "Doubt Support", description: "24/7 AI-powered doubt clearing" },
  { icon: Award, title: "Certificates", description: "Get certified upon completion" },
  { icon: TrendingUp, title: "Progress Tracking", description: "Monitor your learning journey" },
];

const CourseBelowFold = ({ learningPoints, courseIncludes, faqs, isMobile }: CourseBelowFoldProps) => {
  if (isMobile) {
    return (
      <>
        {/* What You'll Learn */}
        {learningPoints.length > 0 && (
          <Card className="border bg-gradient-to-br from-primary/5 to-background">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Target className="h-4 w-4 text-primary" />
                What You'll Learn
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-2">
              <div className="space-y-2">
                {learningPoints.map((point: any, index: number) => {
                  const text = typeof point === 'string' ? point : point.text || point.title || '';
                  return (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{text}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Course Features */}
        <Card className="border">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-primary" />
              Course Features
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <feature.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-[11px] font-medium leading-tight">{feature.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Course Includes */}
        {courseIncludes.length > 0 && (
          <Card className="border">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm font-bold">This Course Includes</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="space-y-2">
                {courseIncludes.map((item: any, index: number) => {
                  const text = typeof item === 'string' ? item : item.text || item.title || '';
                  return (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{text}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <Card className="border">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Globe className="h-4 w-4 text-primary" />
                FAQs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <Accordion type="single" collapsible className="space-y-1">
                {faqs.map((faq: any) => (
                  <AccordionItem key={faq.id} value={faq.id} className="border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline py-2.5 text-xs">
                      <span className="text-left font-medium">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-xs text-muted-foreground pt-1">{faq.answer}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  // Desktop below-fold
  return (
    <>
      {/* What You'll Learn */}
      {learningPoints.length > 0 && (
        <Card className="border-2 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Target className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              What You'll Learn
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {learningPoints.map((point: any, index: number) => {
                const text = typeof point === 'string' ? point : point.text || point.title || '';
                return (
                  <div key={index} className="flex items-start gap-2 md:gap-3">
                    <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm md:text-base text-muted-foreground">{text}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features Grid */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Zap className="h-6 w-6 text-primary" />
            Course Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      {faqs.length > 0 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Globe className="h-6 w-6 text-primary" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq: any) => (
                <AccordionItem key={faq.id} value={faq.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-left font-medium">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground pt-2">{faq.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default CourseBelowFold;
