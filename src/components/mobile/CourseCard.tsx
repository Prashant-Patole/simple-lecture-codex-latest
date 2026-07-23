import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

interface CourseCardProps {
  image: string;
  badge?: string;
  title: string;
  instructor?: string;
  language: string;
  price: number;
  originalPrice?: number;
  description?: string;
  onWhatsAppClick?: () => void;
}

export const CourseCard = ({
  image,
  badge,
  title,
  instructor,
  language,
  price,
  originalPrice,
  description,
  onWhatsAppClick,
}: CourseCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      <div className="relative">
        <img
          src={image}
          alt={title}
          className="w-full h-40 object-cover"
        />
        {badge && (
          <Badge className="absolute top-2 left-2 bg-yellow-500 text-black hover:bg-yellow-600">
            {badge}
          </Badge>
        )}
        {onWhatsAppClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWhatsAppClick();
            }}
            className="absolute bottom-2 right-2 bg-green-500 text-white p-2 rounded-full hover:bg-green-600 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
          {title}
        </h3>
        {instructor && (
          <p className="text-sm text-muted-foreground mb-2">{instructor}</p>
        )}
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {language}
          </Badge>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {description}
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">
            {formatINR(price)}
          </span>
          {originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatINR(originalPrice)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
