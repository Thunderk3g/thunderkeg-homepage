'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Linkedin, Mail } from 'lucide-react';
import TerminalWindow from './TerminalWindow';
import { useRouter } from 'next/navigation';
import PDFViewer from './PDFViewer';
import Image from 'next/image';

// Define window types
export type WindowType = 'terminal' | 'resume' | 'about' | 'projects';

// Define window interface
interface Window {
  id: string;
  type: WindowType;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
  initialSize?: { width: number; height: number };
  initialPosition?: { x: number; y: number };
  component: React.ReactNode;
}

// Define desktop icon interface
interface DesktopIcon {
  id: string;
  label: string;
  iconSrc: string;
  onClick: () => void;
}

interface LinuxDesktopProps {
  children?: React.ReactNode;
  agentType?: 'recruiter' | 'collaborator';
  onSwitchAgent?: () => void;
}

const LinuxDesktop: React.FC<LinuxDesktopProps> = ({ 
  children,
  agentType = 'recruiter',
  onSwitchAgent
}) => {
  const router = useRouter();
  const [windows, setWindows] = useState<Window[]>([]);
  const [topZIndex, setTopZIndex] = useState(10);
  const desktopRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update time every minute
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Initialize windows
  useEffect(() => {
    // We'll add windows as needed, keeping the terminal as the main window
    setWindows([
      {
        id: 'terminal',
        type: 'terminal',
        title: `Terminal - ${agentType === 'recruiter' ? 'Professional' : 'Personal'}`,
        isOpen: true,
        isMinimized: false,
        zIndex: 10,
        initialSize: { width: 800, height: 600 },
        initialPosition: { x: 100, y: 100 },
        component: children // This should be the TerminalChat component
      },
      {
        id: 'resume',
        type: 'resume',
        title: 'Resume.pdf',
        isOpen: false,
        isMinimized: false,
        zIndex: 9,
        initialSize: { width: 850, height: 700 },
        initialPosition: { x: 150, y: 50 },
        component: (
          <PDFViewer pdfUrl="/resume.pdf" title="Resume.pdf" />
        )
      },
      {
        id: 'about',
        type: 'about',
        title: 'About Me',
        isOpen: false,
        isMinimized: false,
        zIndex: 8,
        initialSize: { width: 600, height: 500 },
        initialPosition: { x: 200, y: 150 },
        component: (
          <div className="w-full h-full bg-gray-800 text-gray-100 p-4 overflow-auto">
            <h2 className="text-xl font-bold mb-4">About Me</h2>
            <p className="mb-3">
              I'm a passionate software engineer specializing in full-stack development.
              My interests include AI, web development, and creating intuitive user experiences.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-700 p-3 rounded">
                <h3 className="font-bold mb-2">Skills</h3>
                <ul className="list-disc list-inside">
                  <li>TypeScript/JavaScript</li>
                  <li>React & Next.js</li>
                  <li>Node.js</li>
                  <li>AI Integration</li>
                  <li>UI/UX Design</li>
                </ul>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <h3 className="font-bold mb-2">Experience</h3>
                <ul className="list-disc list-inside">
                  <li>Senior Developer</li>
                  <li>AI Researcher</li>
                  <li>Open Source Contributor</li>
                </ul>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'projects',
        type: 'projects',
        title: 'Projects',
        isOpen: false,
        isMinimized: false,
        zIndex: 7,
        initialSize: { width: 650, height: 550 },
        initialPosition: { x: 250, y: 120 },
        component: (
          <div className="w-full h-full bg-gray-800 text-gray-100 p-4 overflow-auto">
            <h2 className="text-xl font-bold mb-4">My Projects</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-gray-700 p-3 rounded">
                <h3 className="font-bold">AI Portfolio</h3>
                <p className="text-sm text-gray-300 mb-2">A Linux-themed portfolio with embedded AI agents</p>
                <div className="flex gap-2 text-xs">
                  <span className="bg-blue-500 px-2 py-1 rounded">Next.js</span>
                  <span className="bg-yellow-500 px-2 py-1 rounded">TypeScript</span>
                  <span className="bg-purple-500 px-2 py-1 rounded">Ollama</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <h3 className="font-bold">RAG Implementation</h3>
                <p className="text-sm text-gray-300 mb-2">Retrieval-augmented generation with local models</p>
                <div className="flex gap-2 text-xs">
                  <span className="bg-green-500 px-2 py-1 rounded">AI</span>
                  <span className="bg-yellow-500 px-2 py-1 rounded">TypeScript</span>
                  <span className="bg-red-500 px-2 py-1 rounded">Vector DB</span>
                </div>
              </div>
            </div>
          </div>
        )
      }
    ]);
  }, [children, agentType]);
  
  // Define desktop icons
  const desktopIcons: DesktopIcon[] = [
    {
      id: 'terminal-icon',
      label: 'Terminal',
      iconSrc: '/icons/terminal.png',
      onClick: () => handleOpenWindow('terminal')
    },
    {
      id: 'resume-icon',
      label: 'Resume.pdf',
      iconSrc: '/icons/resume.png',
      onClick: () => handleOpenWindow('resume')
    },
    {
      id: 'about-icon',
      label: 'About Me',
      iconSrc: '/icons/about.png',
      onClick: () => handleOpenWindow('about')
    },
    {
      id: 'projects-icon',
      label: 'Projects',
      iconSrc: '/icons/folder.png',
      onClick: () => handleOpenWindow('projects')
    }
  ];
  
  // Window management functions
  const handleOpenWindow = (id: string) => {
    console.log(`Opening window: ${id}`); // Debug log
    
    setWindows(prev => prev.map(window => {
      if (window.id === id) {
        // If window is minimized, restore it and bring to front
        if (window.isMinimized) {
          return { ...window, isMinimized: false, isOpen: true, zIndex: topZIndex + 1 };
        }
        // If window is closed, open it and bring to front
        if (!window.isOpen) {
          return { ...window, isOpen: true, zIndex: topZIndex + 1 };
        }
        // If window is already open, just bring to front
        return { ...window, zIndex: topZIndex + 1 };
      }
      return window;
    }));
    
    setTopZIndex(prev => prev + 1);
  };
  
  const handleCloseWindow = (id: string) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, isOpen: false } : window
    ));
  };
  
  const handleMinimizeWindow = (id: string) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, isMinimized: true } : window
    ));
  };
  
  const handleMaximizeWindow = (id: string) => {
    // Find the window
    const window = windows.find(w => w.id === id);
    if (!window) return;
    
    // Toggle fullscreen functionality can be implemented here
    // For now, we'll just focus the window
    handleFocusWindow(id);
  };
  
  const handleFocusWindow = (id: string) => {
    handleOpenWindow(id);
  };
  
  // Render desktop icon component
  const DesktopIconComponent: React.FC<DesktopIcon> = ({ label, iconSrc, onClick }) => (
    <div 
      className="flex flex-col items-center justify-center w-20 h-24 hover:bg-white/10 rounded p-2 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <div className="mb-1 p-2 bg-gray-800/50 rounded-full group-hover:bg-blue-700/50 transition-colors relative w-12 h-12 flex items-center justify-center">
        <Image 
          src={iconSrc} 
          alt={label} 
          width={32} 
          height={32} 
          className="object-contain"
        />
      </div>
      <span className="text-white text-xs text-center font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
        {label}
      </span>
    </div>
  );
  
  // Render dock icon component
  const DockIcon: React.FC<{ window: Window; iconSrc: string }> = ({ window, iconSrc }) => (
    <div 
      className={`relative p-2 cursor-pointer transition-all duration-200 rounded-md
        ${window.isOpen && !window.isMinimized 
          ? 'bg-blue-600/30 text-blue-400' 
          : window.isOpen && window.isMinimized 
            ? 'bg-gray-700/50 text-gray-400' 
            : 'text-gray-500 hover:text-gray-300'
        }`}
      onClick={() => handleOpenWindow(window.id)}
    >
      <Image 
        src={iconSrc} 
        alt={window.title} 
        width={24} 
        height={24} 
        className="object-contain"
      />
      
      {window.isOpen && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
      )}
    </div>
  );
  
  // Format time for the taskbar clock
  const formatClock = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Format date for the taskbar
  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Desktop background */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ 
        backgroundImage: `url('/wallpaper.jpg')`,
        backgroundSize: '50%', // Scale down to show the Tux logo at a reasonable size
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: '#000', // Dark background
      }} />
      
      {/* Desktop content container */}
      <div ref={desktopRef} className="absolute inset-0 flex flex-col">
        {/* Desktop icons area */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 gap-4 w-max">
            {desktopIcons.map(icon => (
              <DesktopIconComponent 
                key={icon.id}
                {...icon} 
              />
            ))}
          </div>
          
          {/* Windows */}
          <AnimatePresence>
            {windows.map(window => (
              window.isOpen && !window.isMinimized && (
                <TerminalWindow
                  key={window.id}
                  title={window.title}
                  initialPosition={window.initialPosition}
                  initialSize={window.initialSize}
                  onClose={() => handleCloseWindow(window.id)}
                  onToggleFullscreen={() => handleMaximizeWindow(window.id)}
                  zIndex={window.zIndex}
                  onFocus={() => handleFocusWindow(window.id)}
                  isFocused={window.zIndex === Math.max(...windows.map(w => w.zIndex))}
                  id={window.id}
                >
                  {window.component}
                </TerminalWindow>
              )
            ))}
          </AnimatePresence>
        </div>
        
        {/* Dock/Taskbar */}
        <div className="h-12 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 px-4 flex items-center justify-between">
          {/* Left side - Start menu and open apps */}
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 rounded p-1 cursor-pointer hover:bg-blue-700 transition-colors">
              <Image 
                src="/icons/terminal.png" 
                alt="Menu" 
                width={20} 
                height={20} 
                className="object-contain"
              />
            </div>
            
            <div className="h-6 border-l border-gray-700"></div>
            
            <div className="flex space-x-1">
              {windows.map(window => {
                let iconSrc = '/icons/terminal.png';
                if (window.type === 'resume') iconSrc = '/icons/resume.png';
                if (window.type === 'about') iconSrc = '/icons/about.png';
                if (window.type === 'projects') iconSrc = '/icons/folder.png';
                
                return (
                  <DockIcon 
                    key={window.id} 
                    window={window} 
                    iconSrc={iconSrc}
                  />
                );
              })}
            </div>
          </div>
          
          {/* Agent indicator and switcher */}
          <div 
            className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors
              ${agentType === 'recruiter' 
                ? 'bg-blue-600/30 text-blue-200 hover:bg-blue-600/50'
                : 'bg-green-600/30 text-green-200 hover:bg-green-600/50'
              }`}
            onClick={onSwitchAgent}
          >
            {agentType === 'recruiter' ? 'Professional Mode' : 'Personal Mode'}
          </div>
          
          {/* Right side - System tray and clock */}
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Github size={18} />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Linkedin size={18} />
              </a>
              <a 
                href="mailto:contact@example.com" 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Mail size={18} />
              </a>
            </div>
            
            <div className="h-6 border-l border-gray-700"></div>
            
            <div className="text-gray-200 text-sm">
              <span>{formatClock(currentTime)}</span>
              <span className="mx-1">•</span>
              <span>{formatDate(currentTime)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinuxDesktop; 