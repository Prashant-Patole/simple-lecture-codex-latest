import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, Languages, IndianRupee, Percent } from "lucide-react";

export const INDIAN_LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi (हिन्दी)" },
  { value: "kannada", label: "Kannada (ಕನ್ನಡ)" },
  { value: "tamil", label: "Tamil (தமிழ்)" },
  { value: "telugu", label: "Telugu (తెలుగు)" },
  { value: "malayalam", label: "Malayalam (മലയാളം)" },
  { value: "marathi", label: "Marathi (मराठी)" },
  { value: "bengali", label: "Bengali (বাংলা)" },
  { value: "gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "punjabi", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { value: "odia", label: "Odia (ଓଡ଼ିଆ)" },
  { value: "assamese", label: "Assamese (অসমীয়া)" },
  { value: "urdu", label: "Urdu (اردو)" },
];

interface CourseTopUpsTabProps {
  selectedLanguages: string[] | null;
  onChange: (languages: string[]) => void;
  languageTopupPrice: number;
  languageTopupOriginalPrice: number;
  onPriceChange: (field: string, value: number) => void;
}

export function CourseTopUpsTab({ 
  selectedLanguages, 
  onChange,
  languageTopupPrice,
  languageTopupOriginalPrice,
  onPriceChange,
}: CourseTopUpsTabProps) {
  // "None" means only English is selected (English is always required)
  const isNoneSelected = !selectedLanguages || 
                         selectedLanguages.length === 0 || 
                         (selectedLanguages.length === 1 && selectedLanguages[0] === "english");

  // Show pricing only when more than English is selected
  const showPricing = selectedLanguages && selectedLanguages.length > 1;

  // Calculate discount
  const savings = languageTopupOriginalPrice - languageTopupPrice;
  const discountPercent = languageTopupOriginalPrice > 0 
    ? Math.round((savings / languageTopupOriginalPrice) * 100) 
    : 0;
  const hasDiscount = savings > 0 && discountPercent > 0;

  const handleNoneChange = (checked: boolean) => {
    if (checked) {
      onChange(["english"]); // Keep English as default
    }
  };

  const handleLanguageChange = (language: string, checked: boolean) => {
    if (checked) {
      const currentLanguages = selectedLanguages || ["english"];
      const newLanguages = currentLanguages.includes(language) 
        ? currentLanguages 
        : [...currentLanguages, language];
      onChange(newLanguages);
    } else {
      // Prevent removing English
      if (language === "english") return;
      
      const newLanguages = (selectedLanguages || ["english"]).filter((l) => l !== language);
      // Always keep at least English
      onChange(newLanguages.length === 0 ? ["english"] : newLanguages);
    }
  };

  const handleClearAll = () => {
    onChange(["english"]); // Reset to English only
  };

  const getLanguageLabel = (value: string) => {
    return INDIAN_LANGUAGES.find((l) => l.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            <CardTitle>Language Top-Ups</CardTitle>
          </div>
          <CardDescription>
            Select which language versions are available for this course content. 
            These languages will be shown as options for students.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* None Option */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg bg-muted/50">
            <Checkbox
              id="none"
              checked={isNoneSelected}
              onCheckedChange={handleNoneChange}
            />
            <Label htmlFor="none" className="text-sm font-medium cursor-pointer">
              None (No additional language versions available)
            </Label>
          </div>

          {/* Languages Grid */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">
              Select Languages:
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {INDIAN_LANGUAGES.map((language) => {
                const isEnglish = language.value === "english";
                const isChecked = selectedLanguages?.includes(language.value) || isEnglish;
                
                return (
                  <div
                    key={language.value}
                    className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors ${
                      isEnglish ? "bg-muted/30 border-primary/30" : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      id={language.value}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleLanguageChange(language.value, checked as boolean)
                      }
                      disabled={isEnglish}
                    />
                    <Label
                      htmlFor={language.value}
                      className={`text-sm flex-1 ${isEnglish ? "text-muted-foreground" : "cursor-pointer"}`}
                    >
                      {language.label}
                      {isEnglish && <span className="ml-2 text-xs text-primary">(Default)</span>}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Languages Display */}
          {selectedLanguages && selectedLanguages.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Selected Languages ({selectedLanguages.length}):
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedLanguages.map((lang) => {
                  const isEnglish = lang === "english";
                  return (
                    <Badge
                      key={lang}
                      variant={isEnglish ? "default" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {getLanguageLabel(lang)}
                      {isEnglish && <span className="text-xs opacity-75">(Default)</span>}
                      {!isEnglish && (
                        <button
                          type="button"
                          onClick={() => handleLanguageChange(lang, false)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Card - Only show when additional languages selected */}
      {showPricing && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <CardTitle>Per-Language Pricing</CardTitle>
            </div>
            <CardDescription>
              Set the price per language. Students pay this amount for each language they want to unlock.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Price */}
              <div className="space-y-2">
                <Label htmlFor="language_topup_price" className="text-sm font-medium">
                  Price per Language (INR)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="language_topup_price"
                    type="number"
                    min="0"
                    value={languageTopupPrice}
                    onChange={(e) => onPriceChange("language_topup_price", Number(e.target.value))}
                    className="pl-8"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Students pay this amount for each language they select
                </p>
              </div>

              {/* Original Price */}
              <div className="space-y-2">
                <Label htmlFor="language_topup_original_price" className="text-sm font-medium">
                  Original Price per Language (INR)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="language_topup_original_price"
                    type="number"
                    min="0"
                    value={languageTopupOriginalPrice}
                    onChange={(e) => onPriceChange("language_topup_original_price", Number(e.target.value))}
                    className="pl-8"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Strikethrough price per language to highlight discount
                </p>
              </div>
            </div>

            {/* Discount Display */}
            {hasDiscount && (
              <div className="flex items-center gap-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-primary">{discountPercent}% OFF</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Students save <span className="font-medium text-primary">₹{savings.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
