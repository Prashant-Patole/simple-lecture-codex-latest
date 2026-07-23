import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const useVisitorTracking = () => {
  const location = useLocation();
  const lastTrackedPath = useRef('');

  useEffect(() => {
    const path = location.pathname;
    // Don't double-track same path
    if (path === lastTrackedPath.current) return;
    // Skip admin pages from tracking
    if (path.startsWith('/admin')) return;

    lastTrackedPath.current = path;

    const trackVisit = async () => {
      try {
        // Get IP + geo info from free API
        let visitorIp = null;
        let country = null;
        let city = null;
        try {
          const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const geo = await res.json();
            visitorIp = geo.ip;
            country = geo.country_name;
            city = geo.city;
          }
        } catch {
          // Geo lookup failed, continue without it
        }

        const { data: { user } } = await supabase.auth.getUser();

        await (supabase as any).from('page_visits').insert({
          visitor_ip: visitorIp,
          page_path: path,
          user_agent: navigator.userAgent,
          referrer: document.referrer && (document.referrer.includes('lovable.app') || document.referrer.includes('lovable.dev') || document.referrer.includes('lovableproject.com')) ? 'testing' : (document.referrer || null),
          user_id: user?.id || null,
          country,
          city,
        });
      } catch {
        // Silent fail - tracking should never break the app
      }
    };

    trackVisit();
  }, [location.pathname]);
};
