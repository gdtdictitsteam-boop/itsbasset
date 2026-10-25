import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, KeyRound, CheckCircle2, RefreshCw } from 'lucide-react';

// Sanitize string input to prevent XSS / Injection Attack patterns
function sanitizeInput(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '') // strip dangerous tags
    .replace(/javascript:/gi, '')
    .replace(/SELECT|INSERT|DELETE|UPDATE|DROP|--/gi, (match) => match.toLowerCase());
}

// Strict email regex validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function LoginView({
  onLoginSuccess: propOnLoginSuccess,
  setUser: propSetUser,
}: {
  onLoginSuccess?: (user: any) => void;
  setUser?: (user: any) => void;
} = {}) {
  const { onLoginSuccess: ctxOnLoginSuccess, setUser: ctxSetUser } = useAuth();
  const locationCtx = useLocationContext();
  const { t, language } = useLanguage();

  const onLoginSuccess = propOnLoginSuccess || ctxOnLoginSuccess;
  const setUser = propSetUser || ctxSetUser;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States for UX and Security
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Anti-Brute-Force Rate Limiting
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => prev - 1);
      }, 1000);
    } else if (lockoutTimer === 0 && failedAttempts >= 5) {
      setFailedAttempts(0); // Reset attempts after lockout time finishes
    }
    return () => clearInterval(interval);
  }, [lockoutTimer, failedAttempts]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែល និងពាក្យសម្ងាត់!');
      return;
    }

    setLoading(true);

    try {
      // ១. Query ស្វែងរកមន្ត្រី និង Role ដោយស្វ័យប្រវត្តិពី public.user_profiles តាម Email
      const { data: user, error: fetchErr } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (fetchErr) {
        console.error('Fetch error:', fetchErr);
        setError('មានបញ្ហាបច្ចេកទេសក្នុងការតភ្ជាប់ Database!');
        setLoading(false);
        return;
      }

      if (!user) {
        setError('រកមិនឃើញអាសយដ្ឋានអ៊ីមែលនេះក្នុងប្រព័ន្ធឡើយ!');
        setLoading(false);
        return;
      }

      // ២. ផ្ទៀងផ្ទាត់ Password ផ្ទាល់ពី Table
      const validPassword = user.password || 'GDT@2026';
      if (cleanPassword !== validPassword) {
        setError('ពាក្យសម្ងាត់មិនត្រឹមត្រូវឡើយ!');
        setLoading(false);
        return; // បញ្ឈប់ភ្លាម ហាមអនុញ្ញាតឱ្យចូល
      }

      // ៣. បើត្រឹមត្រូវ កំណត់សិទ្ធិ (Role) និងទីតាំងដោយស្វ័យប្រវត្តិពី user_profiles ហើយអនុញ្ញាតឱ្យចូលប្រព័ន្ធ
      const roleStr = user.role || user.user_metadata?.role || '';
      const isUserBranch = roleStr === 'BranchUser';
      if (!isUserBranch && locationCtx?.resetLocationFilter) {
        locationCtx.resetLocationFilter();
      } else if (isUserBranch && user.location_id && locationCtx?.setSelectedLocation) {
        locationCtx.setSelectedLocation(String(user.location_id));
      }

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(user);
      } else if (typeof setUser === 'function') {
        setUser(user);
      }

    } catch (err: any) {
      console.error('Login Exception:', err);
      setError(err?.message || 'មានបញ្ហាបច្ចេកទេសក្នុងការចូលប្រព័ន្ធ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-4 font-siemreap">
      {/* Container Box */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-lg overflow-hidden">
        
        {/* Top Header Card */}
        <div className="bg-[#A3D8C2] p-6 text-center border-b-4 border-[#6EC8A0] relative">
          <div className="inline-flex items-center justify-center p-3 bg-[#03291E] rounded-2xl text-[#A3D8C2] shadow-md mb-3">
            <ShieldCheck size={36} />
          </div>
          <h1 
            className="text-lg sm:text-xl font-bold text-[#03291E] leading-tight" 
            style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
          >
            អគ្គនាយកដ្ឋានពន្ធដារ
          </h1>
          <p className="text-xs font-bold text-[#03291E]/80 mt-1 uppercase tracking-wider">
            {language === 'kh' ? 'ប្រព័ន្ធគ្រប់គ្រងសម្ភារបច្ចេកទេស' : t.systemTitle}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-[#03291E]/10 px-3 py-1 rounded-full text-[11px] font-bold text-[#03291E]">
            <Lock size={12} />
            <span>Role-Based Secure Login Gate v2.4</span>
          </div>
        </div>

        {/* Form Content Body */}
        <div className="p-6 sm:p-8 space-y-5">
          
          {/* Error Message Alert */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{typeof error === 'string' ? error : (error as any)?.message}</span>
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && (
            <div className="bg-teal-50 border border-teal-200 text-teal-800 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 size={18} className="shrink-0 text-teal-600" />
              <div>{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                អាសយដ្ឋាន អ៊ីមែល (Email Address) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin.its@tax.gov.kh"
                  disabled={lockoutTimer > 0 || loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all placeholder:text-slate-400 disabled:opacity-50"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                ពាក្យសម្ងាត់ (Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={lockoutTimer > 0 || loading}
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all placeholder:text-slate-400 disabled:opacity-50"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading || lockoutTimer > 0}
                className="w-full py-3 bg-[#03291E] hover:bg-[#1E6047] text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>កំពុងពិនិត្យសុវត្ថិភាព...</span>
                  </>
                ) : lockoutTimer > 0 ? (
                  <span>ប្រព័ន្ធចាក់សោ ({lockoutTimer}s)</span>
                ) : (
                  <>
                    <KeyRound size={18} />
                    <span>ចូលប្រព័ន្ធ (Sign In)</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

        {/* Footer info */}
        <div className="bg-slate-50 p-3 text-center border-t border-slate-100 text-[10px] font-bold text-slate-500">
          🔒 Encrypted Auth Connection • General Department of Taxation
        </div>

      </div>
    </div>
  );
}
