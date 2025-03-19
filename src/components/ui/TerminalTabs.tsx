'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';

export interface Tab {
  id: string;
  title: string;
  type: 'recruiter' | 'collaborator';
}

interface TerminalTabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
}

const TerminalTabs = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
}: TerminalTabsProps) => {
  return (
    <div className="flex bg-gray-900 border-b border-gray-700 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center px-3 py-2 border-r border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors ${
            activeTabId === tab.id
              ? 'bg-gray-800 border-t-2 border-t-blue-500'
              : 'bg-gray-900'
          }`}
          onClick={() => onTabClick(tab.id)}
        >
          <span className={`inline-block h-2 w-2 rounded-full mr-2 ${
            tab.type === 'recruiter' ? 'bg-blue-500' : 'bg-purple-500'
          }`} />
          <span className="text-sm text-gray-300 truncate max-w-[120px]">
            {tab.title}
          </span>
          <button
            className="ml-2 p-1 rounded-full hover:bg-gray-700 opacity-70 hover:opacity-100 text-gray-400 hover:text-gray-200"
            onClick={(e) => onTabClose(tab.id, e)}
            title="Close tab"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        className="flex items-center px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        onClick={onNewTab}
        title="New tab"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

export default TerminalTabs; 