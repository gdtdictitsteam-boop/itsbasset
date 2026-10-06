/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { LocationProvider } from './contexts/LocationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { UserManagementModal } from './components/UserManagementModal';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { StockInView } from './views/StockInView';
import { StockOutView } from './views/StockOutView';
import { HandoverView } from './views/HandoverView';
import { AuditTrailView } from './views/AuditTrailView';
import { SqlCodeView } from './views/SqlCodeView';
import { NewItemView } from './views/NewItemView';
import { AdjustmentView } from './views/AdjustmentView';
import { useLanguage } from './contexts/LanguageContext';

function MainLayout() {
  const [currentView, setCurrentView] = useState('dashboard');
  const { t } = useLanguage();
  const { isBranchUser, isCentralAdmin } = useAuth();

  // Enforce view restriction for BranchUser:
  // BranchUser is allowed: "dashboard", "inventory", "stockOut", "adjustment", "auditTrail"
  useEffect(() => {
    if (isBranchUser && !['dashboard', 'inventory', 'stockOut', 'adjustment', 'auditTrail'].includes(currentView)) {
      setCurrentView('dashboard');
    }
  }, [isBranchUser, currentView]);

  const renderView = () => {
    // If BranchUser, allow the 5 permitted views (dashboard & inventory locked to assigned branch)
    if (isBranchUser) {
      switch (currentView) {
        case 'dashboard':
          return <DashboardView />;
        case 'inventory':
          return <InventoryView />;
        case 'stockOut':
          return <StockOutView />;
        case 'adjustment':
          return <AdjustmentView />;
        case 'auditTrail':
          return <AuditTrailView />;
        default:
          return <DashboardView />;
      }
    }

    // Full access for CentralAdmin
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'inventory':
        return <InventoryView />;
      case 'stockIn':
        return (
          <ProtectedRoute allowedRoles={['CentralAdmin', 'Admin-GDT']}>
            <StockInView onNavigate={(view) => setCurrentView(view)} />
          </ProtectedRoute>
        );
      case 'handover':
        return <HandoverView />;
      case 'newSku':
        return (
          <ProtectedRoute allowedRoles={['CentralAdmin', 'Admin-GDT']}>
            <NewItemView />
          </ProtectedRoute>
        );
      case 'stockOut':
        return <StockOutView />;
      case 'adjustment':
        return <AdjustmentView />;
      case 'auditTrail':
        return <AuditTrailView />;
      case 'sql':
        return <SqlCodeView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#EBF4F0] text-[#0B3C2D] overflow-hidden font-siemreap">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 -ml-5 mr-0 -mt-[11px] bg-[#F4F7F6]">
          {renderView()}
        </main>
      </div>

      {/* User Management & RBAC Modal for CentralAdmin */}
      <UserManagementModal />

      <footer className="bg-[#D2EADF] border-t border-[#B8DEC8] py-2.5 px-6 flex justify-between items-center text-[11px] font-semibold text-[#124D3A] shrink-0">
        <div className="flex items-center space-x-4">
          <span>Version 2.4.0-stable</span>
          <span className="text-[#8BCAAD]">|</span>
          <span>Support: it-support@tax.gov.kh</span>
        </div>
        <div>
          {t.copyright}
        </div>
      </footer>
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <LocationProvider>
          <InventoryProvider>
            <AuthenticatedApp />
          </InventoryProvider>
        </LocationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
