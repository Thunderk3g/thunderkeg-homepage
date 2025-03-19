'use client';

import { useEffect, useState } from 'react';
import LandingAnimation from '@/components/landing/LandingAnimation';
import TerminalAgentSelector from '@/components/agents/TerminalAgentSelector';
import TerminalWindow from '@/components/ui/TerminalWindow';
import TerminalChat from '@/components/chat/TerminalChat';
import { checkOllamaAvailability } from '@/lib/ollama/client-helpers';

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

  // Check if Ollama is available
  useEffect(() => {
    const checkOllama = async () => {
      const available = await checkOllamaAvailability();
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
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-0 m-0 overflow-hidden bg-gray-950">
      {view === 'landing' && (
        <LandingAnimation onComplete={() => setView('roleSelect')} ollamaAvailable={true} />
      )}
      
      {view === 'roleSelect' && (
        <TerminalAgentSelector 
          onSelect={handleRoleSelect} 
          currentAgent={userRole || 'recruiter'} 
        />
      )}
      
      {view === 'terminals' && (
        <div className="relative w-full h-screen bg-gray-950">
          {/* Top Navigation Bar */}
          <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-700 px-4 py-2 z-50 flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={backToLanding}
                className="mr-4 text-gray-400 hover:text-white p-2 rounded hover:bg-gray-800 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Home
              </button>
              <button
                onClick={backToRoleSelect}
                className="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-800 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Change Role
              </button>
            </div>
            <div className="flex items-center">
              <span className="text-green-400 font-mono text-sm mr-2">
                {userRole === 'recruiter' ? 'Professional Mode' : 'Personal Mode'}
              </span>
              <button
                onClick={toggleVim}
                className={`px-2 py-1 rounded text-xs font-mono ${
                  vim ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                VIM: {vim ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Terminal Windows */}
          <div className="pt-12 px-4 pb-4 h-full">
            {Object.entries(terminals).map(([terminalId, terminal]) => {
              const activeTab = terminal.tabs.find(tab => tab.id === terminal.activeTabId);
              
              return (
                <TerminalWindow
                  key={terminalId}
                  title={activeTab?.title || 'Terminal'}
                  initialPosition={terminal.position}
                  initialSize={terminal.size}
                  zIndex={terminal.zIndex}
                  onClose={() => closeTerminal(terminalId)}
                  onToggleFullscreen={() => {}}
                  onFocus={() => focusTerminal(terminalId)}
                  isFocused={focusedTerminalId === terminalId}
                  id={terminalId}
                  tabs={terminal.tabs}
                  activeTabId={terminal.activeTabId}
                  onTabChange={(tabId) => changeActiveTab(terminalId, tabId)}
                  onTabClose={(tabId) => closeTab(terminalId, tabId)}
                  onNewTab={() => addTab(terminalId)}
                  userRole={terminal.role}
                >
                  {activeTab && (
                    <TerminalChat
                      agentType={activeTab.type}
                      chatId={activeTab.id}
                      vimModeEnabled={vim}
                      onToggleVimMode={toggleVim}
                      onSwitchAgent={backToRoleSelect}
                      onBackToLanding={backToLanding}
                    />
                  )}
                </TerminalWindow>
              );
            })}
          </div>
          
          {/* Add new terminal button */}
          <button
            onClick={addTerminal}
            className="fixed bottom-5 right-5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-lg transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Terminal
          </button>
          
          {/* Help tooltip */}
          <div className="fixed bottom-5 left-5">
            <div className="bg-gray-800 text-gray-300 p-3 rounded-md shadow-lg max-w-xs">
              <h4 className="text-green-400 text-sm font-bold mb-2">Terminal Tips:</h4>
              <ul className="text-xs space-y-1">
                <li>• Type "help" for available commands</li>
                <li>• Press "Tab" to switch between tabs</li>
                <li>• Use the + button to add more terminals</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
