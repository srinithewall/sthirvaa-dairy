'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Lock, User, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err.response?.data?.message || 'Invalid username/email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F1] flex items-center justify-center p-4">
      <div className="w-full max-w-[370px] bg-white rounded-[24px] overflow-hidden shadow-2xl border border-brand/5 animate-in fade-in zoom-in duration-500">
        <div className="bg-brand-dark px-6 py-6 text-center text-white relative overflow-hidden flex flex-col items-center justify-center">
          {/* Decorative background circle */}
          <div className="absolute top-[-35px] left-[-35px] w-24 h-24 bg-white/5 rounded-full" />
          <div className="absolute bottom-[-15px] right-[-15px] w-16 h-16 bg-white/5 rounded-full" />
          
          {/* Premium CSS/SVG Emblem */}
          <div className="relative w-11 h-11 flex items-center justify-center mb-2.5">
            <div className="absolute inset-0 rounded-full border border-accent/80 shadow-[0_0_10px_rgba(247,183,49,0.3)]"></div>
            <div className="absolute inset-[3px] rounded-full border border-accent/40 border-dashed animate-[spin_60s_linear_infinite]"></div>
            <div className="bg-gradient-to-br from-accent to-accent-dark text-brand-dark p-2 rounded-full shadow-inner z-10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
                <path d="M2 22 12 12"/>
              </svg>
            </div>
          </div>

          <h1 className="text-[17px] font-bold tracking-[0.12em] uppercase font-serif leading-none">
            Sthirvaa
          </h1>
          <span className="text-accent text-[9px] font-bold tracking-[0.25em] uppercase mt-1 leading-none">Farms</span>
          <div className="text-[8px] text-white/60 mt-1.5 font-bold uppercase tracking-[0.15em] leading-none">Pure Quality, Naturally Grown</div>
        </div>

        <form onSubmit={handleLogin} className="p-6 sm:p-7">
          <h2 className="text-md font-bold text-text mb-4">Welcome Back</h2>
          
          {error && (
            <div className="bg-red-50 text-danger p-3.5 rounded-xl mb-4 flex items-start gap-2.5 border border-red-100 text-[12px] leading-snug">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-text3 uppercase tracking-widest mb-1.5 px-1">Username or Email</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text3" size={16} />
                <input 
                  type="text" 
                  name="email"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your username or email"
                  className="w-full bg-[#F5F9F6] border-none outline-none focus:ring-2 focus:ring-brand/20 py-3 pl-11 pr-4 rounded-xl text-text text-sm font-semibold transition-all placeholder:text-text3/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text3 uppercase tracking-widest mb-1.5 px-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text3" size={16} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F5F9F6] border-none outline-none focus:ring-2 focus:ring-brand/20 py-3 pl-11 pr-11 rounded-xl text-text text-sm font-semibold transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text3 hover:text-brand transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white text-[11px] font-black uppercase tracking-widest py-3.5 rounded-xl mt-6 shadow-md shadow-brand/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              'LOGIN TO SYSTEM'
            )}
          </button>

          <div className="text-center mt-4">
            <a href="#" className="text-[11px] text-brand font-bold hover:underline">Forgot your password?</a>
          </div>
        </form>
      </div>
    </div>
  );
}
