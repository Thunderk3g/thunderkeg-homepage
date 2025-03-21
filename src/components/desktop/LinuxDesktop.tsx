import React, { useState, useEffect, useCallback, useRef } from 'react';
import TerminalWindow from './TerminalWindow';
import { X, Minus, Square, ChevronRight, File, Coffee, Code, Info, User, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import LandingAnimation from '@/components/landing/LandingAnimation';
import TerminalAgentSelector from '@/components/agents/TerminalAgentSelector';
import JSONResumeViewer from './JSONResumeViewer';
import DesktopIcons from './DesktopIcons';
import Taskbar from './Taskbar';

// Kali Linux theme colors
const kaliTheme = {
  background: '#000000',
  text: '#ffffff',
  primary: '#367bf0',
  accent: '#4BBB4F', // Kali green
  taskbar: '#0C0C0C',
  window: {
    titleBar: '#0C0C0C',
    background: '#1E1E1E',
    border: '#367bf0',
  }
};

interface DesktopIcon {
  name: string;
  icon: React.ReactNode;
  action: () => void;
}

interface Window {
  id: string;
  title: string;
  content: React.ReactNode;
  isActive: boolean;
  isMinimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isResizing?: boolean;
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
}

// Using string type for agent instead of enum to match component expectations
type UserRole = 'recruiter' | 'collaborator';

// Fix the LinuxDesktopProps interface
interface LinuxDesktopProps {
  initialView: string;
  onViewChange: (view: string) => void;
  userRole: UserRole | null;
  onRoleSelect?: (role: UserRole) => void;
  renderActiveTerminal?: () => React.ReactNode;
  ollamaAvailable: boolean;
}

const LinuxDesktop = ({
  initialView,
  onViewChange,
  userRole,
  onRoleSelect,
  renderActiveTerminal,
  ollamaAvailable
}: LinuxDesktopProps) => {
  // State for windows
  const [windows, setWindows] = useState<Window[]>([]);
  const [highestZIndex, setHighestZIndex] = useState(10);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showLanding, setShowLanding] = useState(initialView === 'landing');
  const [showRoleSelect, setShowRoleSelect] = useState(initialView === 'roleSelect');
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dragRef = useRef<{ clientX: number, clientY: number } | null>(null);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const startMenuRef = useRef<HTMLDivElement | null>(null);

  // Track view changes
  useEffect(() => {
    if (initialView === 'landing') {
      setShowLanding(true);
      setShowRoleSelect(false);
    } else if (initialView === 'roleSelect') {
      setShowLanding(false);
      setShowRoleSelect(true);
    } else {
      setShowLanding(false);
      setShowRoleSelect(false);
    }
  }, [initialView]);

  // Handle terminal open
  const handleTerminalOpen = useCallback(() => {
    const terminalExists = windows.some(win => win.id === 'terminal');
    
    if (terminalExists) {
      // Make the existing terminal active
      setWindows(windows.map(win => {
        if (win.id === 'terminal') {
          return { ...win, isActive: true, isMinimized: false, zIndex: highestZIndex + 1 };
        }
        return { ...win, isActive: false };
      }));
      setHighestZIndex(prev => prev + 1);
    } else {
      // Create a new terminal window
      const newWindow: Window = {
        id: 'terminal',
        title: 'Terminal - Kali Linux',
        content: renderActiveTerminal ? renderActiveTerminal() : <TerminalWindow />,
        isActive: true,
        isMinimized: false,
        position: { x: 100, y: 50 },
        size: { width: 800, height: 600 },
        zIndex: highestZIndex + 1
      };
      
      setWindows([...windows.map(win => ({ ...win, isActive: false })), newWindow]);
      setHighestZIndex(prev => prev + 1);
    }
  }, [windows, highestZIndex, renderActiveTerminal]);

  // Initialize with terminal window
  useEffect(() => {
    if (!isInitialized) {
      handleTerminalOpen();
      setIsInitialized(true);
    }
  }, [isInitialized, handleTerminalOpen]);

  // Handle resume open
  const handleResumeOpen = () => {
    const resumeExists = windows.some(win => win.id === 'resume');
    
    if (resumeExists) {
      // Make the existing resume active
      setWindows(windows.map(win => {
        if (win.id === 'resume') {
          return { ...win, isActive: true, isMinimized: false, zIndex: highestZIndex + 1 };
        }
        return { ...win, isActive: false };
      }));
      setHighestZIndex(prev => prev + 1);
    } else {
      // Create a new resume window using JSONResumeViewer
      const newWindow: Window = {
        id: 'resume',
        title: 'Resume - Kali Linux',
        content: <JSONResumeViewer />,
        isActive: true,
        isMinimized: false,
        position: { x: 150, y: 70 },
        size: { width: 800, height: 800 },
        zIndex: highestZIndex + 1
      };
      
      setWindows([...windows.map(win => ({ ...win, isActive: false })), newWindow]);
      setHighestZIndex(prev => prev + 1);
    }
  };

  // Handle about open
  const handleAboutOpen = () => {
    const aboutExists = windows.some(win => win.id === 'about');
    
    if (aboutExists) {
      // Make the existing about active
      setWindows(windows.map(win => {
        if (win.id === 'about') {
          return { ...win, isActive: true, isMinimized: false, zIndex: highestZIndex + 1 };
        }
        return { ...win, isActive: false };
      }));
      setHighestZIndex(prev => prev + 1);
    } else {
      // Create a new about window
      const newWindow: Window = {
        id: 'about',
        title: 'About - Kali Linux',
        content: (
          <div className="p-6 bg-gray-900 text-white h-full overflow-auto">
            <h2 className="text-2xl font-bold mb-4 text-green-400">About This Project</h2>
            <p className="mb-4">
              This is an AI-powered portfolio simulating a Kali Linux desktop environment.
              Built with Next.js, TypeScript, and Tailwind CSS, it features:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Terminal emulation with AI agents</li>
              <li>Kali Linux desktop environment simulation</li>
              <li>Window management system</li>
              <li>Resume viewer</li>
              <li>Local Ollama integration for AI model inference</li>
            </ul>
            <div className="mt-6 p-4 bg-black rounded-md border border-green-500">
              <div className="flex items-center mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span className="text-xs text-green-400 ml-2">kali@system:~$</span>
              </div>
              <p className="text-green-400 font-mono text-sm">
                cat /etc/issue<br />
                Kali GNU/Linux Rolling<br />
                <span className="blink">_</span>
              </p>
            </div>
          </div>
        ),
        isActive: true,
        isMinimized: false,
        position: { x: 200, y: 100 },
        size: { width: 600, height: 500 },
        zIndex: highestZIndex + 1
      };
      
      setWindows([...windows.map(win => ({ ...win, isActive: false })), newWindow]);
      setHighestZIndex(prev => prev + 1);
    }
  };

  // Handle social links open
  const handleSocialLinksOpen = () => {
    const socialExists = windows.some(win => win.id === 'social');
    
    if (socialExists) {
      // Make the existing social window active
      setWindows(windows.map(win => {
        if (win.id === 'social') {
          return { ...win, isActive: true, isMinimized: false, zIndex: highestZIndex + 1 };
        }
        return { ...win, isActive: false };
      }));
      setHighestZIndex(prev => prev + 1);
    } else {
      // Create a new social links window
      const newWindow: Window = {
        id: 'social',
        title: 'Social Links - Kali Linux',
        content: (
          <div className="w-full h-full bg-gray-800 text-gray-200 p-6 overflow-auto">
            <h2 className="text-xl font-bold mb-6 text-green-400">Connect With Me</h2>
            <div className="grid grid-cols-1 gap-4">
              <a 
                href="https://github.com/yourusername" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="black">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">GitHub</h3>
                  <p className="text-xs text-gray-400">@yourusername</p>
                </div>
              </a>
              <a 
                href="https://linkedin.com/in/yourusername" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">LinkedIn</h3>
                  <p className="text-xs text-gray-400">Your Name</p>
                </div>
              </a>
              <a 
                href="https://twitter.com/yourusername" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Twitter</h3>
                  <p className="text-xs text-gray-400">@yourusername</p>
                </div>
              </a>
            </div>
          </div>
        ),
        isActive: true,
        isMinimized: false,
        position: { x: 200, y: 120 },
        size: { width: 400, height: 500 },
        zIndex: highestZIndex + 1
      };
      
      setWindows([...windows.map(win => ({ ...win, isActive: false })), newWindow]);
      setHighestZIndex(prev => prev + 1);
    }
  };

  // Handle projects open
  const handleProjectsOpen = () => {
    const projectsExists = windows.some(win => win.id === 'projects');
    
    if (projectsExists) {
      // Make the existing projects window active
      setWindows(windows.map(win => {
        if (win.id === 'projects') {
          return { ...win, isActive: true, isMinimized: false, zIndex: highestZIndex + 1 };
        }
        return { ...win, isActive: false };
      }));
      setHighestZIndex(prev => prev + 1);
    } else {
      // Create a new projects window
      const newWindow: Window = {
        id: 'projects',
        title: 'Projects - Kali Linux',
        content: (
          <div className="w-full h-full bg-gray-800 text-gray-200 p-6 overflow-auto">
            <h2 className="text-xl font-bold mb-6 text-green-400">My Projects</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-400">AI Portfolio</h3>
                <p className="text-sm mt-2 text-gray-300">
                  A Linux-themed portfolio with embedded AI agents designed to showcase technical skills and projects.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded">Next.js</span>
                  <span className="px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded">TypeScript</span>
                  <span className="px-2 py-1 text-xs bg-purple-900 text-purple-200 rounded">Ollama</span>
                  <span className="px-2 py-1 text-xs bg-green-900 text-green-200 rounded">Tailwind CSS</span>
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-400">RAG Implementation</h3>
                <p className="text-sm mt-2 text-gray-300">
                  A retrieval-augmented generation system using local language models for efficient document processing and Q&A.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs bg-green-900 text-green-200 rounded">Python</span>
                  <span className="px-2 py-1 text-xs bg-yellow-900 text-yellow-200 rounded">LangChain</span>
                  <span className="px-2 py-1 text-xs bg-red-900 text-red-200 rounded">Vector DB</span>
                  <span className="px-2 py-1 text-xs bg-indigo-900 text-indigo-200 rounded">FastAPI</span>
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-400">Penetration Testing Tool</h3>
                <p className="text-sm mt-2 text-gray-300">
                  A security auditing tool designed to identify vulnerabilities in web applications and network infrastructure.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded">Go</span>
                  <span className="px-2 py-1 text-xs bg-green-900 text-green-200 rounded">Python</span>
                  <span className="px-2 py-1 text-xs bg-red-900 text-red-200 rounded">Kali Linux</span>
                  <span className="px-2 py-1 text-xs bg-gray-900 text-gray-200 rounded">Networking</span>
                </div>
              </div>
            </div>
          </div>
        ),
        isActive: true,
        isMinimized: false,
        position: { x: 250, y: 100 },
        size: { width: 600, height: 500 },
        zIndex: highestZIndex + 1
      };
      
      setWindows([...windows.map(win => ({ ...win, isActive: false })), newWindow]);
      setHighestZIndex(prev => prev + 1);
    }
  };

  // Handle flow chart open
  const handleFlowChartOpen = () => {
    const flowChartExists = windows.some(win => win.id === 'flowchart');
    
    if (flowChartExists) {
      // Make the existing flow chart active
      setWindows(windows.map(win => {
        if (win.id === 'flowchart') {
          return { ...win, isActive: true, isMinimized: false, zIndex: highestZIndex + 1 };
        }
        return { ...win, isActive: false };
      }));
      setHighestZIndex(prev => prev + 1);
    } else {
      // Show landing animation in a window
      const newWindow: Window = {
        id: 'flowchart',
        title: 'AI Flow Visualization - Kali Linux',
        content: (
          <div className="h-full w-full overflow-auto bg-gray-950">
            <LandingAnimation 
              onComplete={() => {
                // Don't auto-navigate when viewed in a window
              }} 
              ollamaAvailable={ollamaAvailable} 
            />
          </div>
        ),
        isActive: true,
        isMinimized: false,
        position: { x: 120, y: 60 },
        size: { width: 900, height: 700 },
        zIndex: highestZIndex + 1
      };
      
      setWindows([...windows.map(win => ({ ...win, isActive: false })), newWindow]);
      setHighestZIndex(prev => prev + 1);
    }
  };

  // Handle agent selection open
  const handleAgentSelectOpen = () => {
    const agentSelectExists = windows.some(win => win.id === 'agent-select');
    
    if (agentSelectExists) {
      // Make the existing agent select active
      setWindows(windows.map(win => {
        if (win.id === 'agent-select') {
          return { ...win, isActive: true, isMinimized: false, zIndex: highestZIndex + 1 };
        }
        return { ...win, isActive: false };
      }));
      setHighestZIndex(prev => prev + 1);
    } else {
      // Show agent selector in a window
      const newWindow: Window = {
        id: 'agent-select',
        title: 'Agent Selection - Kali Linux',
        content: (
          <div className="h-full w-full overflow-auto bg-gray-950">
            <TerminalAgentSelector 
              onSelect={(role: 'recruiter' | 'collaborator') => {
                onRoleSelect?.(role);
                handleCloseWindow('agent-select');
                handleTerminalOpen();
              }} 
              currentAgent={userRole || 'recruiter'} 
            />
          </div>
        ),
        isActive: true,
        isMinimized: false,
        position: { x: 150, y: 80 },
        size: { width: 900, height: 700 },
        zIndex: highestZIndex + 1
      };
      
      setWindows([...windows.map(win => ({ ...win, isActive: false })), newWindow]);
      setHighestZIndex(prev => prev + 1);
    }
  };

  // Window management functions
  const handleCloseWindow = (id: string) => {
    setWindows(windows.filter(window => window.id !== id));
  };

  const handleMinimizeWindow = (id: string) => {
    setWindows(windows.map(window => 
      window.id === id ? { ...window, isMinimized: true } : window
    ));
  };

  const handleMaximizeWindow = (id: string) => {
    // Simple toggle maximize (could be enhanced with previous size/position storage)
    setWindows(windows.map(window => 
      window.id === id ? { 
        ...window, 
        position: { x: 0, y: 0 }, 
        size: { width: window.size.width >= window.size.height * 1.5 ? 800 : window.size.width, height: window.size.height >= 800 ? 600 : window.size.height } 
      } : window
    ));
  };

  const handleWindowSelect = (id: string) => {
    if (windows.find(win => win.id === id)?.isMinimized) {
      // Un-minimize the window
      setWindows(windows.map(window => 
        window.id === id ? { 
          ...window, 
          isActive: true, 
          isMinimized: false,
          zIndex: highestZIndex + 1
        } : { ...window, isActive: false }
      ));
    } else {
      // Just make the window active
      setWindows(windows.map(window => 
        window.id === id ? { 
          ...window, 
          isActive: true,
          zIndex: highestZIndex + 1
        } : { ...window, isActive: false }
      ));
    }
    setHighestZIndex(prev => prev + 1);
  };

  // Handle window drag start
  const handleDragStart = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // Find the window
    const window = windows.find(win => win.id === id);
    if (!window) return;
    
    // Calculate offset from click position to window position
    const offsetX = e.clientX - window.position.x;
    const offsetY = e.clientY - window.position.y;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(id);
    dragRef.current = { clientX: e.clientX, clientY: e.clientY };
    
    // Focus the window
    handleWindowFocus(id);
    
    // Setup global mouse event listeners for dragging
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };
  
  // Handle window drag move using requestAnimationFrame for smoother animation
  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    // Use requestAnimationFrame for smoother movement
    requestAnimationFrame(() => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - (dragRef.current?.clientX || 0);
      const deltaY = e.clientY - (dragRef.current?.clientY || 0);
      dragRef.current = { clientX: e.clientX, clientY: e.clientY };
      
      setWindows(prev => prev.map(win => {
        if (win.id !== isDragging) return win;
        
        // Calculate new position 
        const newX = Math.max(0, win.position.x + deltaX);
        const newY = Math.max(0, win.position.y + deltaY);
        
        // Limit to screen boundaries
        const maxX = window.innerWidth - win.size.width;
        const maxY = window.innerHeight - win.size.height;
        
        return {
          ...win,
          position: {
            x: Math.min(newX, maxX),
            y: Math.min(newY, maxY)
          }
        };
      }));
    });
  };
  
  // Handle window drag end
  const handleDragEnd = () => {
    setIsDragging(null);
    dragRef.current = null;
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };
  
  // Handle window focus - brings window to front
  const handleWindowFocus = (id: string) => {
    const window = windows.find(win => win.id === id);
    if (!window || window.isActive) return;
    
    // Increase highest z-index
    const newZIndex = highestZIndex + 1;
    setHighestZIndex(newZIndex);
    
    // Update window states
    setWindows(prev => prev.map(win => {
      if (win.id === id) {
        return { ...win, isActive: true, zIndex: newZIndex };
      }
      return { ...win, isActive: false };
    }));
  };
  
  // Handle window resize start
  const handleResizeStart = (id: string, direction: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const window = windows.find(win => win.id === id);
    if (!window) return;
    
    setIsResizing(id);
    setResizeDirection(direction);
    setResizeStart({ 
      x: e.clientX, 
      y: e.clientY, 
      width: window.size.width, 
      height: window.size.height 
    });
    
    // Focus the window
    handleWindowFocus(id);
    
    // Setup global mouse event listeners for resizing
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  // Handle window resize move
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !resizeDirection) return;
    
    requestAnimationFrame(() => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      setWindows(prev => prev.map(win => {
        if (win.id !== isResizing) return win;
        
        let newWidth = win.size.width;
        let newHeight = win.size.height;
        let newX = win.position.x;
        let newY = win.position.y;
        
        // Determine resize direction and calculate new dimensions
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(300, resizeStart.width + deltaX);
        }
        
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(200, resizeStart.height + deltaY);
        }
        
        if (resizeDirection.includes('w')) {
          const widthChange = resizeStart.width - Math.max(300, resizeStart.width - deltaX);
          newWidth = resizeStart.width - widthChange;
          newX = win.position.x + widthChange;
        }
        
        if (resizeDirection.includes('n')) {
          const heightChange = resizeStart.height - Math.max(200, resizeStart.height - deltaY);
          newHeight = resizeStart.height - heightChange;
          newY = win.position.y + heightChange;
        }
        
        // Apply min/max constraints if specified
        if (win.minSize) {
          newWidth = Math.max(win.minSize.width, newWidth);
          newHeight = Math.max(win.minSize.height, newHeight);
        }
        
        if (win.maxSize) {
          newWidth = Math.min(win.maxSize.width, newWidth);
          newHeight = Math.min(win.maxSize.height, newHeight);
        }
        
        return {
          ...win,
          position: { x: newX, y: newY },
          size: { width: newWidth, height: newHeight }
        };
      }));
    });
  };
  
  // Handle window resize end
  const handleResizeEnd = () => {
    setIsResizing(null);
    setResizeDirection(null);
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
  
  // Handle window close
  const handleWindowClose = (id: string) => {
    setWindows(prev => prev.filter(win => win.id !== id));
  };
  
  // Handle window minimize
  const handleWindowMinimize = (id: string) => {
    setWindows(prev => prev.map(win => {
      if (win.id === id) {
        return { ...win, isMinimized: true };
      }
      return win;
    }));
  };
  
  // Handle window maximize
  const handleWindowMaximize = (id: string) => {
    setWindows(prev => prev.map(win => {
      if (win.id === id) {
        // Toggle maximized state
        if (win.size.width === window.innerWidth && win.size.height === window.innerHeight - 30) {
          // Restore to original size
          return {
            ...win,
            position: { x: 100, y: 50 },
            size: { width: 800, height: 600 }
          };
        } else {
          // Maximize
          return {
            ...win,
            position: { x: 0, y: 30 }, // Account for taskbar
            size: { width: window.innerWidth, height: window.innerHeight - 30 }
          };
        }
      }
      return win;
    }));
  };
  
  // Handle restoring a minimized window
  const handleWindowRestore = (id: string) => {
    setWindows(prev => prev.map(win => {
      if (win.id === id) {
        return { ...win, isMinimized: false };
      }
      return win;
    }));
    
    // Focus the restored window
    handleWindowFocus(id);
  };

  // Desktop icons
  const desktopIcons: DesktopIcon[] = [
    {
      name: 'Terminal',
      icon: <Code size={30} className="text-green-400" />,
      action: handleTerminalOpen
    },
    {
      name: 'Resume',
      icon: <File size={30} className="text-blue-400" />,
      action: handleResumeOpen
    },
    {
      name: 'Flow Chart',
      icon: <Coffee size={30} className="text-cyan-400" />,
      action: handleFlowChartOpen
    },
    {
      name: 'Agent Select',
      icon: <User size={30} className="text-purple-400" />,
      action: handleAgentSelectOpen
    },
    {
      name: 'About',
      icon: <Info size={30} className="text-yellow-400" />,
      action: handleAboutOpen
    },
    {
      name: 'Projects',
      icon: <Code size={30} className="text-purple-400" />,
      action: handleProjectsOpen
    },
    {
      name: 'Home',
      icon: <Home size={30} className="text-red-400" />,
      action: () => onViewChange('landing')
    }
  ];

  // Render window component
  const renderWindow = (window: Window) => {
    if (window.isMinimized) return null;
    
    return (
      <div
        key={window.id}
        className={`absolute rounded overflow-hidden shadow-lg border border-gray-800 flex flex-col ${
          window.isActive ? 'ring-1 ring-gray-400' : ''
        }`}
        style={{
          left: window.position.x,
          top: window.position.y,
          width: window.size.width,
          height: window.size.height,
          zIndex: window.zIndex,
        }}
        onClick={() => handleWindowFocus(window.id)}
      >
        {/* Window title bar */}
        <div
          className="bg-gray-900 text-gray-200 px-2 py-1 flex justify-between items-center cursor-move"
          onMouseDown={(e) => handleDragStart(window.id, e)}
        >
          <div className="text-sm font-medium truncate">{window.title}</div>
          <div className="flex space-x-1">
            <button
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                handleWindowMinimize(window.id);
              }}
            />
            <button
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                handleWindowMaximize(window.id);
              }}
            />
            <button
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                handleWindowClose(window.id);
              }}
            />
          </div>
        </div>
        
        {/* Window content */}
        <div className="flex-1 bg-gray-800 overflow-hidden">
          {window.content}
        </div>
        
        {/* Resize handles */}
        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 'se', e)} />
        <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 'sw', e)} />
        <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 'ne', e)} />
        <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 'nw', e)} />
        <div className="absolute right-0 top-4 bottom-4 w-2 cursor-e-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 'e', e)} />
        <div className="absolute left-0 top-4 bottom-4 w-2 cursor-w-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 'w', e)} />
        <div className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 's', e)} />
        <div className="absolute top-0 left-4 right-4 h-2 cursor-n-resize" 
             onMouseDown={(e) => handleResizeStart(window.id, 'n', e)} />
      </div>
    );
  };

  return (
    <div className="relative h-screen bg-black overflow-hidden">
      {/* Desktop background */}
      <div 
        className="absolute inset-0 bg-gray-900 bg-opacity-90"
        style={{
          backgroundImage: "url('/images/kali-wallpaper.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Desktop icons using the new component */}
        <DesktopIcons
          onOpenTerminal={handleTerminalOpen}
          onOpenResume={handleResumeOpen}
          onOpenAbout={handleAboutOpen}
          onOpenProjects={handleProjectsOpen}
          onOpenSocialLinks={handleSocialLinksOpen}
        />
      </div>

      {/* Windows */}
      <div className="flex-1 relative">
        <AnimatePresence>
          {windows.map(renderWindow)}
        </AnimatePresence>
      </div>
      
      {/* Taskbar */}
      <Taskbar 
        windows={windows}
        onMinimize={handleWindowMinimize}
        onRestore={handleWindowRestore}
        onFocus={handleWindowFocus}
        ollamaAvailable={ollamaAvailable}
        onShowStartMenu={() => setShowStartMenu(!showStartMenu)}
        showStartMenu={showStartMenu}
      />
      
      {/* Start menu */}
      {showStartMenu && (
        <div 
          className="absolute bottom-8 left-0 w-64 bg-gray-900 border border-gray-700 rounded shadow-lg z-50"
          ref={startMenuRef}
        >
          <div className="p-4 border-b border-gray-800">
            <span className="text-white font-bold">Kali Linux</span>
          </div>
          <div className="p-2">
            <button
              className="w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-800 rounded"
              onClick={handleTerminalOpen}
            >
              Terminal
            </button>
            <button
              className="w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-800 rounded"
              onClick={handleResumeOpen}
            >
              Resume
            </button>
            <button
              className="w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-800 rounded"
              onClick={handleAboutOpen}
            >
              About
            </button>
            <button
              className="w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-800 rounded"
              onClick={handleProjectsOpen}
            >
              Projects
            </button>
          </div>
        </div>
      )}
      
      {/* Landing and role selection views */}
      {showLanding && (
        <LandingAnimation 
          onComplete={() => {
            setShowLanding(false);
            setShowRoleSelect(true);
          }}
          ollamaAvailable={ollamaAvailable}
        />
      )}
      
      {showRoleSelect && (
        <TerminalAgentSelector 
          onSelect={(role: 'recruiter' | 'collaborator') => {
            onRoleSelect?.(role);
            setShowRoleSelect(false);
            handleTerminalOpen();
          }}
          currentAgent={userRole || 'recruiter'}
        />
      )}
    </div>
  );
};

export default LinuxDesktop; 