import React from 'react';

export function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
      <div className="text-6xl border-2 border-dashed border-gray-200 rounded-full w-24 h-24 flex items-center justify-center bg-gray-50">
        🚧
      </div>
      <h2 className="text-xl font-medium text-gray-600">{title} Module</h2>
      <p className="text-sm">This module is currently under development.</p>
    </div>
  );
}
