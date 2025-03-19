'use client';

import React, { useState, ReactNode, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import TerminalTabs, { Tab } from './TerminalTabs';

interface TerminalWindowProps {
  title?: string;
  children: ReactNode;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  onClose?: () => void;
  onToggleFullscreen?: () => void;
  zIndex?: number;
  onFocus?: () => void;
  isFocused?: boolean;
  id?: string;
  tabs?: Tab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onNewTab?: () => void;
  userRole?: 'recruiter' | 'collaborator' | null;
}

const TerminalWindow: React.FC<TerminalWindowProps> = ({
  title = 'Terminal',
  children,
  initialPosition = { x: 0, y: 0 },
  initialSize = { width: 800, height: 600 },
  onClose,
  onToggleFullscreen,
  zIndex = 10,
  onFocus,
  isFocused = false,
  id = 'terminal',
  tabs = [],
  activeTabId,
  onTabChange,
  onTabClose,
  onNewTab,
  userRole,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragConstraintsRef = useRef<HTMLDivElement>(null);
  const resizeStartPos = useRef<{ x: number, y: number } | null>(null);
  const resizeStartSize = useRef<{ width: number, height: number } | null>(null);
  const prevPosition = useRef<{ x: number, y: number } | null>(null);
  const prevSize = useRef<{ width: number, height: number } | null>(null);

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    
    if (isMaximized) {
      // Restore to previous size and position
      if (prevPosition.current && prevSize.current) {
        setPosition(prevPosition.current);
        setSize(prevSize.current);
      } else {
        setPosition(initialPosition);
        setSize(initialSize);
      }
    } else {
      // Save current position and size before maximizing
      prevPosition.current = position;
      prevSize.current = size;
      
      // Calculate safe viewport dimensions accounting for UI elements and padding
      const navbarHeight = 48; // Height of the top navigation bar
      const margin = 16; // Margin to maintain around the edges
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Set to maximum size with safe margins, ensuring it doesn't exceed viewport
      setSize({ 
        width: Math.min(viewportWidth - (margin * 2), 1600), // Cap at 1600px or viewport width - margins
        height: Math.min(viewportHeight - navbarHeight - (margin * 2), 900) // Cap at 900px or viewport height - navbar - margins
      });
      
      // Center the terminal in the viewport
      setPosition({
        x: margin,
        y: navbarHeight + margin
      });
    }
    
    // Call the provided onToggleFullscreen callback if it exists
    if (onToggleFullscreen) {
      onToggleFullscreen();
    }
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: size.width, height: size.height };
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing && resizeStartPos.current && resizeStartSize.current) {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      
      const newSize = { ...size };
      
      if (resizeDirection?.includes('e')) {
        newSize.width = Math.max(300, resizeStartSize.current.width + deltaX);
      }
      if (resizeDirection?.includes('s')) {
        newSize.height = Math.max(200, resizeStartSize.current.height + deltaY);
      }
      if (resizeDirection?.includes('w')) {
        const widthDelta = -deltaX;
        newSize.width = Math.max(300, resizeStartSize.current.width + widthDelta);
        if (containerRef.current) {
          setPosition(prev => ({
            ...prev,
            x: prev.x - widthDelta
          }));
        }
      }
      if (resizeDirection?.includes('n')) {
        const heightDelta = -deltaY;
        newSize.height = Math.max(200, resizeStartSize.current.height + heightDelta);
        if (containerRef.current) {
          setPosition(prev => ({
            ...prev,
            y: prev.y - heightDelta
          }));
        }
      }
      
      setSize(newSize);
    }
  }, [isResizing, resizeDirection, size]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
    resizeStartPos.current = null;
    resizeStartSize.current = null;
  }, []);

  // Focus handling
  const handleWindowClick = () => {
    if (onFocus && !isFocused) {
      onFocus();
    }
  };
  
  // Handle tab close
  const handleTabClose = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTabClose) {
      onTabClose(tabId);
    }
  };

  // Set up event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      // Change cursor based on resize direction
      if (document.body) {
        if (resizeDirection === 'e' || resizeDirection === 'w') {
          document.body.style.cursor = 'ew-resize';
        } else if (resizeDirection === 's' || resizeDirection === 'n') {
          document.body.style.cursor = 'ns-resize';
        } else if (resizeDirection === 'se' || resizeDirection === 'nw') {
          document.body.style.cursor = 'nwse-resize';
        } else if (resizeDirection === 'sw' || resizeDirection === 'ne') {
          document.body.style.cursor = 'nesw-resize';
        }
      }
    } else {
      if (document.body) {
        document.body.style.cursor = '';
      }
    }
    
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      if (document.body) {
        document.body.style.cursor = '';
      }
    };
  }, [isResizing, handleResizeMove, handleResizeEnd, resizeDirection]);

  return (
    <div ref={dragConstraintsRef} className="relative w-full h-full">
      <motion.div
        ref={containerRef}
        drag={!isMaximized && !isResizing}
        dragMomentum={false}
        dragConstraints={dragConstraintsRef}
        dragElastic={0}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        onClick={handleWindowClick}
        className={`bg-gray-900 border rounded-lg shadow-2xl backdrop-blur-sm ${
          isMaximized
            ? 'fixed z-50 max-w-[calc(100vw-32px)] max-h-[calc(100vh-80px)]'
            : isMinimized
            ? 'w-64 h-12 overflow-hidden'
            : ''
        } ${isDragging ? 'cursor-grabbing' : ''} ${isFocused ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-700 ring-1 ring-gray-700'}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          zIndex: isFocused ? zIndex + 10 : zIndex,
          width: isMaximized 
            ? 'calc(100vw - 32px)' 
            : isMinimized 
              ? 'auto' 
              : size.width,
          height: isMaximized 
            ? 'calc(100vh - 80px)' 
            : isMinimized 
              ? 48 
              : size.height
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        style={{
          position: isMaximized ? 'fixed' : 'absolute',
          left: isMaximized ? '16px' : position.x,
          top: isMaximized ? '64px' : position.y,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'hidden'
        }}
        layout
        id={id}
      >
        {/* Terminal header with controls */}
        <div 
          ref={dragRef}
          className={`terminal-handle flex items-center justify-between px-4 py-3 border-b cursor-grab active:cursor-grabbing ${
            isFocused 
              ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-600' 
              : 'bg-gradient-to-r from-gray-900 to-gray-950 border-gray-800'
          }`}
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center">
            <div className="flex space-x-2 mr-4">
              <button 
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-1 focus:ring-offset-gray-800 flex items-center justify-center group"
                title="Close"
                aria-label="Close terminal"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-2 w-2 text-red-800 opacity-0 group-hover:opacity-100 transition-opacity" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <button 
                onClick={handleMinimize}
                className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-1 focus:ring-offset-gray-800 flex items-center justify-center group"
                title={isMinimized ? "Expand" : "Minimize"}
                aria-label={isMinimized ? "Expand terminal" : "Minimize terminal"}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-2 w-2 text-yellow-800 opacity-0 group-hover:opacity-100 transition-opacity" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5 10a1 1 0 01.707.293l4 4a1 1 0 01-1.414 1.414L5 12.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4A1 1 0 015 10z" clipRule="evenodd" />
                </svg>
              </button>
              <button 
                onClick={handleMaximize}
                className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-1 focus:ring-offset-gray-800 flex items-center justify-center group"
                title={isMaximized ? "Restore" : "Maximize"}
                aria-label={isMaximized ? "Restore terminal size" : "Maximize terminal"}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-2 w-2 text-green-800 opacity-0 group-hover:opacity-100 transition-opacity" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  {isMaximized ? (
                    <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H5zm5 12h5a1 1 0 001-1V6a1 1 0 00-1-1h-5a1 1 0 00-1 1v10a1 1 0 001 1z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  )}
                </svg>
              </button>
            </div>
            <span className={`font-medium select-none tracking-tight ${isFocused ? 'text-gray-300' : 'text-gray-500'}`}>
              {title}
            </span>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleMinimize}
              className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-colors focus:outline-none"
              title={isMinimized ? "Expand" : "Minimize"}
              aria-label={isMinimized ? "Expand terminal" : "Minimize terminal"}
            >
              <Minimize2 size={16} />
            </button>
            <button
              onClick={handleMaximize}
              className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-colors focus:outline-none"
              title={isMaximized ? "Restore" : "Maximize"}
              aria-label={isMaximized ? "Restore terminal size" : "Maximize terminal"}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-700/50 transition-colors focus:outline-none"
              title="Close"
              aria-label="Close terminal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Terminal tabs (if available) */}
        {tabs.length > 0 && !isMinimized && (
          <TerminalTabs
            tabs={tabs}
            activeTabId={activeTabId || tabs[0].id}
            onTabClick={onTabChange || (() => {})}
            onTabClose={handleTabClose}
            onNewTab={onNewTab || (() => {})}
          />
        )}

        {/* Terminal content */}
        <div className={`h-full ${isMinimized ? 'hidden' : 'block'}`}>
          {children}
        </div>
        
        {/* Resize handles (only when not maximized or minimized) */}
        {!isMaximized && !isMinimized && (
          <>
            {/* East resize handle */}
            <div 
              className="absolute top-0 right-0 w-2 h-full cursor-ew-resize" 
              onMouseDown={(e) => handleResizeStart(e, 'e')}
            />
            
            {/* South resize handle */}
            <div 
              className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize" 
              onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            
            {/* Southeast corner resize handle */}
            <div 
              className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize" 
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            >
              <div className="absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 border-gray-500 opacity-50" />
            </div>
            
            {/* West resize handle */}
            <div 
              className="absolute top-0 left-0 w-2 h-full cursor-ew-resize" 
              onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            
            {/* North resize handle */}
            <div 
              className="absolute top-0 left-0 w-full h-2 cursor-ns-resize" 
              onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            
            {/* Southwest corner resize handle */}
            <div 
              className="absolute bottom-0 left-0 w-6 h-6 cursor-nesw-resize" 
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            
            {/* Northeast corner resize handle */}
            <div 
              className="absolute top-0 right-0 w-6 h-6 cursor-nesw-resize" 
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            
            {/* Northwest corner resize handle */}
            <div 
              className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize" 
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
          </>
        )}
      </motion.div>
    </div>
  );
};

export default TerminalWindow; 