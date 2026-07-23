import { cn } from "@/lib/utils";

interface CategoryIconProps {
  icon: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Renders a category icon - handles emoji, URLs, and fallbacks
 * - If icon is a URL (http/https): renders as <img>
 * - If icon is emoji/text: renders as <span>
 * - If icon is null/undefined: renders fallback emoji
 */
export const CategoryIcon = ({
  icon,
  alt = "Category icon",
  className,
  fallback = "📚",
  size = "md",
}: CategoryIconProps) => {
  const sizeClasses = {
    sm: "w-4 h-4 text-sm",
    md: "w-5 h-5 text-base",
    lg: "w-6 h-6 text-lg",
  };

  // No icon - show fallback
  if (!icon) {
    return <span className={cn(sizeClasses[size], className)}>{fallback}</span>;
  }

  // URL icon - render as image
  if (icon.startsWith("http://") || icon.startsWith("https://")) {
    return (
      <img
        src={icon}
        alt={alt}
        className={cn(sizeClasses[size], "object-contain rounded", className)}
        loading="lazy"
        onError={(e) => {
          // On error, replace with fallback
          const target = e.currentTarget;
          target.style.display = "none";
          const span = document.createElement("span");
          span.textContent = fallback;
          span.className = target.className;
          target.parentNode?.insertBefore(span, target);
        }}
      />
    );
  }

  // Emoji or text icon
  return <span className={cn(sizeClasses[size], className)}>{icon}</span>;
};
