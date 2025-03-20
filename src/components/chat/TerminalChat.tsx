'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { useVimKeybindings } from '@/lib/utils/vimKeybindings';
import { Terminal, Command, Keyboard, Cpu, Clock, Bookmark, History, Lightbulb } from 'lucide-react';
import { Trash as TrashIcon } from 'lucide-react';
import ModelSelector from '@/components/ui/ModelSelector';
import PromptSuggestions from '@/components/ui/PromptSuggestions';
import { getOllamaModels, sendChatMessage, streamChatMessage } from '@/lib/ollama/client-helpers';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  fallback?: boolean;
};

type TerminalChatProps = {
  agentType: 'recruiter' | 'collaborator';
  chatId?: string;
  onSwitchAgent?: () => void;
  vimModeEnabled?: boolean;
  onToggleVimMode?: () => void;
  onBackToLanding?: () => void;
};

// Memoized message component for better performance and improved styling
// Add a formatter function to improve message display
const formatMessageContent = (content: string) => {
  // Add formatting for code blocks
  const formattedWithCodeBlocks = content.replace(
    /```([a-zA-Z]*)\n([\s\S]*?)\n```/g, 
    (_, language, code) => {
      return `<div class="bg-gray-900 rounded-md my-2 p-3 overflow-x-auto">
        <pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </div>`;
    }
  );
  
  // Add formatting for bullet points
  const formattedWithBullets = formattedWithCodeBlocks.replace(
    /^- (.*?)$/gm,
    '<div class="flex items-start my-1"><span class="mr-2 text-blue-400">•</span>$1</div>'
  );
  
  // Add formatting for numbered lists
  const formattedWithNumbers = formattedWithBullets.replace(
    /^(\d+)\. (.*?)$/gm,
    '<div class="flex items-start my-1"><span class="mr-2 text-blue-400">$1.</span>$2</div>'
  );
  
  // Add paragraph spacing
  return formattedWithNumbers.replace(/\n\n/g, '<div class="h-2"></div>');
};

