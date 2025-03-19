'use client';

import { motion } from 'framer-motion';
import { Terminal, User, ArrowLeft } from 'lucide-react';

type TerminalAgentSelectorProps = {
  onSelect: (agentType: 'recruiter' | 'collaborator') => void;
  currentAgent: 'recruiter' | 'collaborator';
};

export default function TerminalAgentSelector({ 
  onSelect, 
  currentAgent 
}: TerminalAgentSelectorProps) {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold font-mono text-green-400 mb-4">Terminal Portfolio</h1>
        <p className="text-xl text-gray-300 max-w-2xl">
          Choose your role to open a specialized terminal interface
        </p>
      </motion.div>
      
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 cursor-pointer"
          onClick={() => onSelect('recruiter')}
        >
          <div className={`bg-gray-900 border ${currentAgent === 'recruiter' ? 'border-blue-500' : 'border-gray-700'} p-8 rounded-lg hover:border-blue-500 transition-colors h-full`}>
            <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mb-5 mx-auto">
              <Terminal size={30} className="text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-blue-400 mb-4 text-center">Recruiter</h2>
            <p className="text-gray-400 mb-5">
              Open a professional terminal focused on qualifications, experience, and career achievements.
              Ideal for exploring professional background and technical skills.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center">
                <span className="mr-2 text-blue-400">•</span>
                <span>Resume and work history</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-blue-400">•</span>
                <span>Technical skills assessment</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-blue-400">•</span>
                <span>Portfolio project details</span>
              </li>
            </ul>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 cursor-pointer"
          onClick={() => onSelect('collaborator')}
        >
          <div className={`bg-gray-900 border ${currentAgent === 'collaborator' ? 'border-purple-500' : 'border-gray-700'} p-8 rounded-lg hover:border-purple-500 transition-colors h-full`}>
            <div className="w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mb-5 mx-auto">
              <User size={30} className="text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-purple-400 mb-4 text-center">Collaborator</h2>
            <p className="text-gray-400 mb-5">
              Open a personal terminal focused on interests, collaboration opportunities, and personal projects.
              Great for exploring mutual interests and potential collaborations.
            </p>
            <ul className="space-y-2">
              <li className="flex items-center">
                <span className="mr-2 text-purple-400">•</span>
                <span>Personal projects and interests</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-purple-400">•</span>
                <span>Collaboration opportunities</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-purple-400">•</span>
                <span>Personal background and story</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
      
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        onClick={() => window.location.href = '/'}
        className="mt-10 flex items-center text-blue-400 hover:text-blue-300 transition-colors text-sm"
      >
        <ArrowLeft size={16} className="mr-1" />
        Back to Landing Page
      </motion.button>
    </div>
  );
} 