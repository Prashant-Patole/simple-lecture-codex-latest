import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SupportFAQ, FAQ_CATEGORIES } from "@/hooks/useSupportFAQs";
import ReactMarkdown from "react-markdown";

interface SupportFAQsProps {
  faqs: SupportFAQ[] | undefined;
  isLoading: boolean;
  searchTerm?: string;
}

export const SupportFAQs = ({ faqs, isLoading, searchTerm }: SupportFAQsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!faqs || faqs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {searchTerm 
          ? `No FAQs found for "${searchTerm}". Try a different search term or chat with our AI assistant.`
          : "No FAQs available in this category."
        }
      </div>
    );
  }

  const getCategoryLabel = (category: string) => {
    return FAQ_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {faqs.map((faq) => (
        <AccordionItem 
          key={faq.id} 
          value={faq.id}
          className="border rounded-lg px-4 bg-card hover:bg-accent/50 transition-colors"
        >
          <AccordionTrigger className="text-left hover:no-underline py-4">
            <div className="flex items-start gap-3 pr-4">
              <Badge variant="secondary" className="shrink-0 mt-0.5 capitalize">
                {getCategoryLabel(faq.category)}
              </Badge>
              <span className="font-medium">{faq.question}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground pb-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{faq.answer}</ReactMarkdown>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
