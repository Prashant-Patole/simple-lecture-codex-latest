import { useState, useEffect, useRef, forwardRef } from "react";
import { useCourseThumbnail } from "@/hooks/useCourseThumbnail";
import { cn } from "@/lib/utils";
import { rewriteStorageUrl } from "@/lib/proxyUrl";

interface CourseThumbnailProps {
  /** Course ID - used for lazy loading via query */
  courseId?: string;
  /** Direct thumbnail URL - used when data is already available (no query needed) */
  thumbnailUrl?: string | null;
  alt: string;
  className?: string;
  /** Enable lazy loading with IntersectionObserver (default: false for pre-fetched data) */
  lazy?: boolean;
}

/**
 * Unified CourseThumbnail component
 * - When thumbnailUrl is provided: renders directly (for pre-fetched data from homepage-data)
 * - When courseId is provided with lazy=true: uses IntersectionObserver + query
 * - Skips base64 data URLs for performance
 */
export const CourseThumbnail = forwardRef<HTMLDivElement, CourseThumbnailProps>(({
  courseId,
  thumbnailUrl,
  alt,
  className,
  lazy = false,
}, ref) => {
  const [isVisible, setIsVisible] = useState(!lazy);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mergedRef = (node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!lazy || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isVisible]);

  // Only query when courseId is provided and no direct thumbnailUrl
  const { data: fetchedUrl } = useCourseThumbnail({
    courseId: courseId || "",
    enabled: isVisible && !!courseId && !thumbnailUrl,
  });

  // Determine final URL: direct prop > fetched > null
  const rawUrl = thumbnailUrl || fetchedUrl;
  
  // Skip base64 data URLs for performance, then rewrite to proxy
  const validUrl = rawUrl && !rawUrl.startsWith("data:") ? rewriteStorageUrl(rawUrl) : null;

  // Gradient placeholder
  const gradientPlaceholder = (
    <div
      className={cn(
        "absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20",
        className
      )}
    />
  );

  // No valid URL or error - show gradient
  if (!validUrl || imageError) {
    return (
      <div
      ref={mergedRef}
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20",
        className
      )}
    />
  );
  }

  return (
    <div
      ref={mergedRef}
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20",
        className
      )}
    >
      {/* Gradient placeholder - fades out when image loads */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/20 to-accent/30 transition-opacity duration-500",
          imageLoaded ? "opacity-0" : "opacity-100"
        )}
      />

      {/* Loading shimmer */}
      {isVisible && !imageLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      )}

      {/* Actual image */}
      {isVisible && (
        <img
          src={validUrl}
          alt={alt}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
});
CourseThumbnail.displayName = "CourseThumbnail";

// Re-export for backwards compatibility with existing LazyCourseThumbnail imports
export const LazyCourseThumbnail = forwardRef<HTMLDivElement, Omit<CourseThumbnailProps, "lazy" | "thumbnailUrl">>((props, ref) => (
  <CourseThumbnail {...props} ref={ref} lazy={true} />
));
LazyCourseThumbnail.displayName = "LazyCourseThumbnail";