const ChatMessage = memo(({ message }: { message: Message }) => {
  return message.role === 'user' ? (
    <div className="flex items-start mb-6 px-2">
      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
        <Terminal size={18} className="text-white" />
      </div>
      <div className="bg-blue-900/30 rounded-lg px-5 py-4 text-white max-w-[85%] text-[15px] leading-relaxed">
        {message.content}
      </div>
    </div>
  ) : (
    <div className="flex items-start mb-6 px-2">
      <div className={`w-10 h-10 rounded-full ${message.fallback ? 'bg-yellow-600' : 'bg-green-600'} flex items-center justify-center mr-3 flex-shrink-0`}>
        <Command size={18} className="text-white" />
      </div>
      <div 
        className={`${message.fallback ? 'bg-yellow-900/30' : 'bg-gray-800'} rounded-lg px-5 py-4 ${message.fallback ? 'text-yellow-300' : 'text-gray-200'} max-w-[85%] text-[15px] leading-relaxed`}
        style={{ whiteSpace: 'pre-wrap' }}
        dangerouslySetInnerHTML={{ 
          __html: message.fallback 
            ? message.content 
            : formatMessageContent(message.content)
        }}
      />
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default function TerminalChat({ 
  agentType, 
  chatId = `chat-${Date.now()}`,
  onSwitchAgent,
  vimModeEnabled = true,
  onToggleVimMode,
  onBackToLanding,
}: TerminalChatProps) {
  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState<'normal' | 'insert'>(vimModeEnabled ? 'normal' : 'insert');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedModel, setSelectedModel] = useState('llama3:latest');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Welcome to the ${
        agentType === 'recruiter' ? 'Professional' : 'Personal'
      } Terminal v1.0.0\n\nType 'help' for available commands or start asking questions.`
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [chatSessions, setChatSessions] = useState<{id: string, name: string, preview: string, timestamp: number, agentType: 'recruiter' | 'collaborator' }[]>([]);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastStatusCheckRef = useRef<number>(0);
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update the virtualization setup to account for the new message styling
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: (index: number) => {
      // Better estimation for the new message styling
      const message = messages[index];
      const content = message.content;
      const isCode = content.includes('```');
      const numLines = content.split('\n').length;
      const charsPerLine = 50; // Reduced from 60 due to the new styling
      const baseHeight = 80; // Base height for avatar and padding
      
      if (isCode) {
        // Code blocks take up more space
        return baseHeight + Math.max(numLines * 24, Math.ceil(content.length / charsPerLine) * 24);
      }
      
      // Regular messages
      return baseHeight + Math.ceil(content.length / charsPerLine) * 24;
    },
    overscan: 10,
  });
  
  // Update storageKey to use chatId for more precise storage
  const chatStorageKey = `messages-${chatId}`;
  const sessionsStorageKey = `chatSessions-${agentType}`;
  
  // Load chat history from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem(sessionsStorageKey);
    if (savedSessions) {
      setChatSessions(JSON.parse(savedSessions));
    }
    
    const currentSessionMessages = localStorage.getItem(chatStorageKey);
    if (currentSessionMessages) {
      const parsedMessages = JSON.parse(currentSessionMessages);
      if (parsedMessages.length > 0) {
        setMessages(parsedMessages);
      }
    } else {
      // Create a new session in storage
      saveChatSession();
    }
    
    // Load saved model preference
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, [agentType, chatId, chatStorageKey, sessionsStorageKey]);
  
  // Save current chat session whenever messages change
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages));
      saveChatSession();
    }
  }, [messages, chatId, chatStorageKey]);
  
  // Create or update the current chat session in the sessions list
  const saveChatSession = () => {
    // Get the last user message for preview
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const preview = lastUserMessage.length > 30 ? lastUserMessage.substring(0, 30) + '...' : lastUserMessage;
    const sessionName = preview || `New ${agentType === 'recruiter' ? 'Professional' : 'Personal'} Chat`;
    
    const updatedSession = {
      id: chatId,
      name: sessionName,
      preview: preview || 'Start a new conversation...',
      timestamp: Date.now(),
      agentType
    };
    
    setChatSessions(prev => {
      const existingIndex = prev.findIndex(s => s.id === chatId);
      let updatedSessions;
      
      if (existingIndex >= 0) {
        // Update existing session
        updatedSessions = [...prev];
        updatedSessions[existingIndex] = updatedSession;
      } else {
        // Add new session
        updatedSessions = [...prev, updatedSession];
      }
      
      // Sort by most recent
      updatedSessions.sort((a, b) => b.timestamp - a.timestamp);
      
      // Save to localStorage
      localStorage.setItem(sessionsStorageKey, JSON.stringify(updatedSessions));
      
      return updatedSessions;
    });
  };
  
  // Load a specific chat session
  const loadChatSession = (sessionId: string) => {
    const sessionMessages = localStorage.getItem(`messages-${sessionId}`);
    if (sessionMessages) {
      setMessages(JSON.parse(sessionMessages));
    }
    setShowHistorySidebar(false);
  };
  
  // Create a new chat session
  const createNewSession = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Welcome to the ${
          agentType === 'recruiter' ? 'Professional' : 'Personal'
        } Terminal v1.0.0\n\nType 'help' for available commands or start asking questions.`
      },
    ]);
    setShowHistorySidebar(false);
  };
  
  // Delete a chat session
  const deleteChatSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setChatSessions(prev => {
      const updatedSessions = prev.filter(s => s.id !== sessionId);
      localStorage.setItem(sessionsStorageKey, JSON.stringify(updatedSessions));
      return updatedSessions;
    });
    
    // Remove the messages from localStorage
    localStorage.removeItem(`messages-${sessionId}`);
    
    // If we're deleting the current session, create a new one
    if (sessionId === chatId) {
      createNewSession();
    }
  };
  
  // Update input mode when vim mode is toggled
  useEffect(() => {
    setInputMode(vimModeEnabled ? 'normal' : 'insert');
    if (!vimModeEnabled) {
      inputRef.current?.focus();
    }
  }, [vimModeEnabled]);
  
  // Load available models on mount and set up an interval check
  useEffect(() => {
    const checkOllamaStatus = async () => {
      const now = Date.now();
      // Only check if it's been at least 15 seconds since the last check
      if (now - lastStatusCheckRef.current < 15000) {
        return;
      }
      
      if (isCheckingStatus) return;
      
      setIsCheckingStatus(true);
      try {
        const models = await getOllamaModels();
        setAvailableModels(models);
        
        if (models.length > 0 && !models.includes(selectedModel)) {
          setSelectedModel(models[0]);
        }
        
        // Update the last check timestamp
        lastStatusCheckRef.current = now;
      } catch (error) {
        console.error("Failed to load models:", error);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    // Initial check
    checkOllamaStatus();
    
    // Set up interval for periodic checks (every 30 seconds)
    statusCheckIntervalRef.current = setInterval(checkOllamaStatus, 30000);
    
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []); // Empty dependency array - only run on mount
  
  // Vim keybindings setup - only active when vimModeEnabled is true
  const { handleKeyDown } = useVimKeybindings({
    onEscape: () => vimModeEnabled && setInputMode('normal'),
    onInsertMode: () => {
      if (vimModeEnabled) {
        setInputMode('insert');
        inputRef.current?.focus();
      }
    },
    onHistoryUp: () => {
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    },
    onHistoryDown: () => {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    },
  });
  
  // Handle special commands
  const handleSpecialCommands = (command: string): boolean => {
    const commandLower = command.toLowerCase().trim();
    
    if (commandLower === 'clear' || commandLower === 'cls') {
      setMessages([{
        role: 'assistant',
        content: `Terminal cleared. Type 'help' for available commands.`,
      }]);
      return true;
    }
    
    if (commandLower === 'help') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'help'
      }, {
        role: 'assistant',
        content: `Available commands:
