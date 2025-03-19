'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Brain, Database, ArrowRight } from 'lucide-react';
import TerminalExplainer from '../ui/TerminalExplainer';
import LocalAIExplainer from '../ui/LocalAIExplainer';
import RAGExplainer from '../ui/RAGExplainer';

interface FeatureSectionProps {
  onComplete: () => void;
}

export default function FeatureSection({ onComplete }: FeatureSectionProps) {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const features = [
    {
      id: 'terminal',
      title: 'AI Portfolio Terminal',
      icon: <Terminal size={32} className="text-green-400" />,
      description: 'Interact with a simulated terminal environment that responds to your commands and questions',
      component: <TerminalExplainer />
    },
    {
      id: 'localai',
      title: 'Local AI Integration',
      icon: <Brain size={32} className="text-cyan-400" />,
      description: 'Powered by your local Ollama instance for private, secure interactions',
      component: <LocalAIExplainer />
    },
    {
      id: 'rag',
      title: 'RAG System',
      icon: <Database size={32} className="text-purple-400" />,
      description: 'Retrieval-Augmented Generation for accurate, relevant responses about my experience',
      component: <RAGExplainer />
    }
  ];

  const handleFeatureClick = (featureId: string) => {
    if (activeFeature === featureId) {
      setActiveFeature(null);
    } else {
      setActiveFeature(featureId);
    }
  };

  const activeFeatureData = features.find(f => f.id === activeFeature);

  return (
    <motion.div 
      className="w-full max-w-7xl mx-auto py-16 px-4 md:px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-green-400 mb-4 font-mono">
          Portfolio Features
        </h2>
        <p className="text-gray-300 text-lg max-w-3xl mx-auto">
          Explore the technologies and systems that power this portfolio.
          Click on any feature below to learn more about how it works.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {features.map((feature) => (
          <motion.div
            key={feature.id}
            className={`bg-gray-900 border border-gray-700 rounded-lg p-5 text-left cursor-pointer transition-all ${
              activeFeature === feature.id ? 'ring-2 ring-green-500' : 'hover:bg-gray-800'
            }`}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
            onClick={() => handleFeatureClick(feature.id)}
          >
            <div className="mb-3">{feature.icon}</div>
            <h3 className="text-xl text-green-400 font-mono mb-2">{feature.title}</h3>
            <p className="text-gray-300 text-sm">{feature.description}</p>
            <div className="mt-4 text-blue-400 text-sm flex items-center font-medium">
              {activeFeature === feature.id ? 'Hide details' : 'Learn more'} 
              <ArrowRight size={14} className={`ml-1 transition-transform ${
                activeFeature === feature.id ? 'rotate-90' : ''
              }`} />
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeFeature && (
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="mb-12"
          >
            {activeFeatureData?.component}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="text-center mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-md flex items-center mx-auto text-lg transition-colors"
        >
          Enter Terminal <ArrowRight className="ml-2" />
        </button>
      </motion.div>
    </motion.div>
  );
} 