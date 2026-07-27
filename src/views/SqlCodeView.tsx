import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Database, Code2 } from 'lucide-react';

export function SqlCodeView() {
  const { t } = useLanguage();
  const [sqlCode, setSqlCode] = useState<string>('Loading schema...');

  useEffect(() => {
    // In a real app, this might fetch from the actual schema.sql file if hosted,
    // or just hardcoded for demonstration.
    fetch('/schema.sql')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.text();
      })
      .then(text => setSqlCode(text))
      .catch(err => setSqlCode('-- schema.sql not accessible via fetch.\n-- It is located in the root of the project.\n\n-- Tables created: locations, items, inventory, transactions.\n-- Function created: handle_branch_handover.'));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 text-gray-700 rounded-lg">
          <Database size={24} />
        </div>
        <h2 className="text-2xl font-semibold text-gray-800">{t.sqlCode}</h2>
      </div>
      
      <div className="bg-[#1e1e1e] rounded-xl shadow-sm overflow-hidden border border-gray-800">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#2d2d2d] border-b border-gray-700">
          <Code2 size={16} className="text-gray-400" />
          <span className="text-sm font-mono text-gray-300">schema.sql</span>
        </div>
        <div className="p-4 overflow-auto max-h-[600px]">
          <pre className="text-sm font-mono text-green-400 leading-relaxed">
            <code>{sqlCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
