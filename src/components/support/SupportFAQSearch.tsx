import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SupportFAQSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const SupportFAQSearch = ({ searchTerm, onSearchChange }: SupportFAQSearchProps) => {
  return (
    <div className="relative max-w-2xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search FAQs... (e.g., password reset, payment, certificate)"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-12 h-10 sm:h-12 text-sm sm:text-base"
      />
    </div>
  );
};