- clear/cls: Clear terminal history
- help: Show this help message
- switch: Switch to ${agentType === 'recruiter' ? 'personal' : 'professional'} agent
- vim: ${vimModeEnabled ? 'Disable' : 'Enable'} Vim keybindings mode
- about: Show information about this terminal
- model: Show currently selected Ollama model
- home: Return to landing page
- history: Toggle chat history sidebar
- new: Start a new chat session
- Any other text will be treated as a question to the AI assistant`
      }]);
      return true;
    }
    
    if (commandLower === 'history') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'history'
      }, {
        role: 'assistant',
        content: `${showHistorySidebar ? 'Hiding' : 'Showing'} chat history sidebar...`
      }]);
      setShowHistorySidebar(!showHistorySidebar);
      return true;
    }
    
    if (commandLower === 'new') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'new'
      }, {
        role: 'assistant',
        content: 'Starting a new chat session...'
      }]);
      
      setTimeout(() => {
        createNewSession();
      }, 300);
      return true;
    }
    
    if (commandLower === 'switch') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'switch'
      }, {
        role: 'assistant',
        content: `Switching to ${agentType === 'recruiter' ? 'Personal' : 'Professional'} Terminal...`
      }]);
      // Signal to parent to switch agent
      if (onSwitchAgent) {
        setTimeout(() => {
          onSwitchAgent();
        }, 500);
      }
      return true;
    }
    
    if (commandLower === 'vim') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'vim'
      }, {
        role: 'assistant',
        content: `${vimModeEnabled ? 'Disabling' : 'Enabling'} Vim keybindings mode...`
      }]);
      
      if (onToggleVimMode) {
        setTimeout(() => {
          onToggleVimMode();
        }, 300);
      }
      return true;
    }
    
    if (commandLower === 'about') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'about'
      }, {
        role: 'assistant',
        content: `Terminal AI Assistant v1.0.0
