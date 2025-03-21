'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

// Define the props interface
interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void;
  onClose: () => void;
  agentType: 'recruiter' | 'collaborator';
}

const PromptSuggestions = ({ onSelect, onClose, agentType }: PromptSuggestionsProps) => {
  const [expanded, setExpanded] = useState(true);

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

  const selectedPrompts = prompts[agentType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-16 left-0 right-0 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 mx-4"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-sm font-semibold text-green-400">Suggested prompts</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>
      
      <div className="p-2 max-h-56 overflow-y-auto">
        {selectedPrompts.map((prompt, index) => (
          <div
            key={index}
            className="text-sm p-2 mb-1 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 text-white"
            onClick={() => {
              onSelect(prompt);
              onClose();
            }}
          >
            {prompt}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PromptSuggestions; 