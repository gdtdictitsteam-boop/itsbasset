import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertTriangle, KeyRound, CheckCircle2, Database, Info, RefreshCw, UserCheck, Building2 } from 'lucide-react';

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

export function LoginView() {
  const { signIn, signInDemo, isConfigured } = useAuth();
  const { t, language } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // States for UX and Security
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Check Rate-Limiting Lockout
    if (lockoutTimer > 0) {
      setErrorMessage(`ប្រព័ន្ធបានចាក់សោជាបណ្តោះអាសន្ន! សូមរង់ចាំ ${lockoutTimer} វិនាទីទៀត (Too many attempts)`);
      return;
    }

    // 2. Input Sanitization
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = password.trim();

    // 3. Validation Rules
    if (!sanitizedEmail) {
      setErrorMessage('សូមបញ្ចូលអាសយដ្ឋាន អ៊ីមែល (Email address)');
      return;
    }

    if (!isValidEmail(sanitizedEmail)) {
      setErrorMessage('ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ! (ឧ. admin.its@tax.gov.kh)');
      return;
    }

    if (!sanitizedPassword) {
      setErrorMessage('សូមបញ្ចូលពាក្យសម្ងាត់ (Password)');
      return;
    }

    if (sanitizedPassword.length < 6) {
      setErrorMessage('ពាក្យសម្ងាត់ត្រូវតែមានយ៉ាងហោចណាស់ ៦ តួអក្សរ (Minimum 6 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      // 4. Submit to Supabase Authentication
      const result = await signIn(sanitizedEmail, sanitizedPassword);

      if (result.success) {
        setSuccessMessage('ការចូលប្រព័ន្ធជោគជ័យ! កំពុងផ្លាស់ប្តូរទៅកាន់ទំព័រដើម...');
        setFailedAttempts(0);
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          setLockoutTimer(30); // 30 seconds lockout
          setErrorMessage('ពាក្យសម្ងាត់ខុសច្រើនដងពេក! ប្រព័ន្ធត្រូវបានចាក់សោសុវត្ថិភាព ៣០ វិនាទី។');
        } else {
          setErrorMessage(
            result.error || `អ៊ីមែល ឬ ពាក្យសម្ងាត់មិនត្រឹមត្រូវ! (ព្យាយាមបរាជ័យ ${nextAttempts}/5 ដង)`
          );
        }
      }
    } catch (err: any) {
      setErrorMessage('មានបញ្ហាតភ្ជាប់ទៅកាន់ប្រព័ន្ធ! សូមព្យាយាមម្តងទៀត។');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = (emailVal: string, roleVal: string) => {
    setErrorMessage(null);
    setSuccessMessage(`ចូលប្រើប្រាស់ជាប្រភេទ ${roleVal} ជោគជ័យ!`);
    setTimeout(() => {
      signInDemo(emailVal, roleVal);
    }, 400);
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
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
            isConfigured 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}>
            <Database size={16} className={`shrink-0 mt-0.5 ${isConfigured ? 'text-emerald-700' : 'text-amber-700'}`} />
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span>Supabase DB:</span>
                <span className={`px-2 py-0.2 rounded text-[10px] uppercase font-extrabold ${
                  isConfigured ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                }`}>
                  {isConfigured ? 'បានតភ្ជាប់' : 'Demo Auth Mode'}
                </span>
              </div>
              <p className="opacity-80 mt-0.5 text-[11px]">
                {isConfigured 
                  ? 'ប្រព័ន្ធត្រូវបានតភ្ជាប់ជាមួយ Supabase Authentication' 
                  : 'ពុំទាន់មាន .env key - អាចជ្រើសរើស Quick Demo Role ខាងក្រោមដើម្បីសាកល្បង RBAC'}
              </p>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle size={18} className="shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && (
            <div className="bg-teal-50 border border-teal-200 text-teal-800 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 size={18} className="shrink-0 text-teal-600" />
              <div>{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
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
                  disabled={lockoutTimer > 0 || isSubmitting}
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
                  disabled={lockoutTimer > 0 || isSubmitting}
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
            <button
              type="submit"
              disabled={isSubmitting || lockoutTimer > 0}
              className="w-full py-3 bg-[#03291E] hover:bg-[#1E6047] text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
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
          </form>

          {/* Quick Demo Login Option for Testing RBAC Roles */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-center mb-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-white px-2">
                ជ្រើសរើស Role សាកល្បង (Test RBAC Access)
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin.its@tax.gov.kh', 'CentralAdmin')}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left text-xs font-bold text-emerald-900 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-extrabold text-[#03291E] flex items-center gap-1">
                    <UserCheck size={12} className="text-emerald-700" />
                    <span>CentralAdmin</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono">គ្រប់គ្រងស្តុកកណ្តាលទាំងអស់</div>
                </div>
                <Info size={14} className="text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('branch.user@tax.gov.kh', 'BranchUser')}
                className="p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-left text-xs font-bold text-amber-950 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-extrabold text-amber-900 flex items-center gap-1">
                    <Building2 size={12} className="text-amber-700" />
                    <span>BranchUser</span>
                  </div>
                  <div className="text-[10px] text-amber-800 font-mono">កម្រិតមើលឃើញតែស្តុកសាខា</div>
                </div>
                <Info size={14} className="text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
              </button>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="bg-slate-50 p-3 text-center border-t border-slate-100 text-[10px] font-bold text-slate-500">
          🔒 Encrypted Auth Connection • General Department of Taxation
        </div>

      </div>
    </div>
  );
}
