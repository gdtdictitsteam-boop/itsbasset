import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginView } from '../views/LoginView';
import { ShieldAlert, RefreshCw, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Optional array of roles permitted to access this view e.g., ['CentralAdmin', 'Admin-GDT']
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();

  // 1. Loading State during authentication verification
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-4 font-siemreap">
        <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-md text-center max-w-sm w-full space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-[#03291E] rounded-2xl text-[#A3D8C2] shadow-sm animate-pulse">
            <Lock size={32} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#03291E]">កំពុងផ្ទៀងផ្ទាត់សិទ្ធិប្រព័ន្ធ...</h2>
            <p className="text-xs text-slate-500 mt-1">Verifying Auth Session & Security Credentials</p>
          </div>
          <div className="flex items-center justify-center text-teal-700 pt-2">
            <RefreshCw size={22} className="animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated User - Redirect to Login
  if (!user) {
    return <LoginView />;
  }

  // 3. Role-Based Access Control (RBAC Check)
  if (allowedRoles && allowedRoles.length > 0) {
    // Check if user's role matches any allowed role (case-insensitive & normalize CentralAdmin / Admin-GDT)
    const normalizedUserRole = userRole.toLowerCase();
    const isAllowed = allowedRoles.some((role) => {
      const norm = role.toLowerCase();
      if (norm === 'centraladmin' && (normalizedUserRole === 'admin-gdt' || normalizedUserRole === 'centraladmin')) {
        return true;
      }
      return norm === normalizedUserRole;
    });

    if (!isAllowed) {
      return (
        <div className="bg-white rounded-2xl border border-rose-200/80 shadow-xs p-8 md:p-12 text-center max-w-2xl mx-auto my-8">
          <div className="inline-flex items-center justify-center p-4 bg-rose-100 text-rose-700 rounded-2xl mb-4">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-xl font-bold text-rose-950 mb-2">
            គ្មានសិទ្ធិចូលប្រើប្រាស់ទំព័រនេះទេ (Access Denied)
          </h2>
          <p className="text-xs md:text-sm text-slate-600 mb-6 leading-relaxed">
            គណនីរបស់អ្នកជាប្រភេទ <span className="font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">{userRole}</span>។ ទំព័រនេះត្រូវបានកម្រិតសម្រាប់តែអ្នកប្រើប្រាស់ដែលមានសិទ្ធិ <span className="font-bold text-slate-800">{allowedRoles.join(' ឬ ')}</span> ប៉ុណ្ណោះ។
          </p>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-600 mb-6">
            <div className="font-bold text-slate-800 mb-1">SECURITY LOG:</div>
            <div>• Attempted View: Protected Module</div>
            <div>• Current User Role: {userRole}</div>
            <div>• Required Access Role: {allowedRoles.join(', ')}</div>
          </div>
        </div>
      );
    }
  }

  // 4. Access Granted
  return <>{children}</>;
}
