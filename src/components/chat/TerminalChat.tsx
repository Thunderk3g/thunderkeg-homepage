'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { useVimKeybindings } from '@/lib/utils/vimKeybindings';
import { Terminal, Command, Keyboard, History, Lightbulb } from 'lucide-react';
import { Trash as TrashIcon } from 'lucide-react';
import ModelSelector from '@/components/ui/ModelSelector';
import PromptSuggestions from '@/components/chat/PromptSuggestions';
import { getOllamaModels, streamChatMessage, ChatMessage } from '@/lib/ollama/client-helpers';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';

// Define component props
interface TerminalChatProps {
  agentType: 'recruiter' | 'collaborator';
  chatId: string;
  vimModeEnabled?: boolean;
  onToggleVimMode?: () => void;
  onSwitchAgent?: () => void;
  onBackToLanding?: () => void;
}

// Define message interface
interface CommandInfo {
  name: string;
  description: string;
  icon: React.ReactNode;
}

// Component starts here
const TerminalChat = ({
  agentType,
  chatId,
  vimModeEnabled = false,
  onToggleVimMode,
  onSwitchAgent,
  onBackToLanding,
}: TerminalChatProps) => {
  // State for messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedContent, setCurrentStreamedContent] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('llama3');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  
  // Setup Vim keybindings
  const { vimMode, setVimMode, currentVimCommand } = useVimKeybindings({
    onCommandExecuted: (command) => {
      if (command === ':q') {
        onBackToLanding?.();
      } else if (command === ':w') {
        // Save functionality could be implemented here
      } else if (command.startsWith(':m')) {
        setShowModelSelector(true);
      }
    },
    enabled: vimModeEnabled,
  });
  
  // Available terminal commands
  const commands: CommandInfo[] = [
    { name: 'help', description: 'Show available commands', icon: <Command size={14} /> },
    { name: 'clear', description: 'Clear the terminal', icon: <TrashIcon size={14} /> },
    { name: 'exit', description: 'Exit the terminal', icon: <Terminal size={14} /> },
    { name: 'vim', description: 'Toggle vim mode', icon: <Keyboard size={14} /> },
    { name: 'history', description: 'Show command history', icon: <History size={14} /> },
    { name: 'model', description: 'Select LLM model', icon: <Lightbulb size={14} /> },
  ];

  // Get Ollama models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      const models = await getOllamaModels();
      if (models.length > 0) {
        setOllamaModels(models);
        // Set a default model if available
        setSelectedModel(models[0]);
      }
    };
    
    fetchModels();
  }, []);
  
  // Set up the virtualized scroller
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => messageContainerRef.current,
    estimateSize: () => 80, // Estimated row height
    overscan: 5,
  });

  // Load chat history from localStorage on component mount
  useEffect(() => {
    if (chatId) {
      try {
        const savedMessages = localStorage.getItem(`chat-${chatId}`);
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        } else {
          // Add welcome message for new chats
          const welcomeMessage: ChatMessage = {
            role: 'assistant',
            content: `Welcome to the ${agentType === 'recruiter' ? 'professional' : 'personal'} chat! How can I assist you today?`,
            timestamp: Date.now(),
          };
          setMessages([welcomeMessage]);
        }
        
        const savedCommandHistory = localStorage.getItem(`history-${chatId}`);
        if (savedCommandHistory) {
          setCommandHistory(JSON.parse(savedCommandHistory));
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    }
  }, [chatId, agentType]);
  
  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (chatId && messages.length > 0) {
      localStorage.setItem(`chat-${chatId}`, JSON.stringify(messages));
    }
  }, [messages, chatId]);
  
  // Save command history to localStorage
  useEffect(() => {
    if (chatId && commandHistory.length > 0) {
      localStorage.setItem(`history-${chatId}`, JSON.stringify(commandHistory));
    }
  }, [commandHistory, chatId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };
  
  // Handle special keys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle up/down arrow for command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Command auto-completion
      if (input.length > 0) {
        const matchingCommand = commands.find(cmd => cmd.name.startsWith(input));
        if (matchingCommand) {
          setInput(matchingCommand.name);
        }
      }
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    // Add to command history and reset history index
    if (!commandHistory.includes(input)) {
      setCommandHistory(prev => [...prev, input]);
    }
    setHistoryIndex(-1);
    
    // Check if input is a command
    if (input.startsWith('/')) {
      handleCommand(input.slice(1));
      setInput('');
      return;
    }
    
    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // Start streaming indicator
    setIsStreaming(true);
    setCurrentStreamedContent('');
    
    // Get recent message context (up to 10 messages)
    const recentMessages = [...messages.slice(-10), userMessage];
    
    // Stream response
    await streamChatMessage(
      recentMessages,
      selectedModel,
      agentType,
      (chunk) => {
        setCurrentStreamedContent(prev => prev + chunk);
      }
    );
    
    // Add assistant message
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: currentStreamedContent,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setIsStreaming(false);
    setCurrentStreamedContent('');
  };
  
  // Handle terminal commands
  const handleCommand = (cmd: string) => {
    const command = cmd.toLowerCase().trim();
    
    switch (command) {
      case 'clear':
        setMessages([]);
        break;
        
      case 'help':
        const helpMessage: ChatMessage = {
          role: 'system',
          content: commands.map(c => `${c.name} - ${c.description}`).join('\n'),
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, helpMessage]);
        break;
        
      case 'exit':
        onBackToLanding?.();
        break;
        
      case 'vim':
        setVimMode(!vimMode);
        onToggleVimMode?.();
        break;
        
      case 'history':
        if (commandHistory.length === 0) {
          const noHistoryMessage: ChatMessage = {
            role: 'system',
            content: 'No command history available.',
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, noHistoryMessage]);
        } else {
          const historyMessage: ChatMessage = {
            role: 'system',
            content: commandHistory.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n'),
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, historyMessage]);
        }
        break;
        
      case 'model':
        setShowModelSelector(true);
        break;
        
      default:
        const unknownCommandMessage: ChatMessage = {
          role: 'system',
          content: `Unknown command: ${command}. Type /help for available commands.`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, unknownCommandMessage]);
    }
  };
  
  // Handle model selection
  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setShowModelSelector(false);
    
    const modelChangeMessage: ChatMessage = {
      role: 'system',
      content: `Model switched to: ${model}`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, modelChangeMessage]);
  };
  
  // Handle prompt selection
  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus(); 
  };
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTo({
        top: messageContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Get message style based on role
  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-900/30 border-l-blue-500';
      case 'assistant':
        return 'bg-green-900/30 border-l-green-500';
      case 'system':
        return 'bg-gray-800 border-l-gray-500 text-gray-300 font-mono text-xs';
      default:
        return 'bg-gray-800 border-l-gray-500';
    }
  };
  
  // Render the UI
  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 rounded-md font-mono">
      {/* Messages container with virtualization */}
      <div 
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        style={{
          height: `calc(100% - 3rem)`, // Adjust based on input height
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={virtualItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div 
                  className={`my-2 p-2 rounded border-l-2 ${getMessageStyle(message.role)}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-xs">
                      {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI' : 'System'}
                    </span>
                    {message.timestamp && (
                      <span className="text-xs text-gray-400">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* End of messages marker for scrolling */}
        <div ref={messagesEndRef} />
        
        {/* Streaming indicator */}
        {isStreaming && (
          <div className="my-2 p-2 rounded border-l-2 bg-green-900/30 border-l-green-500">
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold text-xs">AI</span>
              <span className="text-xs text-gray-400">
                {formatTimestamp(Date.now())}
              </span>
            </div>
            <div className="whitespace-pre-wrap break-words">
              {currentStreamedContent}
              <span className="inline-block w-2 h-4 ml-1 bg-gray-200 animate-blink"></span>
            </div>
          </div>
        )}
      </div>
      
      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-gray-700 relative">
        {showPromptSuggestions && (
          <PromptSuggestions 
            onSelectPrompt={handlePromptSelect}
            role={agentType}
          />
        )}
        
        <div className="flex items-center bg-gray-800 rounded overflow-hidden">
          <div 
            className="px-2 text-gray-400 cursor-pointer hover:text-gray-200"
            onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
          >
            <Lightbulb size={14} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={vimMode ? `${currentVimCommand || 'Normal mode'}` : "Type a message or /command..."}
            className="flex-1 bg-gray-800 py-2 px-3 focus:outline-none text-sm"
            disabled={vimMode}
            autoFocus
          />
          <button
            type="submit"
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!input.trim() || isStreaming || vimMode}
          >
            Send
          </button>
        </div>
      </form>
      
      {/* Model selector modal */}
      <AnimatePresence>
        {showModelSelector && (
          <ModelSelector
            models={ollamaModels}
            selectedModel={selectedModel}
            onSelect={handleModelSelect}
            onClose={() => setShowModelSelector(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(TerminalChat); 