import { motion } from 'framer-motion';
import { Briefcase, Users } from 'lucide-react';

type AgentSelectorProps = {
  onSelect: (agentType: 'recruiter' | 'collaborator') => void;
  currentAgent: 'recruiter' | 'collaborator';
};

export default function AgentSelector({ onSelect, currentAgent }: AgentSelectorProps) {
  return (
    <div className="flex justify-center mb-8">
      <div className="bg-white p-2 rounded-lg shadow-md flex space-x-2">
        <AgentButton 
          isActive={currentAgent === 'recruiter'} 
          onClick={() => onSelect('recruiter')}
          icon={<Briefcase size={20} />}
          label="Professional"
          description="Resume, Skills & Experience"
        />
        <AgentButton 
          isActive={currentAgent === 'collaborator'} 
          onClick={() => onSelect('collaborator')}
          icon={<Users size={20} />}
          label="Personal"
          description="Projects, Interests & Collaboration"
        />
      </div>
    </div>
  );
}

type AgentButtonProps = {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
};

function AgentButton({ isActive, onClick, icon, label, description }: AgentButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-3 rounded-md transition-all duration-200 flex items-center space-x-3 min-w-[180px] ${
        isActive 
          ? 'text-white' 
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="activeAgent"
          className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-md"
          initial={false}
          transition={{ type: 'spring', duration: 0.6 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <div className="relative z-10 text-left">
        <div className="font-medium">{label}</div>
        <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
          {description}
        </div>
      </div>
    </button>
  );
} 