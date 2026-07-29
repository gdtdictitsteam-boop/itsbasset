import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Database, Code2, Copy, Check, FileText } from 'lucide-react';

export function SqlCodeView() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'sql' | 'python'>('python');
  const [sqlCode, setSqlCode] = useState<string>('Loading schema...');
  const [pythonCode, setPythonCode] = useState<string>('Loading app.py...');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    fetch('/schema.sql')
      .then(res => res.text())
      .then(text => setSqlCode(text))
      .catch(() => setSqlCode('-- schema.sql located in project root.'));

    fetch('/app.py')
      .then(res => res.text())
      .then(text => setPythonCode(text))
      .catch(() => setPythonCode('# app.py Streamlit code located in project root.'));
  }, []);

  const handleCopy = () => {
    const textToCopy = activeTab === 'sql' ? sqlCode : pythonCode;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#C2E4D5] text-[#03291E] rounded-xl border border-[#A3D8C2]">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#03291E]">មូលទិន្នន័យ និង កូដកម្មវិធី (Database & Python Streamlit)</h2>
            <p className="text-xs text-[#2B6A52] font-semibold mt-0.5">
              Supabase Backend Schema & Functional Python Streamlit Application
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 bg-[#03291E] hover:bg-[#1E6047] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto"
        >
          {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          <span>{copied ? 'បានចម្លង! (Copied)' : 'ចម្លងកូដ (Copy Code)'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#C2E4D5] shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="bg-[#C2E4D5] border-b border-[#B0DAC7] px-4 py-3 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('python')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'python'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-[#03291E] hover:bg-[#A3D8C2]/50'
              }`}
            >
              <FileText size={16} />
              <span>Python Streamlit (app.py)</span>
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'sql'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-[#03291E] hover:bg-[#A3D8C2]/50'
              }`}
            >
              <Code2 size={16} />
              <span>Supabase Schema (schema.sql)</span>
            </button>
          </div>

          <span className="text-xs font-mono text-[#03291E] font-bold hidden md:inline-block">
            {activeTab === 'python' ? 'app.py' : 'schema.sql'}
          </span>
        </div>

        <div className="p-4 bg-[#1E293B] overflow-auto max-h-[620px]">
          <pre className="text-xs font-mono text-[#7DD3FC] leading-relaxed whitespace-pre-wrap">
            <code>{activeTab === 'python' ? pythonCode : sqlCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
