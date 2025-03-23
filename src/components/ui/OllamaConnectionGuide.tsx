'use client';

import { useState, useEffect } from 'react';
import { checkOllamaAvailability, getOllamaModels } from '@/lib/ollama/client-helpers';
import { isUsingExtension, setPreferExtension, getPreferExtension } from '@/lib/ollama/client';
import { motion } from 'framer-motion';
import { Code, Download, Check, X } from 'lucide-react';

const OllamaConnectionGuide = () => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [usingExtension, setUsingExtension] = useState<boolean>(false);
  const [preferExtension, setPreferExtensionState] = useState<boolean>(true);

  // Periodically check Ollama availability
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Get current preference setting
        setPreferExtensionState(getPreferExtension());
        
        const available = await checkOllamaAvailability();
        setIsAvailable(available);
        
        if (available) {
          const models = await getOllamaModels();
          setAvailableModels(models);
          
          // Check if we're using the extension
          const extensionEnabled = await isUsingExtension();
          setUsingExtension(extensionEnabled);
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
  
  // Handle toggling extension preference
  const toggleExtensionPreference = () => {
    const newValue = !preferExtension;
    setPreferExtensionState(newValue);
    setPreferExtension(newValue);
    
    // Force a status refresh
    checkOllamaAvailability().then(available => {
      setIsAvailable(available);
      if (available) {
        isUsingExtension().then(usingExt => setUsingExtension(usingExt));
      }
    });
  };

  // Manually check for extension
  const checkForExtension = async () => {
    // Force clear the cached result
    setPreferExtensionState(getPreferExtension());
    
    // Check for extension
    const extensionAvailable = await isUsingExtension();
    setUsingExtension(extensionAvailable);
    
    // Now check connection
    const available = await checkOllamaAvailability();
    setIsAvailable(available);
    
    if (available) {
      const models = await getOllamaModels();
      setAvailableModels(models);
    }
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
                  ? usingExtension ? 'Connected via Extension' : 'Connected'
                  : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-300">
          {isAvailable 
            ? `Connected to Ollama with ${availableModels.length} models available${usingExtension ? ' via Ollama Bridge extension' : ''}.` 
            : 'Connect to your local Ollama instance to use AI features offline.'}
        </p>
      </div>
      
      {/* Extension preference toggle */}
      <div className="mb-4 flex items-center justify-between bg-gray-900 p-3 rounded">
        <span className="text-gray-300">Always use extension</span>
        <button 
          onClick={toggleExtensionPreference}
          className={`w-12 h-6 rounded-full p-1 transition-colors ${
            preferExtension ? 'bg-blue-600' : 'bg-gray-700'
          }`}
        >
          <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
            preferExtension ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
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
            <h4 className="text-white font-medium mb-2">5. Ollama Bridge Extension</h4>
            <p className="text-gray-300 mb-2">
              If you're accessing this site via HTTPS, you'll need our browser extension to securely connect to your local Ollama instance.
            </p>
            <div className="flex flex-wrap gap-2">
              <a 
                href="#" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Extension
              </a>
              <button
                onClick={checkForExtension}
                className="inline-flex items-center bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Check Extension
              </button>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              {usingExtension 
                ? '✓ Extension detected - you can now use local Ollama models securely over HTTPS!'
                : 'The extension creates a secure bridge between this website and your local Ollama instance.'}
            </p>
            
            <div className="mt-2 bg-gray-900 p-3 rounded text-sm border-l-4 border-yellow-500">
              <p className="text-gray-300">
                <strong>Extension detection status:</strong><br/>
                {usingExtension ? (
                  <span className="flex items-center text-green-400">
                    <Check size={16} className="mr-2" /> Extension detected and active
                  </span>
                ) : (
                  <span className="flex items-center text-yellow-400">
                    <X size={16} className="mr-2" /> Extension not detected
                  </span>
                )}
              </p>
              <p className="text-gray-400 mt-2">
                {preferExtension 
                  ? "The extension will be used whenever available, even for local HTTP connections."
                  : "The extension will only be used when direct connections aren't possible."}
              </p>
              <p className="text-gray-400 mt-2">
                <strong>Troubleshooting:</strong><br/>
                1. Make sure extension is installed and enabled<br/>
                2. Refresh this page after installing<br/>
                3. Open DevTools console (F12) and run: <code>window.debugOllamaStatus()</code> 
              </p>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2">6. Privacy Benefits</h4>
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