'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', {
        username: email,
        password: password
      });

      const { token, username, role, staffId, customerId } = response.data;

      // Store in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ username, role, staffId, customerId }));

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F1] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border border-brand/5 animate-in fade-in zoom-in duration-500">
        <div className="bg-brand-dark p-10 text-center text-white relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute bottom-[-30px] right-[-30px] w-24 h-24 bg-white/5 rounded-full" />
          
          <div className="text-5xl mb-4 animate-bounce">🌿</div>
          <h1 className="text-3xl font-black tracking-tight">Sthirvaa <span className="text-accent">Farms</span></h1>
          <div className="text-[12px] text-white/80 mt-2 font-bold uppercase tracking-[0.2em]">Pure Quality, Naturally Grown</div>
        </div>

        <form onSubmit={handleLogin} className="p-8 md:p-10">
          <h2 className="text-xl font-bold text-text mb-6">Welcome Back</h2>
          
          {error && (
            <div className="bg-red-50 text-danger p-4 rounded-xl mb-6 flex items-start gap-3 border border-red-100 text-[13px]">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-text3 uppercase tracking-widest mb-2 px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text3" size={18} />
                <input 
                  type="email" 
                  name="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sthirvaa.com"
                  className="w-full bg-[#F5F9F6] border-none outline-none focus:ring-2 focus:ring-brand/20 py-4 pl-12 pr-4 rounded-2xl text-text font-medium transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text3 uppercase tracking-widest mb-2 px-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text3" size={18} />
                <input 
                  type="password" 
                  name="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F5F9F6] border-none outline-none focus:ring-2 focus:ring-brand/20 py-4 pl-12 pr-4 rounded-2xl text-text font-medium transition-all"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-black py-4 rounded-2xl mt-8 shadow-lg shadow-brand/10 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              'LOGIN TO SYSTEM'
            )}
          </button>

          <div className="text-center mt-6">
            <a href="#" className="text-[12px] text-brand font-bold hover:underline">Forgot your password?</a>
          </div>
        </form>
      </div>
    </div>
  );
}
