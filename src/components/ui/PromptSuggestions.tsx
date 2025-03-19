'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Briefcase, User, X } from 'lucide-react';

type PromptSuggestionsProps = {
  agentType: 'recruiter' | 'collaborator';
  onSelectPrompt: (prompt: string) => void;
  onClose: () => void;
};

const professionalPrompts = [
  "Can you walk me through your professional background?",
  "What projects are you most proud of in your portfolio?",
  "What technologies or frameworks are you most experienced with?",
  "How do you approach problem-solving in your technical work?",
  "Can you explain how you've implemented CI/CD in previous projects?",
  "What's your experience with cloud platforms like AWS or Azure?",
  "How do you stay updated with the latest industry trends?",
  "What are your career goals for the next few years?"
];

const personalPrompts = [
  "What inspired you to get into technology?",
  "Tell me about your personal coding projects or side interests.",
  "What's your preferred working environment or setup?",
  "How do you balance technical work with other interests?",
  "What open source projects do you contribute to or follow?",
  "What's a technical challenge you've overcome recently?",
  "How do you approach learning new technologies?",
  "What do you enjoy most about collaborative coding?"
];

export default function PromptSuggestions({ 
  agentType, 
  onSelectPrompt, 
  onClose 
}: PromptSuggestionsProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'professional'>(
    agentType === 'recruiter' ? 'professional' : 'personal'
  );
  
  const prompts = activeTab === 'professional' ? professionalPrompts : personalPrompts;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg overflow-hidden"
    >
      <div className="flex justify-between items-center border-b border-gray-700 bg-gray-900 p-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab('professional')}
            className={`px-3 py-1.5 rounded flex items-center text-sm ${
              activeTab === 'professional' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            <Briefcase size={14} className="mr-1.5" />
            Professional
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-3 py-1.5 ml-2 rounded flex items-center text-sm ${
              activeTab === 'personal' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            <User size={14} className="mr-1.5" />
            Personal
          </button>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 p-1 rounded-full hover:bg-gray-700"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="p-3 max-h-[250px] overflow-y-auto">
        <div className="grid grid-cols-1 gap-2">
          {prompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => {
                onSelectPrompt(prompt);
                onClose();
              }}
              className="text-left p-2.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors text-gray-200 text-sm flex items-start"
            >
              <Lightbulb size={16} className="mr-2 text-yellow-400 mt-0.5 flex-shrink-0" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
} 