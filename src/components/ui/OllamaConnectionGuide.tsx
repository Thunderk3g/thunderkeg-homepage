'use client';

import { useState, useEffect } from 'react';
import { checkOllamaAvailability, getOllamaModels } from '@/lib/ollama/client-helpers';
import { motion } from 'framer-motion';
import { Code } from 'lucide-react';

const OllamaConnectionGuide = () => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  // Periodically check Ollama availability
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const available = await checkOllamaAvailability();
        setIsAvailable(available);
        
        if (available) {
          const models = await getOllamaModels();
          setAvailableModels(models);
        }
      } catch (error) {
        console.error('Error checking Ollama status:', error);
        setIsAvailable(false);
      }
    };
    
    // Check immediately on mount
    checkStatus();
    
    // Then check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleGuide = () => {
    setShowGuide(!showGuide);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">Local Ollama Connection</h3>
        <div className="flex items-center">
          <span className="mr-2 text-sm text-gray-300">Status:</span>
          <div className="flex items-center">
            <div 
              className={`w-3 h-3 rounded-full mr-2 ${
                isAvailable === null 
                  ? 'bg-gray-500' 
                  : isAvailable 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
              }`}
            />
            <span className="text-sm">
              {isAvailable === null 
                ? 'Checking...' 
                : isAvailable 
                  ? 'Connected' 
                  : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-300">
          {isAvailable 
            ? `Connected to Ollama with ${availableModels.length} models available.` 
            : 'Connect to your local Ollama instance to use AI features offline.'}
        </p>
      </div>

      <button
        onClick={toggleGuide}
        className="text-blue-400 hover:text-blue-300 flex items-center"
      >
        {showGuide ? 'Hide setup guide' : 'Show setup guide'}
      </button>

      <motion.div
        initial="collapsed"
        animate={showGuide ? "expanded" : "collapsed"}
        variants={{
          expanded: { opacity: 1, height: 'auto', marginTop: 16 },
          collapsed: { opacity: 0, height: 0, marginTop: 0 }
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-white font-medium mb-2">1. Install Ollama</h4>
            <p className="text-gray-300 mb-2">
              Download and install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ollama.ai</a>
            </p>
          </div>

          <div>
            <h4 className="text-white font-medium mb-2">2. Start Ollama Server</h4>
            <div className="bg-gray-900 p-3 rounded font-mono text-sm text-gray-300 flex items-start">
              <Code size={16} className="mr-2 mt-0.5 flex-shrink-0 text-gray-500" />
              <code>ollama serve</code>
            </div>
          </div>

          <div>
            <h4 className="text-white font-medium mb-2">3. Pull a Model</h4>
            <div className="bg-gray-900 p-3 rounded font-mono text-sm text-gray-300 flex items-start">
              <Code size={16} className="mr-2 mt-0.5 flex-shrink-0 text-gray-500" />
              <code>ollama pull llama3</code>
            </div>
          </div>

          <div>
            <h4 className="text-white font-medium mb-2">4. API Endpoints</h4>
            <p className="text-gray-300 mb-2">
              The app connects to Ollama at:
            </p>
            <div className="bg-gray-900 p-3 rounded font-mono text-sm text-gray-300">
              http://localhost:11434/api/chat
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2">5. Privacy Benefits</h4>
            <p className="text-gray-300">
              Using Ollama locally means all your data and interactions remain on your machine. No data is sent to external servers, providing complete privacy and control.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OllamaConnectionGuide; 