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

// Helper function to chunk large messages
const chunkText = (text: string, maxLength: number = 2000): string[] => {
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    // Try to find a natural breaking point (newline, space, period)
    let breakPoint = Math.min(remaining.length, maxLength);
    
    if (breakPoint < remaining.length) {
      // Look for natural breaking points
      const newlinePos = remaining.lastIndexOf('\n', breakPoint);
      const spacePos = remaining.lastIndexOf(' ', breakPoint);
      const periodPos = remaining.lastIndexOf('.', breakPoint);
      
      // Choose the closest natural break point if available
      const naturalBreak = Math.max(newlinePos, spacePos, periodPos);
      if (naturalBreak > 0) {
        breakPoint = naturalBreak + 1; // Include the delimiter in the chunk
      }
    }
    
    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint);
  }
  
  return chunks;
};

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
  const streamedContentRef = useRef<string>('');
  
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
  
  // Set up the virtualized scroller with improved settings
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => messageContainerRef.current,
    estimateSize: () => 180, // Increased estimated row height to better accommodate larger messages
    overscan: 15, // Increased overscan to render more items off-screen
    // Add a dynamic size measurement function with extra padding
    measureElement: (element) => {
      // Add more padding to ensure no truncation
      return element.getBoundingClientRect().height + 40;
    },
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
  
  // Auto-scroll when messages change or during streaming
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamedContent]); // Add currentStreamedContent as dependency
  
  // Load model preference from localStorage
  useEffect(() => {
    if (chatId) {
      const savedModel = localStorage.getItem(`model-${chatId}`);
      if (savedModel && ollamaModels.includes(savedModel)) {
        setSelectedModel(savedModel);
      }
    }
  }, [chatId, ollamaModels]);
  
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
  
  // Handle form submission with chunking support
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
    streamedContentRef.current = '';
    
    // Get recent message context (up to 10 messages)
    const recentMessages = [...messages.slice(-10), userMessage];
    
    // Stream response with improved handling for large messages
    try {
      await streamChatMessage(
        recentMessages,
        selectedModel,
        agentType,
        (chunk) => {
          // Update both the ref and the state
          streamedContentRef.current += chunk;
          setCurrentStreamedContent(streamedContentRef.current);
        }
      );
      
      // Capture the final content from our ref
      const finalContent = streamedContentRef.current;
      
      // Add assistant message with final content
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error streaming message:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        role: 'system',
        content: 'An error occurred while generating the response. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
      setCurrentStreamedContent('');
      streamedContentRef.current = '';
    }
  };
  
  // Handle terminal commands
  const handleCommand = (cmd: string) => {
    const args = cmd.toLowerCase().split(' ');
    
    if (args[0] === 'help') {
      const helpMessage: ChatMessage = {
        role: 'system',
        content: `Available commands:
- help: Show this help message
- clear: Clear the terminal
- exit: Exit the terminal
- vim: Toggle vim mode
- history: Show command history
- model: Select LLM model
        `,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, helpMessage]);
    } else if (args[0] === 'clear') {
      setMessages([]);
    } else if (args[0] === 'exit') {
      onBackToLanding?.();
    } else if (args[0] === 'vim') {
      onToggleVimMode?.();
    } else if (args[0] === 'history') {
      if (commandHistory.length === 0) {
        const historyMessage: ChatMessage = {
          role: 'system',
          content: 'No command history available.',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, historyMessage]);
      } else {
        const historyContent = commandHistory
          .map((cmd, index) => `${commandHistory.length - index}. ${cmd}`)
          .join('\n');
        
        const historyMessage: ChatMessage = {
          role: 'system',
          content: `Command history:\n${historyContent}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, historyMessage]);
      }
    } else if (args[0] === 'model') {
      if (args.length > 1) {
        // Set model directly if provided
        const modelName = args[1];
        if (ollamaModels.includes(modelName)) {
          setSelectedModel(modelName);
          // Persist the selection to localStorage
          localStorage.setItem(`model-${chatId}`, modelName);
          
          const modelMessage: ChatMessage = {
            role: 'system',
            content: `Model changed to ${modelName}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, modelMessage]);
        } else {
          const errorMessage: ChatMessage = {
            role: 'system',
            content: `Unknown model: ${modelName}. Available models: ${ollamaModels.join(', ')}`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // Show model selector UI
        setShowModelSelector(true);
      }
    } else {
      const unknownCommandMessage: ChatMessage = {
        role: 'system',
        content: `Unknown command: ${cmd}. Type 'help' for available commands.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, unknownCommandMessage]);
    }
  };
  
  // Handle model selection
  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    // Persist the selection to localStorage
    localStorage.setItem(`model-${chatId}`, model);
    
    const modelSelectedMessage: ChatMessage = {
      role: 'system',
      content: `Model changed to ${model}`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, modelSelectedMessage]);
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
  const formatTimestamp = (timestamp: number | undefined) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  
  // Get message style based on role - updated for Kali Linux theme
  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-gray-900/30 border-l-blue-500 text-blue-400';
      case 'assistant':
        return 'bg-gray-900/30 border-l-green-500 text-green-400';
      case 'system':
        return 'bg-gray-900/30 border-l-gray-500 text-gray-300 font-mono text-xs';
      default:
        return 'bg-gray-900/30 border-l-gray-500';
    }
  };
  
  // Render the UI with improved message display
  return (
    <div className="h-full flex flex-col bg-gray-900 text-green-400 font-mono">
      {/* Messages container */}
      <div 
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {/* Render virtualized list */}
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
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className={getMessageStyle(message.role)}
              >
                <div className="flex flex-col">
                  <div className="flex justify-between items-start">
                    <span className="font-bold">
                      {message.role === 'user' ? '> ' : ''}
                      {message.role === 'assistant' ? 'AI: ' : ''}
                      {message.role === 'system' ? 'SYSTEM: ' : ''}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Streaming content */}
        {isStreaming && (
          <div className={getMessageStyle('assistant')}>
            <div className="flex flex-col">
              <div className="flex justify-between items-start">
                <span className="font-bold">AI: </span>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(Date.now())}
                </span>
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words">
                {currentStreamedContent}
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
        <div className="flex">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={vimMode ? `:${currentVimCommand}` : input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={vimMode ? "Vim command mode" : "Type a message..."}
              className="w-full bg-gray-800 border border-gray-700 rounded-l px-4 py-2 focus:outline-none focus:border-blue-500 text-green-400"
              disabled={isStreaming || vimMode}
            />
            {!isStreaming && !vimMode && (
              <button
                type="button"
                onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-400"
              >
                <Lightbulb size={18} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isStreaming || vimMode || !input.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-r px-4 py-2"
          >
            Send
          </button>
        </div>
        
        {/* Status line showing model info */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <div className="flex space-x-4">
            <button 
              onClick={() => setShowModelSelector(true)}
              className="flex items-center space-x-1 text-blue-400 hover:text-blue-300"
            >
              <span>Model: {selectedModel}</span>
            </button>
            <button 
              onClick={onToggleVimMode}
              className={`flex items-center space-x-1 ${vimModeEnabled ? 'text-green-400' : 'text-gray-500'} hover:text-green-300`}
            >
              <span>Vim: {vimModeEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          
          <div>
            <button 
              onClick={() => setMessages([])}
              className="text-gray-500 hover:text-red-400 flex items-center space-x-1"
            >
              <TrashIcon size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </form>
      
      {/* Model selector dialog */}
      <AnimatePresence>
        {showModelSelector && (
          <ModelSelector
            selectedModel={selectedModel}
            models={ollamaModels}
            onSelect={handleModelSelect}
            onClose={() => setShowModelSelector(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Prompt suggestions */}
      <AnimatePresence>
        {showPromptSuggestions && (
          <PromptSuggestions
            onSelect={handlePromptSelect}
            onClose={() => setShowPromptSuggestions(false)}
            agentType={agentType}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(TerminalChat); 