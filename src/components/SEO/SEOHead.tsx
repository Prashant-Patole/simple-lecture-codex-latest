import { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { DEFAULT_OG_IMAGE } from '@/lib/seo/constants';

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  canonicalUrl?: string;
  structuredData?: object | object[];
  preloadImage?: string;
}

/**
 * Inject JSON-LD post-paint via a side effect so the synchronous render
 * doesn't stringify large schemas during commit. Googlebot executes JS and
 * still discovers these scripts, so SEO output is identical.
 */
const useJsonLdInjection = (data: object | object[] | undefined, id: string) => {
  const serialized = useMemo(() => (data ? JSON.stringify(data) : ''), [data]);

  useEffect(() => {
    if (!serialized || typeof document === 'undefined') return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-id', id);
    script.text = serialized;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [serialized, id]);
};

export const SEOHead = ({
  title,
  description,
  keywords,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  canonicalUrl,
  structuredData,
  preloadImage,
}: SEOHeadProps) => {
  const fullTitle = /SimpleLecture\s*$/.test(title) ? title : `${title} | SimpleLecture`;
  const currentUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');

  useJsonLdInjection(structuredData, 'page');

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* LCP image preload */}
      {preloadImage && <link rel="preload" as="image" href={preloadImage} {...({ fetchpriority: 'high' } as any)} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};
