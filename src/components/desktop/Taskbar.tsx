'use client';

import React from 'react';
import { Terminal, Settings, Clock, Wifi, Volume2, MessageSquare } from 'lucide-react';

interface Window {
  id: string;
  title: string;
  isActive: boolean;
  isMinimized: boolean;
  zIndex: number;
}

interface TaskbarProps {
  windows: Window[];
  onMinimize: (id: string) => void;
  onRestore: (id: string) => void;
  onFocus: (id: string) => void;
  ollamaAvailable: boolean;
  onShowStartMenu: () => void;
  showStartMenu: boolean;
}

const Taskbar: React.FC<TaskbarProps> = ({
  windows,
  onMinimize,
  onRestore,
  onFocus,
  ollamaAvailable,
  onShowStartMenu,
  showStartMenu,
}) => {
  // Get current time for the clock
  const [time, setTime] = React.useState<string>(getTimeString());
  
  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(getTimeString());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format time string
  function getTimeString(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  
  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-900 border-t border-gray-700 flex items-center px-2 z-50">
      {/* Start button */}
      <button 
        className={`bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-sm mr-4 flex items-center ${
          showStartMenu ? 'bg-blue-700' : ''
        }`}
        onClick={onShowStartMenu}
      >
        <span className="font-bold mr-1">K</span>
        <span className="text-xs">Linux</span>
      </button>
      
      {/* Window buttons */}
      <div className="flex-1 flex space-x-1 overflow-x-auto">
        {windows.map(win => (
          <button
            key={win.id}
            className={`px-2 py-1 text-xs truncate max-w-xs rounded ${
              win.isActive && !win.isMinimized
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            onClick={() => win.isMinimized ? onRestore(win.id) : onFocus(win.id)}
          >
            {win.title}
          </button>
        ))}
      </div>
      
      {/* System indicators */}
      <div className="flex items-center space-x-4 text-gray-300 text-xs pr-2">
        {/* Ollama connection indicator */}
        <div className="flex items-center space-x-1" title={ollamaAvailable ? "Ollama Connected" : "Ollama Not Available"}>
          <div className={`w-2 h-2 rounded-full ${ollamaAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="hidden sm:inline text-xs">{ollamaAvailable ? "Ollama" : "Offline"}</span>
        </div>
        
        {/* System tray icons */}
        <div className="flex items-center space-x-3">
          <MessageSquare size={14} className="text-gray-400 hover:text-white cursor-pointer" />
          <Wifi size={14} className="text-gray-400 hover:text-white cursor-pointer" />
          <Volume2 size={14} className="text-gray-400 hover:text-white cursor-pointer" />
          <span className="text-gray-300">{time}</span>
        </div>
      </div>
    </div>
  );
};

export default Taskbar; 