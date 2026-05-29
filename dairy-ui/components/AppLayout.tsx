'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import api from '@/lib/api';

export default function AppLayout({ children, headerAction }: { children: React.ReactNode, headerAction?: React.ReactNode }) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

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
            await PushNotifications.register();
            
            PushNotifications.addListener('registration', (tokenData: { value: string }) => {
              console.log('Push registration success, token: ' + tokenData.value);
              api.post('/users/me/fcm-token', { token: tokenData.value })
                .catch(err => console.error('Failed to register FCM token with backend', err));
            });

            PushNotifications.addListener('registrationError', (error: any) => {
              console.error('Error on registration: ', error);
            });
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
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F0F4F1]">
          {children}
        </main>
      </div>
    </div>
  );
}
