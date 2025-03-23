'use client';

import React from 'react';
import { Terminal, FileText, User, Code, Link, Home, Volume2, Gamepad2, Music, Film } from 'lucide-react';

interface TaskbarProps {
  windows: Array<{
    id: string;
    title: string;
    isActive: boolean;
    isMinimized: boolean;
  }>;
  onWindowSelect: (id: string) => void;
  onShowStartMenu: () => void;
}

const Taskbar: React.FC<TaskbarProps> = ({ windows, onWindowSelect, onShowStartMenu }) => {
  // Helper function to get the appropriate icon for a window
  const getWindowIcon = (id: string) => {
    switch (id) {
      case 'terminal':
        return <Terminal size={16} className="text-green-400" />;
      case 'resume':
        return <FileText size={16} className="text-blue-400" />;
      case 'about':
        return <User size={16} className="text-purple-400" />;
      case 'projects':
        return <Code size={16} className="text-yellow-400" />;
      case 'social':
        return <Link size={16} className="text-red-400" />;
      case 'flowchart':
        return <Code size={16} className="text-cyan-400" />;
      case 'jarvis':
        return <Volume2 size={16} className="text-cyan-400" />;
      case 'tetris':
        return <Gamepad2 size={16} className="text-green-300" />;
      case 'mp3player':
        return <Music size={16} className="text-pink-400" />;
      case 'vlcplayer':
        return <Film size={16} className="text-orange-400" />;
      default:
        return <FileText size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 h-10 border-t border-gray-800 flex items-center px-2 z-50">
      {/* Start Button */}
      <button 
        className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 hover:bg-green-700 mr-2"
        onClick={onShowStartMenu}
      >
        <Home size={16} className="text-white" />
      </button>
      
      {/* Window Buttons */}
      <div className="flex-1 flex items-center space-x-1 overflow-x-auto">
        {windows.map(window => (
          <button
            key={window.id}
            className={`px-3 py-1 rounded flex items-center max-w-xs truncate ${
              window.isActive ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'
            }`}
            onClick={() => onWindowSelect(window.id)}
          >
            <span className="mr-2">{getWindowIcon(window.id)}</span>
            <span className="truncate text-sm">{window.title}</span>
          </button>
        ))}
      </div>
      
      {/* Time */}
      <div className="text-white text-xs px-2">
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
};

export default Taskbar; 