import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

export const useRegisterPushToken = () => {
  const registerToken = useCallback(async (token: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No user logged in, cannot register push token');
      return;
    }

    const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

    try {
      // Upsert the token (insert or update if exists)
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert(
          {
            user_id: user.id,
            token,
            platform,
            device_info: {
              userAgent: navigator.userAgent,
              registeredAt: new Date().toISOString(),
            },
            is_active: true,
          },
          {
            onConflict: 'user_id,token',
          }
        );

      if (error) {
        console.error('Error saving push token:', error);
      } else {
        console.log('Push token registered successfully');
      }
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  }, []);

  const deactivateToken = useCallback(async (token: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase
        .from('push_notification_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('token', token);
    } catch (error) {
      console.error('Error deactivating push token:', error);
    }
  }, []);

  return { registerToken, deactivateToken };
};
