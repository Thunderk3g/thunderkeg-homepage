'use client';

import { useEffect, useState } from 'react';
import LandingAnimation from '@/components/landing/LandingAnimation';
import TerminalAgentSelector from '@/components/agents/TerminalAgentSelector';
import TerminalWindow from '@/components/ui/TerminalWindow';
import TerminalChat from '@/components/chat/TerminalChat';
import React from 'react';
import dynamic from 'next/dynamic';
import { checkOllamaAvailability } from '@/lib/ollama/client-helpers';

// Dynamically import the LinuxDesktop component to prevent server-side rendering
const LinuxDesktop = dynamic(() => import('@/components/desktop/LinuxDesktop'), {
  ssr: false,
});

// Define user role type
type UserRole = 'recruiter' | 'collaborator';

// Define terminal interface
type TerminalTab = {
  id: string;
  title: string;
  type: UserRole;
};

type TerminalInstance = {
  tabs: TerminalTab[];
  activeTabId: string;
  role: UserRole;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
};

type TerminalsState = {
  [key: string]: TerminalInstance;
};

export default function Home() {
  const [view, setView] = useState<'landing' | 'roleSelect' | 'terminals'>('landing');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [terminals, setTerminals] = useState<TerminalsState>({});
  const [focusedTerminalId, setFocusedTerminalId] = useState<string | null>(null);
  const [vim, setVim] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  // Check if Ollama is available
  useEffect(() => {
    const checkOllama = async () => {
      const available = await checkOllamaAvailability();
      setOllamaAvailable(available);
      if (!available) {
        console.log('Ollama not available');
      }
    };
    
    checkOllama();
  }, []);
  
  // Load user preferences from localStorage
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    const savedTerminals = localStorage.getItem('terminals');
    
    if (savedRole) {
      setUserRole(savedRole as UserRole);
      setView('terminals');
    }
    
    if (savedTerminals) {
      try {
        setTerminals(JSON.parse(savedTerminals));
      } catch (error) {
        console.error('Failed to parse saved terminals:', error);
      }
    }
  }, []);
  
  // Save terminals and user role when they change
  useEffect(() => {
    if (userRole) {
      localStorage.setItem('userRole', userRole);
    }
    
    if (Object.keys(terminals).length > 0) {
      localStorage.setItem('terminals', JSON.stringify(terminals));
    }
  }, [terminals, userRole]);
  
  // Function to calculate a new terminal position with an offset
  const getNewTerminalPosition = () => {
    const terminalCount = Object.keys(terminals).length;
    return {
      x: terminalCount * 30 + 100,
      y: terminalCount * 30 + 100
    };
  };
  
  // Manage role-specific tabs
  const getTabsForRole = (role: UserRole) => {
    if (role === 'recruiter') {
      return [
        { id: `professional-${Date.now()}`, title: 'Professional', type: 'recruiter' as const }
      ];
    } else {
      return [
        { id: `personal-${Date.now()}`, title: 'Personal', type: 'collaborator' as const }
      ];
    }
  };
  
  // Toggle Vim mode
  const toggleVim = () => {
    setVim(prev => !prev);
  };
  
  // Function to handle user role selection
  const handleRoleSelect = (role: UserRole) => {
    setUserRole(role);
    setView('terminals');
    
    // Create initial terminal with appropriate tabs
    const position = getNewTerminalPosition();
    const tabs = getTabsForRole(role);
    
    setTerminals({
      [`terminal-${Date.now()}`]: {
        tabs,
        activeTabId: tabs[0].id,
        role,
        position,
        size: { width: 650, height: 500 },
        zIndex: 1
      }
    });
  };
  
  // Add a new terminal
  const addTerminal = () => {
    if (!userRole) return;
    
    const position = getNewTerminalPosition();
    const tabs = getTabsForRole(userRole);
    
    setTerminals(prev => {
      const terminalId = `terminal-${Date.now()}`;
      return {
        ...prev,
        [terminalId]: {
          tabs,
          activeTabId: tabs[0].id,
          role: userRole,
          position,
          size: { width: 650, height: 500 },
          zIndex: Object.keys(prev).length + 1
        }
      };
    });
  };
  
  // Add a new tab to a terminal
  const addTab = (terminalId: string) => {
    setTerminals(prev => {
      const terminal = prev[terminalId];
      if (!terminal) return prev;
      
      const tabType = terminal.role === 'recruiter' ? 'recruiter' : 'collaborator';
      const tabPrefix = terminal.role === 'recruiter' ? 'professional' : 'personal';
      const tabCount = terminal.tabs.length + 1;
      
      const newTab = {
        id: `${tabPrefix}-${Date.now()}`,
        title: `${tabType === 'recruiter' ? 'Professional' : 'Personal'} ${tabCount}`,
        type: tabType as UserRole
      };
      
      return {
        ...prev,
        [terminalId]: {
          ...terminal,
          tabs: [...terminal.tabs, newTab],
          activeTabId: newTab.id
        }
      };
    });
  };
  
  // Change active tab in a terminal
  const changeActiveTab = (terminalId: string, tabId: string) => {
    setTerminals(prev => {
      const terminal = prev[terminalId];
      if (!terminal) return prev;
      
      return {
        ...prev,
        [terminalId]: {
          ...terminal,
          activeTabId: tabId
        }
      };
    });
  };
  
  // Close a tab in a terminal
  const closeTab = (terminalId: string, tabId: string) => {
    setTerminals(prev => {
      const terminal = prev[terminalId];
      if (!terminal || terminal.tabs.length <= 1) return prev;
      
      const newTabs = terminal.tabs.filter(tab => tab.id !== tabId);
      let newActiveTabId = terminal.activeTabId;
      
      // If we're closing the active tab, activate another one
      if (terminal.activeTabId === tabId) {
        newActiveTabId = newTabs[0].id;
      }
      
      return {
        ...prev,
        [terminalId]: {
          ...terminal,
          tabs: newTabs,
          activeTabId: newActiveTabId
        }
      };
    });
  };
  
  // Focus a terminal (bring to front)
  const focusTerminal = (terminalId: string) => {
    setFocusedTerminalId(terminalId);
    
    setTerminals(prev => {
      // Find the highest zIndex
      const highestZ = Math.max(...Object.values(prev).map(t => t.zIndex));
      
      // Only update if this terminal isn't already at the top
      if (prev[terminalId]?.zIndex < highestZ) {
        return {
          ...prev,
          [terminalId]: {
            ...prev[terminalId],
            zIndex: highestZ + 1
          }
        };
      }
      
      return prev;
    });
  };
  
  // Close a terminal
  const closeTerminal = (terminalId: string) => {
    setTerminals(prev => {
      const newTerminals = { ...prev };
      delete newTerminals[terminalId];
      
      // If we're closing the focused terminal, clear the focus
      if (focusedTerminalId === terminalId) {
        setFocusedTerminalId(null);
      }
      
      return newTerminals;
    });
  };
  
  // Go back to role selection
  const backToRoleSelect = () => {
    setView('roleSelect');
  };
  
  // Go back to landing
  const backToLanding = () => {
    setView('landing');
    setUserRole(null);
    setTerminals({});
  };
  
  // Render active terminal for LinuxDesktop
  const renderActiveTerminal = () => {
    if (Object.keys(terminals).length === 0) return null;
    
    // Find the terminal with the highest z-index
    const terminalId = focusedTerminalId || Object.keys(terminals)[0];
    const terminal = terminals[terminalId];
    
    if (!terminal) return null;
    
    const activeTab = terminal.tabs.find(tab => tab.id === terminal.activeTabId);
    
    if (!activeTab) return null;
    
    return (
      <TerminalChat
        agentType={activeTab.type}
        chatId={activeTab.id}
        vimModeEnabled={vim}
        onToggleVimMode={toggleVim}
        onSwitchAgent={backToRoleSelect}
        onBackToLanding={backToLanding}
      />
    );
  };
  
  // Function to handle switching agent without going back to landing
  const switchAgent = () => {
    if (!userRole) return;
    
    // Toggle between recruiter and collaborator
    const newRole: UserRole = userRole === 'recruiter' ? 'collaborator' : 'recruiter';
    setUserRole(newRole);
    
    // Update all terminals with the new role
    setTerminals(prev => {
      const updatedTerminals: TerminalsState = {};
      
      Object.keys(prev).forEach(terminalId => {
        const terminal = prev[terminalId];
        const newTabs = terminal.tabs.map(tab => ({
          ...tab,
          type: newRole,
          title: newRole === 'recruiter' ? 'Professional' : 'Personal'
        }));
        
        updatedTerminals[terminalId] = {
          ...terminal,
          tabs: newTabs,
          activeTabId: newTabs[0].id,
          role: newRole
        };
      });
      
      return updatedTerminals;
    });
  };
  
  // Function to handle landing animation completion
  const handleLandingComplete = () => {
    setView('roleSelect');
  };
  
  return (
    <main className="h-screen w-full overflow-hidden">
      {view === 'landing' && (
        <LandingAnimation 
          onComplete={handleLandingComplete} 
          ollamaAvailable={ollamaAvailable} 
        />
      )}
      
      {view === 'roleSelect' && (
        <TerminalAgentSelector 
          onSelect={handleRoleSelect} 
          currentAgent={userRole || 'recruiter'} 
        />
      )}
      
      <LinuxDesktop 
        initialView={view}
        onViewChange={setView}
        userRole={userRole}
        onRoleSelect={handleRoleSelect}
        renderActiveTerminal={renderActiveTerminal}
        ollamaAvailable={ollamaAvailable}
      />
    </main>
  );
}