- Running on Ollama with local RAG integration
- Connected to personal resume database
- Created as part of AI-powered portfolio project
- ${vimModeEnabled ? 'Uses Vim-inspired keybindings (press \'i\' for insert mode, \'Esc\' for normal mode)' : 'Standard input mode - Vim mode can be enabled with the \'vim\' command'}`
      }]);
      return true;
    }
    
    if (commandLower === 'model') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'model'
      }, {
        role: 'assistant',
        content: `Current model: ${selectedModel}
You can change the model using the dropdown selector in the terminal toolbar.`
      }]);
      return true;
    }
    
    if (commandLower === 'home' || commandLower === 'landing' || commandLower === 'back') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: commandLower
      }, {
        role: 'assistant',
        content: 'Returning to landing page...'
      }]);
      
      if (onBackToLanding) {
        setTimeout(() => {
          onBackToLanding();
        }, 500);
      }
      return true;
    }
    
    return false;
  };
  
  // Handle form submission with optimized API calls
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Add to command history
    setCommandHistory(prev => [...prev, input]);
    setHistoryIndex(-1);
    
    // Check for special commands
    if (handleSpecialCommands(input)) {
      setInput('');
      return;
    }
    
    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input and set loading
    setInput('');
    setIsLoading(true);
    
    try {
      // Prepare messages for API
      const apiMessages = messages
        .filter(m => m.role !== 'system') // Filter out system messages
        .concat(userMessage)
        .map(({ role, content }) => ({
          role,
          content,
        }));
      
      // Add empty assistant message to start streaming
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '' 
      }]);
      
      // Use streaming API
      await streamChatMessage(
        apiMessages,
        selectedModel,
        agentType,
        (chunk) => {
          // Update the last message with new content
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            newMessages[newMessages.length - 1] = {
              ...lastMessage,
              content: lastMessage.content + chunk
            };
            return newMessages;
          });
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      // Update the last message with error content
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: `Error: Terminal connection failed. ${error instanceof Error ? error.message : 'Please try again.'}`,
          fallback: true
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Auto-focus input on mount and when not in vim normal mode
  useEffect(() => {
    if (!vimModeEnabled || inputMode === 'insert') {
      inputRef.current?.focus();
    }
  }, [inputMode, vimModeEnabled]);
  
  // Global key events for Vim-like keybindings - only when vimModeEnabled
  useEffect(() => {
    if (!vimModeEnabled) return;
    
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // Only handle if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Convert DOM KeyboardEvent to React's synthetic event format expected by handleKeyDown
      const syntheticEvent = {
        key: e.key,
        code: e.code,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
        target: e.target,
      } as React.KeyboardEvent<Element>;
      
      handleKeyDown(syntheticEvent);
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [vimModeEnabled, handleKeyDown]);
  
  // Handle model selection
  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('selectedModel', model);
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      // Delay to ensure DOM has updated
      setTimeout(() => {
        messagesContainerRef.current?.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 50);
    }
  }, [messages.length, streamingMessage]);
  
  useEffect(() => {
    // Auto-focus the input field when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Ensure messages are visible by scrolling to bottom
    scrollToBottom();
  }, []);

  // Add a welcome message effect to display immediate content
  useEffect(() => {
    // Display a helpful guide message after a short delay
    const timer = setTimeout(() => {
      if (messages.length <= 1) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Here are some commands to get started:
- Type 'help' for a list of available commands
- Type 'about' to learn more about me
- Type 'projects' to see my portfolio
- Type 'skills' to view my technical skills
- Type 'contact' for contact information

Feel free to ask any questions about my experience or background!`
          }
        ]);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [messages.length]);

  // Ensure auto-scrolling whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);
  
  const modelOptions = availableModels.map(model => ({ value: model, label: model }));
  
  // Function to scroll to the bottom of the messages container
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end' 
      });
    }
  };
  
  return (
    <div className="w-full h-full flex">
      {/* Chat History Sidebar */}
      <div className={`h-full bg-gray-900 border-r border-gray-700 ${
        showHistorySidebar ? 'w-64' : 'w-0'
      } transition-all duration-300 overflow-hidden`}>
        <div className="p-3 border-b border-gray-700 bg-gray-800 sticky top-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center">
              <History size={14} className="mr-1.5" />
              Chat History
            </h3>
            <button 
              onClick={createNewSession}
              className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
              title="New chat"
            >
              + New
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto h-[calc(100%-42px)]">
          {chatSessions.filter(s => s.agentType === agentType).length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No chat history yet
            </div>
          ) : (
            chatSessions
              .filter(s => s.agentType === agentType)
              .map(session => (
                <div 
                  key={session.id}
                  onClick={() => loadChatSession(session.id)}
                  className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${
                    chatId === session.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-xs text-gray-400">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </p>
                      <h4 className="text-sm font-medium text-gray-300 truncate">
                        {session.name}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {session.preview}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteChatSession(session.id, e)}
                      className="text-gray-500 hover:text-red-500 p-1 rounded-full"
                      title="Delete session"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
      
      {/* Terminal Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className={`p-1.5 rounded-md hover:bg-gray-700 transition-colors ${
                showHistorySidebar ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
              }`}
              title="Toggle chat history"
            >
              <History size={16} />
            </button>
            <ModelSelector 
              availableModels={availableModels}
              selectedModel={selectedModel}
              onSelect={handleModelSelect}
              disabled={isCheckingStatus || isLoading}
            />
          </div>
          <div className="flex items-center text-xs text-gray-400">
            <Keyboard size={14} className="mr-1" />
            <span>{vimModeEnabled ? `${inputMode.toUpperCase()} MODE` : 'STANDARD MODE'}</span>
          </div>
        </div>
      
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-base"
        >
          {/* Using a regular message list instead of virtualization to ensure proper styling */}
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          
          {streamingMessage && (
            <div className="flex items-start mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center mr-2 flex-shrink-0">
                <Command size={16} className="text-white" />
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-3 text-gray-200 max-w-[85%]" style={{ whiteSpace: 'pre-wrap' }}>
                {streamingMessage}
              </div>
            </div>
          )}
          
          {isLoading && !streamingMessage && (
            <div className="flex items-start mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center mr-2 flex-shrink-0">
                <Command size={16} className="text-white" />
              </div>
              <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center text-gray-300 max-w-[85%]">
                <div className="flex ml-2 space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="p-2 border-t border-gray-700 bg-gray-800 relative">
          <AnimatePresence>
            {showPromptSuggestions && (
              <div className="absolute bottom-full left-0 right-0 mb-2">
                <PromptSuggestions
                  agentType={agentType}
                  onSelectPrompt={(prompt) => {
                    setInput(prompt);
                    setShowPromptSuggestions(false);
                  }}
                  onClose={() => setShowPromptSuggestions(false)}
                />
              </div>
            )}
          </AnimatePresence>
          
          <div className="flex items-center">
            <div 
              className={`px-2 text-xs mr-2 ${
                inputMode === 'normal' && vimModeEnabled
                  ? 'text-green-400' 
                  : 'text-gray-500'
              }`}
            >
              {vimModeEnabled ? inputMode[0].toUpperCase() : '$'}
            </div>
            
            <div className="flex-1 relative">
              <input
                type="text"
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (vimModeEnabled && inputMode === 'normal') {
                    handleKeyDown(e as unknown as React.KeyboardEvent);
                  }
                }}
                className="w-full bg-gray-900 text-gray-300 rounded px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                placeholder={
                  vimModeEnabled && inputMode === 'normal'
                    ? 'Press i to enter insert mode'
                    : 'Type a message or command...'
                }
                disabled={isLoading || (vimModeEnabled && inputMode === 'normal')}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full ${
                  showPromptSuggestions ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
                title="Conversation starters"
              >
                <Lightbulb size={16} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 