import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Callback to handle token registration
let onTokenReceived: ((token: string) => void) | null = null;

export function setTokenCallback(callback: (token: string) => void) {
  onTokenReceived = callback;
}

export async function registerPushNotifications() {
  // Only available on mobile platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications only available on native platforms');
    return;
  }

  try {
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      await PushNotifications.register();
      
      // Listen for registration success
      await PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        
        // Call the callback if set
        if (onTokenReceived) {
          onTokenReceived(token.value);
        }
        
        // Also save directly to database
        await saveTokenToDatabase(token.value);
      });

      // Listen for registration errors
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      // Listen for push notifications received
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received: ', notification);
      });

      // Listen for push notification actions
      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed', notification);
        
        // Handle navigation based on notification data
        const data = notification.notification.data;
        if (data?.route) {
          window.location.href = data.route;
        }
      });
    }
  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }
}

async function saveTokenToDatabase(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No user logged in, cannot save push token');
    return;
  }

  const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

  try {
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
      console.log('Push token saved to database');
    }
  } catch (error) {
    console.error('Error saving push token to database:', error);
  }
}

// Request notification permission for web
export async function requestWebNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show a local notification (for web)
export function showLocalNotification(title: string, body: string, data?: Record<string, string>) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    data,
  });

  notification.onclick = () => {
    if (data?.route) {
      window.location.href = data.route;
    }
    notification.close();
  };
}
