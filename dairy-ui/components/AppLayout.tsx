'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import api from '@/lib/api';
import ChoreBanner from './ChoreBanner';

const BUSINESS_PATHS = ['/store', '/inventory', '/ledger', '/sales'];

export default function AppLayout({ children, headerAction, noPadding }: { children: React.ReactNode, headerAction?: React.ReactNode, noPadding?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  // Farm chore reminders aren't shown on the Business screens (shop, inventory, ledger, sales).
  const isBusinessScreen = BUSINESS_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Initialize Capacitor Push Notifications for Native Devices
    const initPush = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive === 'granted') {
            // Listeners must be attached BEFORE register(): the token event can fire as soon as
            // register() resolves, and a listener added afterwards misses it - the token then never
            // reaches the backend and that user silently gets no reminders.
            PushNotifications.addListener('registration', (tokenData: { value: string }) => {
              console.log('Push registration success, token: ' + tokenData.value);
              api.post('/users/me/fcm-token', { token: tokenData.value })
                .catch(err => console.error('Failed to register FCM token with backend', err));
            });

            PushNotifications.addListener('registrationError', (error: any) => {
              console.error('Error on registration: ', error);
            });

            // A push that arrives while the app is open shows no OS notification, so nudge the
            // in-app banner to refresh instead of leaving the user unaware.
            PushNotifications.addListener('pushNotificationReceived', () => {
              window.dispatchEvent(new Event('chore-push'));
            });

            // Tapping a reminder should land on the screen that clears it.
            PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
              const route = action?.notification?.data?.route;
              if (typeof route === 'string' && route.startsWith('/')) {
                router.push(route);
              }
            });

            await PushNotifications.register();
          }
        }
      } catch (err) {
        console.error('Failed to initialize push notifications', err);
      }
    };

    initPush();
  }, [router]);

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} headerAction={headerAction} />
      {!isBusinessScreen && <ChoreBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className={`flex-1 overflow-y-auto bg-[#F0F4F1] ${noPadding ? '' : 'p-4 md:p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
