import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAdminCategories, useCategoryMaps } from "@/hooks/useAdminCategories";
import { Label } from "@/components/ui/label";

interface SearchableCategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showNoneOption?: boolean;
  noneOptionLabel?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
  excludeId?: string;
}

export const SearchableCategorySelector = ({
  value,
  onChange,
  label,
  placeholder = "Select category...",
  showNoneOption = false,
  noneOptionLabel = "None (Top Level)",
  showAllOption = false,
  allOptionLabel = "All",
  disabled = false,
  excludeId,
}: SearchableCategorySelectorProps) => {
  const [open, setOpen] = useState(false);
  const { data: categories, isLoading } = useAdminCategories();
  const { hierarchyDisplayMap } = useCategoryMaps(categories);

  // Memoize filtered categories
  const filteredCategories = useMemo(() => 
    categories?.filter(cat => excludeId ? cat.id !== excludeId : true) || [],
    [categories, excludeId]
  );

  // Memoize display value calculation
  const displayValue = useMemo(() => {
    if (value === "all") return allOptionLabel;
    if (value === "none" || value === "") return showNoneOption ? noneOptionLabel : placeholder;
    return hierarchyDisplayMap.get(value) || placeholder;
  }, [value, allOptionLabel, showNoneOption, noneOptionLabel, placeholder, hierarchyDisplayMap]);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isLoading || disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="min-w-[280px] w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start" sideOffset={4}>
          <Command className="flex flex-col">
            <div className="sticky top-0 z-10 bg-popover border-b">
              <CommandInput placeholder="Search categories..." />
            </div>
            <CommandList className="max-h-[250px]">
              <CommandEmpty>No category found.</CommandEmpty>
              <CommandGroup>
                {showAllOption && (
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onChange("all");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                    {allOptionLabel}
                  </CommandItem>
                )}
                {showNoneOption && (
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onChange("none");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "none" || value === "" ? "opacity-100" : "opacity-0")} />
                    {noneOptionLabel}
                  </CommandItem>
                )}
                {filteredCategories.map((cat) => {
                  // Use pre-computed hierarchy display from Map - O(1) lookup
                  const displayName = hierarchyDisplayMap.get(cat.id) || cat.name;
                  return (
                    <CommandItem
                      key={cat.id}
                      value={displayName}
                      onSelect={() => {
                        onChange(cat.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === cat.id ? "opacity-100" : "opacity-0")} />
                      {displayName}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
