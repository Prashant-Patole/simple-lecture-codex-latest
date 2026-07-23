export type SourceKey = 'Instagram' | 'Facebook' | 'Google' | 'YouTube' | 'Direct' | 'Testing' | 'Other';

export function classifySource(referrer: string | null): { source: SourceKey; domain: string } {
  if (!referrer) return { source: 'Direct', domain: '' };
  const r = referrer.toLowerCase();
  if (r === 'testing' || r.includes('lovable.app') || r.includes('lovable.dev') || r.includes('lovableproject.com') || r.includes('localhost')) {
    return { source: 'Testing', domain: 'testing' };
  }
  if (r.includes('instagram.com') || r.includes('l.instagram.com')) return { source: 'Instagram', domain: 'instagram.com' };
  if (r.includes('facebook.com') || r.includes('fb.com') || r.includes('l.facebook.com') || r.includes('fb.me') || r.includes('m.facebook.com')) {
    return { source: 'Facebook', domain: 'facebook.com' };
  }
  if (r.includes('youtube.com') || r.includes('youtu.be')) return { source: 'YouTube', domain: 'youtube.com' };
  if (r.includes('google.')) return { source: 'Google', domain: 'google' };
  let domain = referrer;
  try { domain = new URL(referrer).hostname; } catch { /* keep raw */ }
  return { source: 'Other', domain };
}
