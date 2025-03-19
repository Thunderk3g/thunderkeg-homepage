import { useState } from 'react';
import { Send } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatInterfaceProps = {
  agentType: 'recruiter' | 'collaborator';
};

export default function ChatInterface({ agentType }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi there! I'm your ${
        agentType === 'recruiter' ? 'Professional' : 'Personal'
      } assistant. How can I help you today?`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    
    // Clear input and set loading
    setInput('');
    setIsLoading(true);
    
    try {
      // Call our API route
      const apiMessages = messages.concat(userMessage).map(({ role, content }) => ({
        role,
        content,
      }));
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          agentType,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from server');
      }
      
      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || 'Sorry, I encountered an error.',
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again later.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto border rounded-lg overflow-hidden bg-white shadow-md">
      <div className={`p-4 text-white ${
        agentType === 'recruiter' 
          ? 'bg-gradient-to-r from-blue-600 to-indigo-700' 
          : 'bg-gradient-to-r from-purple-600 to-pink-500'
      }`}>
        <h2 className="text-xl font-bold">
          {agentType === 'recruiter' ? 'Professional Assistant' : 'Personal Assistant'}
        </h2>
        <p className="text-sm opacity-80">
          {agentType === 'recruiter'
            ? 'Ask about my skills, experience, and qualifications'
            : 'Chat about my interests, projects, and collaboration opportunities'}
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? agentType === 'recruiter' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 text-gray-800">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`p-2 text-white rounded-md focus:outline-none focus:ring-2 disabled:opacity-50 ${
              agentType === 'recruiter' 
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
} 