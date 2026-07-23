/**
 * Pricing utilities for course display
 */

interface CourseWithPricing {
  price_inr?: number;
  ai_tutoring_enabled?: boolean;
  ai_tutoring_price?: number;
  live_classes_enabled?: boolean;
  live_classes_price?: number;
}

/**
 * Calculate the display price for a course based on enabled features
 * If AI tutoring or live classes are enabled, they become the base price
 * Otherwise, show the standard course price
 */
export function getDisplayPrice(course: CourseWithPricing): {
  price: number;
  originalPrice?: number;
  priceLabel: string;
} {
  const basePrice = course.price_inr || 0;
  
  // If both premium features are enabled, show combined price
  if (course.ai_tutoring_enabled && course.live_classes_enabled) {
    const aiPrice = course.ai_tutoring_price || 0;
    const livePrice = course.live_classes_price || 0;
    return {
      price: aiPrice + livePrice,
      originalPrice: basePrice,
      priceLabel: "AI Tutoring + Live Classes",
    };
  }
  
  // If only AI tutoring is enabled
  if (course.ai_tutoring_enabled) {
    return {
      price: course.ai_tutoring_price || basePrice,
      originalPrice: basePrice,
      priceLabel: "with AI Tutoring",
    };
  }
  
  // If only live classes are enabled
  if (course.live_classes_enabled) {
    return {
      price: course.live_classes_price || basePrice,
      originalPrice: basePrice,
      priceLabel: "with Live Classes",
    };
  }
  
  // Neither premium feature enabled, show base price
  return {
    price: basePrice,
    priceLabel: "Base Course",
  };
}

/**
 * Format INR currency
 */
export function formatPriceINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(originalPrice: number, currentPrice: number): number {
  if (originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}
