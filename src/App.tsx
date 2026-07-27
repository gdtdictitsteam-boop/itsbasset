/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { InventoryView } from './views/InventoryView';
import { StockOutView } from './views/StockOutView';
import { HandoverView } from './views/HandoverView';
import { SqlCodeView } from './views/SqlCodeView';
import { PlaceholderView } from './views/PlaceholderView';
import { useLanguage } from './contexts/LanguageContext';

function MainLayout() {
  const [currentView, setCurrentView] = useState('dashboard');
  const { t } = useLanguage();

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'inventory':
        return <InventoryView />;
      case 'stockOut':
        return <StockOutView />;
      case 'handover':
        return <HandoverView />;
      case 'sql':
        return <SqlCodeView />;
      case 'stockIn':
        return <PlaceholderView title={t.stockIn} />;
      case 'newSku':
        return <PlaceholderView title={t.newSku} />;
      case 'adjustment':
        return <PlaceholderView title={t.adjustment} />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#FAF9F6] text-[#0F172A] overflow-hidden font-siemreap">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
        
        <main className="flex-1 overflow-y-auto p-8">
          {renderView()}
        </main>
      </div>

      <footer className="bg-white border-t border-slate-200 py-2.5 px-6 flex justify-between items-center text-[11px] font-medium text-slate-400 shrink-0">
        <div className="flex items-center space-x-4">
          <span>Version 2.4.0-stable</span>
          <span className="text-slate-300">|</span>
          <span>Support: it-support@tax.gov.kh</span>
        </div>
        <div>
          {t.copyright}
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainLayout />
    </LanguageProvider>
  );
}

