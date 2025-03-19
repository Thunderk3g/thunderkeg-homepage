'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Brain, Database, Code, ArrowRight, ExternalLink, ArrowDown } from 'lucide-react';
import FeatureSection from './FeatureSection';

interface LandingAnimationProps {
  onComplete: () => void;
  ollamaAvailable: boolean;
}

export default function LandingAnimation({ onComplete, ollamaAvailable }: LandingAnimationProps) {
  const [animationComplete, setAnimationComplete] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  // Transition to features view after initial animation
  useEffect(() => {
    if (animationComplete && !showFeatures) {
      const timer = setTimeout(() => {
        setShowFeatures(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [animationComplete, showFeatures]);

  return (
    <motion.div 
      className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-start z-50 overflow-y-auto"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {!showFeatures ? (
        <motion.div
          className="max-w-4xl w-full mx-auto text-center pt-24 pb-12 px-4"
          onAnimationComplete={() => setAnimationComplete(true)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6"
          >
            <Terminal size={64} className="mx-auto text-green-400 mb-2" />
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-green-400 mb-4 font-mono"
          >
            AI Portfolio Terminal
          </motion.h1>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mb-10 text-gray-300 text-lg md:text-xl"
          >
            <p className="max-w-2xl mx-auto">
              Welcome to my interactive portfolio showcasing AI agent capabilities through a terminal interface
            </p>
          </motion.div>

          {!ollamaAvailable && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.6 }}
              className="p-4 bg-gray-900 border border-yellow-600 rounded-md mb-8 text-left max-w-2xl mx-auto"
            >
              <p className="text-yellow-400 font-mono mb-2">Note: Ollama not detected</p>
              <p className="text-gray-300 mb-2">
                For the full experience with local LLM capabilities, you'll need Ollama installed.
              </p>
              <a 
                href="https://ollama.ai" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-cyan-400 flex items-center hover:underline"
              >
                Get Ollama <ExternalLink size={14} className="ml-1" />
              </a>
            </motion.div>
          )}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            className="flex justify-center"
          >
            <button
              onClick={() => setShowFeatures(true)}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-md flex items-center mx-auto text-lg transition-colors"
            >
              Explore Features <ArrowDown className="ml-2" />
            </button>
          </motion.div>
        </motion.div>
      ) : (
        <FeatureSection onComplete={onComplete} />
      )}
    </motion.div>
  );
}

function Feature({ icon, title, description }: { 
  icon: React.ReactNode, 
  title: string, 
  description: string 
}) {
  return (
    <motion.div
      className="bg-gray-900 border border-gray-700 rounded-lg p-5 text-left"
      whileHover={{ scale: 1.03 }}
      transition={{ 
        duration: 0.2, 
        type: "spring", 
        stiffness: 300 
      }}
    >
      <div className="mb-3">{icon}</div>
      <h3 className="text-xl text-green-400 font-mono mb-2">{title}</h3>
      <p className="text-gray-300 text-sm">{description}</p>
    </motion.div>
  );
} 