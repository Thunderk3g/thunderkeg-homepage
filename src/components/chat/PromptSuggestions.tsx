'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Define the props interface
interface PromptSuggestionsProps {
  onSelectPrompt: (prompt: string) => void;
  role: 'recruiter' | 'collaborator';
}

const PromptSuggestions = ({ onSelectPrompt, role }: PromptSuggestionsProps) => {
  const [expanded, setExpanded] = useState(false);

  // Define prompts based on role
  const prompts = {
    recruiter: [
      "What projects have you worked on recently?",
      "Tell me about your experience with React",
      "What are your career goals?",
      "How do you approach problem-solving?",
      "What are your strengths and weaknesses?"
    ],
    collaborator: [
      "What's the architecture of this project?",
      "How can we improve performance?",
      "Let's discuss the tech stack",
      "Can you explain this component?",
      "What testing strategies are we using?"
    ]
  };

  const selectedPrompts = prompts[role];

  return (
    <div className="w-full">
      <div 
        className="flex items-center justify-between px-3 py-2 text-sm text-gray-400 cursor-pointer hover:bg-neutral-800"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs">Suggested prompts</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="p-2 grid grid-cols-1 gap-1">
            {selectedPrompts.map((prompt, index) => (
              <div
                key={index}
                className="text-xs p-2 bg-neutral-800 rounded cursor-pointer hover:bg-neutral-700"
                onClick={() => {
                  onSelectPrompt(prompt);
                  setExpanded(false);
                }}
              >
                {prompt}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PromptSuggestions; 