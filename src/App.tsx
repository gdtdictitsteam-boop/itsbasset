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
import { NewItemView } from './views/NewItemView';
import { AdjustmentView } from './views/AdjustmentView';
import { ExecutiveReportView } from './views/ExecutiveReportView';
import { useLanguage } from './contexts/LanguageContext';

function MainLayout() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const { isBranchUser, isCentralAdmin } = useAuth();

  // Enforce view restriction for BranchUser and block removed 'sql' view for all roles:
  useEffect(() => {
    if (currentView === 'sql' || currentView === 'sql-schema' || currentView === 'database') {
      setCurrentView('dashboard');
      return;
    }
    if (isBranchUser && !['dashboard', 'inventory', 'executiveReport', 'stockOut', 'adjustment', 'auditTrail'].includes(currentView)) {
      setCurrentView('dashboard');
    }
  }, [isBranchUser, currentView]);

  const renderView = () => {
    // If BranchUser, allow the permitted views (dashboard, inventory & executiveReport locked to assigned branch)
    if (isBranchUser) {
      switch (currentView) {
        case 'dashboard':
          return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
        case 'inventory':
          return <InventoryView />;
        case 'executiveReport':
          return <ExecutiveReportView />;
        case 'stockOut':
          return <StockOutView />;
        case 'adjustment':
          return <AdjustmentView />;
        case 'auditTrail':
          return <AuditTrailView />;
        default:
          return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
      }
    }

    // Full access for CentralAdmin (excluding removed SQL viewer)
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
      case 'inventory':
        return <InventoryView />;
      case 'executiveReport':
        return <ExecutiveReportView />;
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
      default:
        return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-[100vw] bg-[#EBF4F0] text-[#0B3C2D] overflow-hidden overflow-x-hidden font-siemreap app-shell">
      <div className="no-print">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />
      </div>
      
      <div className="flex flex-1 overflow-hidden relative">
        <div className="no-print flex">
          <Sidebar
            currentView={currentView}
            setCurrentView={setCurrentView}
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          />
        </div>
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 ml-0 lg:-ml-5 mr-0 mt-0 lg:-mt-[11px] bg-[#F4F7F6] print-main-container">
          {renderView()}
        </main>
      </div>

      {/* User Management & RBAC Modal for CentralAdmin */}
      <div className="no-print">
        <UserManagementModal />
      </div>

      <footer className="no-print bg-[#D2EADF] border-t border-[#B8DEC8] py-2 sm:py-2.5 px-3 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-[#124D3A] shrink-0 text-center sm:text-left">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <span>Version 2.4.0-stable</span>
          <span className="text-[#8BCAAD]">|</span>
          <span>Support: it-support@tax.gov.kh</span>
        </div>
        <div className="truncate max-w-full">
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
