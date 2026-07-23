import { forwardRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What subjects does SimpleLecture cover?",
    a: "SimpleLecture covers all major subjects for SSLC 10th board exams including Maths, Science, Social Studies, English, Kannada, and Hindi. We also offer courses for PUC, NEET, JEE, Pharmacy (D.Pharm/B.Pharm), and Nursing (GNM/B.Sc Nursing) preparation.",
  },
  {
    q: "How much does SimpleLecture cost?",
    a: "Our AI-powered courses start at just ₹1000 + GST per course for 1-year access — far less than traditional coaching centres. Live classes and language add-ons are available at affordable top-up prices.",
  },
  {
    q: "Is SimpleLecture available in Kannada and Hindi?",
    a: "Yes! Our AI tutors can explain concepts and clear doubts in Kannada, Hindi, and English. Video lessons are primarily in English with multilingual AI support available 24/7.",
  },
  {
    q: "How does the AI tutor work?",
    a: "Our AI tutor uses adaptive learning technology to understand your strengths and weaknesses. It provides personalised explanations, generates targeted practice questions, and clears doubts instantly — available around the clock.",
  },
  {
    q: "Can SimpleLecture help me score 90+ in board exams?",
    a: "Absolutely. Our mastery-based approach ensures you don't move ahead until you've truly understood each concept. With unlimited practice, AI doubt clearing, and board-pattern mock tests, thousands of students have scored 90+ using SimpleLecture.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes, you can explore free sample lessons and try our AI tutor before purchasing. Sign up for a free account to get started — no credit card required.",
  },
  {
    q: "How is SimpleLecture different from YouTube or free resources?",
    a: "Unlike passive video watching, SimpleLecture actively adapts to your learning gaps. Our AI identifies weak topics, generates personalised tests, and provides step-by-step solutions — something no free resource can offer.",
  },
  {
    q: "Do I get a certificate after completing a course?",
    a: "Yes, you receive a digital certificate of completion for each course. Certificates can be downloaded and shared, and they reflect your mastery level and exam readiness.",
  },
  {
    q: "Does SimpleLecture offer Pharmacy and Nursing entrance preparation?",
    a: "Yes! We offer comprehensive preparation for Pharmacy (D.Pharm & B.Pharm) and Nursing (GNM & B.Sc Nursing) entrance exams with AI-powered doubt clearing, chapter-wise lessons, and practice tests tailored to these streams.",
  },
];

export const HomepageFAQSection = forwardRef<HTMLElement>((_, ref) => {
  return (
    <section ref={ref} className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
});

HomepageFAQSection.displayName = "HomepageFAQSection";
