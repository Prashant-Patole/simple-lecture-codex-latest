// Structured Data (JSON-LD) generators for SEO

export const generateOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "SimpleLecture",
  "description": "India's first AI-powered learning platform for board exams, entrance tests, and skill development",
  "url": "https://simplelecture.com",
  "logo": "https://simplelecture.com/logo.png",
  "foundingDate": "2024",
  "areaServed": "IN",
  "telephone": "+917353021234",
  "email": "contact@simplelecture.com",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Koramangala, Bangalore",
    "addressRegion": "Karnataka",
    "addressCountry": "IN"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "bestRating": "5",
    "ratingCount": "50000"
  },
  "sameAs": [],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Service",
    "availableLanguage": ["English", "Hindi", "Kannada"]
  }
});

export const generateCourseSchema = (course: {
  name: string;
  description: string;
  provider?: string;
  price?: number;
  originalPrice?: number;
  rating?: number;
  studentCount?: number;
  duration?: number;
  subjects?: string[];
}) => ({
  "@context": "https://schema.org",
  "@type": "Course",
  "name": course.name,
  "description": course.description,
  "provider": {
    "@type": "Organization",
    "name": course.provider || "SimpleLecture",
    "sameAs": "https://simplelecture.com"
  },
  "inLanguage": "en",
  "isAccessibleForFree": !course.price || course.price === 0,
  ...(course.rating && course.studentCount && {
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": course.rating,
      "bestRating": 5,
      "ratingCount": course.studentCount
    }
  }),
  ...(course.duration && {
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "duration": `P${course.duration}M`
    }
  }),
  ...(course.subjects && course.subjects.length > 0 && {
    "syllabusSections": course.subjects.map(s => ({
      "@type": "Syllabus",
      "name": s
    }))
  }),
  ...(course.price && {
    "offers": {
      "@type": "Offer",
      "price": course.price,
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      ...(course.originalPrice && course.originalPrice > course.price && {
        "priceValidUntil": new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      })
    }
  })
});

export const generateBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

export const generateWebsiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "SimpleLecture",
  "url": "https://simplelecture.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://simplelecture.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
});

export const generateHomepageFAQSchema = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What subjects does SimpleLecture cover?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "SimpleLecture covers all major subjects for SSLC 10th board exams including Maths, Science, Social Studies, English, Kannada, and Hindi. We also offer courses for PUC, NEET, JEE, Pharmacy (D.Pharm/B.Pharm), and Nursing (GNM/B.Sc Nursing) preparation."
      }
    },
    {
      "@type": "Question",
      "name": "How much does SimpleLecture cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our AI-powered courses start at just ₹1000 + GST per course for 1-year access — far less than traditional coaching centres. Live classes and language add-ons are available at affordable top-up prices."
      }
    },
    {
      "@type": "Question",
      "name": "Is SimpleLecture available in Kannada and Hindi?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! Our AI tutors can explain concepts and clear doubts in Kannada, Hindi, and English. Video lessons are primarily in English with multilingual AI support available 24/7."
      }
    },
    {
      "@type": "Question",
      "name": "How does the AI tutor work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our AI tutor uses adaptive learning technology to understand your strengths and weaknesses. It provides personalised explanations, generates targeted practice questions, and clears doubts instantly — available around the clock."
      }
    },
    {
      "@type": "Question",
      "name": "Can SimpleLecture help me score 90+ in board exams?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolutely. Our mastery-based approach ensures you don't move ahead until you've truly understood each concept. With unlimited practice, AI doubt clearing, and board-pattern mock tests, thousands of students have scored 90+ using SimpleLecture."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a free trial?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, you can explore free sample lessons and try our AI tutor before purchasing. Sign up for a free account to get started — no credit card required."
      }
    },
    {
      "@type": "Question",
      "name": "How is SimpleLecture different from YouTube or free resources?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Unlike passive video watching, SimpleLecture actively adapts to your learning gaps. Our AI identifies weak topics, generates personalised tests, and provides step-by-step solutions — something no free resource can offer."
      }
    },
    {
      "@type": "Question",
      "name": "Do I get a certificate after completing a course?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, you receive a digital certificate of completion for each course. Certificates can be downloaded and shared, and they reflect your mastery level and exam readiness."
      }
    },
    {
      "@type": "Question",
      "name": "Does SimpleLecture offer Pharmacy and Nursing entrance preparation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! We offer comprehensive preparation for Pharmacy (D.Pharm & B.Pharm) and Nursing (GNM & B.Sc Nursing) entrance exams with AI-powered doubt clearing, chapter-wise lessons, and practice tests tailored to these streams."
      }
    }
  ]
});

export const generateFAQSchema = (faqs: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
});

export const generateCollectionPageSchema = (
  collectionName: string,
  collectionUrl: string,
  description: string,
  items: { name: string; url: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": collectionName,
  "url": collectionUrl,
  "description": description,
  "isPartOf": {
    "@type": "WebSite",
    "name": "SimpleLecture",
    "url": "https://simplelecture.com"
  },
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": items.length,
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "url": item.url
    }))
  }
});
