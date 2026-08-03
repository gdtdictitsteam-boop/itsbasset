import React from 'react';

export function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-12 flex flex-col items-center justify-center text-slate-400 space-y-4 max-w-2xl mx-auto my-8">
      <div className="text-5xl border-2 border-dashed border-slate-200 rounded-full w-20 h-20 flex items-center justify-center bg-slate-50">
        🚧
      </div>
      <h2 className="text-xl font-bold text-slate-800">{title} Module</h2>
      <p className="text-sm text-slate-500">This module is currently under development.</p>
    </div>
  );
}
