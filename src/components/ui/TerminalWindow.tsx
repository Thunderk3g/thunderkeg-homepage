'use client';

import React, { useState, ReactNode, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Minimize2, Maximize2, Keyboard } from 'lucide-react';
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
  vimModeEnabled?: boolean;
  agentType?: 'recruiter' | 'collaborator';
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
  vimModeEnabled = false,
  agentType = 'recruiter'
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
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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
    onFocus?.();
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
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
    document.body.style.userSelect = '';
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

  // Handle window dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    onFocus?.();
    
    // Check if target is the header and not a control button
    const target = e.target as HTMLElement;
    if (
      target.closest('.window-controls') ||
      target.closest('.vim-indicator') ||
      target.closest('.agent-indicator')
    ) {
      return;
    }
    
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
    
    // Prevent text selection during drag
    e.preventDefault();
  };
  
  // Global mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle dragging
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      
      // Handle resizing
      if (isResizing) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Minimum size
        const minWidth = 300;
        const minHeight = 200;
        
        // Calculate new size based on resize direction
        if (resizeDirection?.includes('e')) {
          const newWidth = Math.max(minWidth, e.clientX - rect.left);
          setSize(prev => ({ ...prev, width: newWidth }));
        }
        if (resizeDirection?.includes('s')) {
          const newHeight = Math.max(minHeight, e.clientY - rect.top);
          setSize(prev => ({ ...prev, height: newHeight }));
        }
        if (resizeDirection?.includes('w')) {
          const newWidth = Math.max(minWidth, rect.right - e.clientX);
          setSize(prev => ({ ...prev, width: newWidth }));
          setPosition(prev => ({ ...prev, x: e.clientX }));
        }
        if (resizeDirection?.includes('n')) {
          const newHeight = Math.max(minHeight, rect.bottom - e.clientY);
          setSize(prev => ({ ...prev, height: newHeight }));
          setPosition(prev => ({ ...prev, y: e.clientY }));
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      document.body.style.userSelect = '';
    };
    
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeDirection]);

  return (
    <div ref={dragConstraintsRef} className="relative w-full h-full">
      <motion.div
        ref={containerRef}
        drag={!isMaximized && !isResizing}
        dragMomentum={false}
        dragConstraints={dragConstraintsRef}
        dragElastic={0}
        onDragStart={() => {
          setIsDragging(true);
          onFocus?.();
        }}
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
          className={`${isFocused ? 'bg-gray-800' : 'bg-gray-900'} px-3 py-2 flex items-center justify-between transition-colors`}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {/* Window title and controls */}
          <div className="window-controls flex items-center space-x-2">
            <button 
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
              onClick={onClose}
            >
              {isMaximized && <X size={8} className="mx-auto" />}
            </button>
            <button 
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors"
              onClick={handleMinimize}
            >
              {isMaximized && <Minimize2 size={8} className="mx-auto" />}
            </button>
            <button 
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
              onClick={handleMaximize}
            >
              {isMaximized && <Maximize2 size={8} className="mx-auto" />}
            </button>
          </div>
          
          {/* Window title with vim mode and agent indicators */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2">
            <span className="text-xs text-gray-300 font-medium truncate max-w-[150px]">
              {title}
            </span>
            
            {/* Vim mode indicator */}
            {vimModeEnabled && (
              <div className="vim-indicator px-1.5 py-0.5 bg-purple-700/50 rounded text-xs text-purple-200 font-bold flex items-center space-x-1">
                <Keyboard size={10} />
                <span>VIM</span>
              </div>
            )}
            
            {/* Agent indicator */}
            {agentType && (
              <div 
                className={`agent-indicator px-1.5 py-0.5 rounded text-xs font-bold flex items-center
                  ${agentType === 'recruiter' 
                    ? 'bg-blue-700/50 text-blue-200' 
                    : 'bg-green-700/50 text-green-200'
                  }`}
              >
                <span>{agentType === 'recruiter' ? 'PRO' : 'PER'}</span>
              </div>
            )}
          </div>
          
          {/* Empty space to balance the title */}
          <div className="invisible window-controls flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" />
            <div className="w-3 h-3 rounded-full" />
            <div className="w-3 h-3 rounded-full" />
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