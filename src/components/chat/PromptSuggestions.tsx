'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

export type PromptCategory = 'personal' | 'professional';

export interface Prompt {
  id: string;
  text: string;
  category: PromptCategory;
}

interface PromptSuggestionsProps {
  onSelectPrompt: (prompt: string) => void;
  userRole?: 'recruiter' | 'collaborator' | null;
}

const personalPrompts: Prompt[] = [
  { id: 'p1', text: "Tell me about your background and experience.", category: 'personal' },
  { id: 'p2', text: "What projects are you most proud of?", category: 'personal' },
  { id: 'p3', text: "How do you approach problem-solving?", category: 'personal' },
  { id: 'p4', text: "What are your career goals?", category: 'personal' },
  { id: 'p5', text: "What technologies are you most passionate about?", category: 'personal' },
];

const professionalPrompts: Prompt[] = [
  { id: 'pr1', text: "How would you implement a secure authentication system?", category: 'professional' },
  { id: 'pr2', text: "Explain your approach to API design.", category: 'professional' },
  { id: 'pr3', text: "How do you ensure code quality and maintainability?", category: 'professional' },
  { id: 'pr4', text: "What's your experience with CI/CD pipelines?", category: 'professional' },
  { id: 'pr5', text: "How would you optimize performance for a React application?", category: 'professional' },
];

const PromptSuggestions: React.FC<PromptSuggestionsProps> = ({
  onSelectPrompt,
  userRole = 'recruiter',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>('personal');

  // Filter prompts based on selected category
  const prompts = selectedCategory === 'personal' ? personalPrompts : professionalPrompts;

  return (
    <div className="w-full bg-gray-800/50 rounded-lg border border-gray-700 mb-2 overflow-hidden">
      <div 
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-blue-400" />
          <span className="text-sm font-medium text-gray-200">Suggested prompts</span>
        </div>
        <button className="text-gray-400 hover:text-white">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="px-2 py-2 border-t border-gray-700">
          <div className="flex gap-2 mb-2">
            <button
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === 'personal' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setSelectedCategory('personal')}
            >
              Personal
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === 'professional' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setSelectedCategory('professional')}
            >
              Professional
            </button>
          </div>
          
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600">
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                className="w-full text-left px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-600/70 
                           rounded border border-gray-600/50 text-gray-200 transition-colors"
                onClick={() => onSelectPrompt(prompt.text)}
              >
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptSuggestions; 