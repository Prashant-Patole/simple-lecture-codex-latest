import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FAQ_CATEGORIES } from "@/hooks/useSupportFAQs";
import { 
  User, 
  CreditCard, 
  Wrench, 
  BookOpen, 
  Award, 
  HelpCircle,
  LayoutGrid
} from "lucide-react";

interface SupportCategoryTabsProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  all: <LayoutGrid className="h-4 w-4" />,
  account: <User className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  technical: <Wrench className="h-4 w-4" />,
  courses: <BookOpen className="h-4 w-4" />,
  certificates: <Award className="h-4 w-4" />,
  general: <HelpCircle className="h-4 w-4" />,
};

export const SupportCategoryTabs = ({ selectedCategory, onCategoryChange }: SupportCategoryTabsProps) => {
  return (
    <Tabs value={selectedCategory} onValueChange={onCategoryChange} className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 justify-center">
        {FAQ_CATEGORIES.map((category) => (
          <TabsTrigger
            key={category.value}
            value={category.value}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-full border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {categoryIcons[category.value]}
            {category.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
