'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FlowChart, { Edge as FlowChartEdge } from './FlowChart';
import { terminalNodes, terminalEdges } from '@/lib/flowcharts/terminal-workflow';
import { Terminal, Code, Keyboard, MessageSquare, FileText, Zap } from 'lucide-react';

const TerminalExplainer: React.FC = () => {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [showStepExplanation, setShowStepExplanation] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced nodes with hover handler
  const enhancedNodes = terminalNodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onNodeHover: () => setActiveNodeId(node.id),
      isActive: node.id === activeNodeId
    }
  }));

  // Enhanced edges that highlight when connected nodes are active
  const enhancedEdges: FlowChartEdge[] = terminalEdges.map(edge => ({
    ...edge,
    animated: edge.source === activeNodeId || edge.target === activeNodeId || edge.animated,
    style: {
      ...edge.style,
      stroke: (edge.source === activeNodeId || edge.target === activeNodeId) 
        ? '#10b981' // highlight color
        : edge.style?.stroke,
      strokeWidth: (edge.source === activeNodeId || edge.target === activeNodeId) ? 3 : 1,
    }
  }));

  // Step through the workflow node by node
  const stepExplanations = [
    {
      title: "User Command",
      icon: <Terminal className="h-6 w-6 text-green-500" />,
      description: "Everything begins when you type a command or question in the terminal. The interface supports both special commands and natural language questions."
    },
    {
      title: "Command Parser",
      icon: <Code className="h-6 w-6 text-blue-500" />,
      description: "The system analyzes your input to determine if it's one of several built-in commands (like 'clear', 'help', 'switch') or a query that should be sent to the AI."
    },
    {
      title: "Built-in Commands",
      icon: <Keyboard className="h-6 w-6 text-purple-500" />,
      description: "If you've entered a special command, it's processed directly by the terminal system without calling the AI. This includes navigation, clearing the screen, or switching agents."
    },
    {
      title: "Ollama API Request",
      icon: <MessageSquare className="h-6 w-6 text-yellow-500" />,
      description: "For AI queries, your input is sent to the Ollama API along with your resume data as context, enabling personalized responses about your experience."
    },
    {
      title: "Response Formatter",
      icon: <FileText className="h-6 w-6 text-orange-500" />,
      description: "The raw response from the AI is processed to format it properly for the terminal interface, including styling and layout considerations."
    },
    {
      title: "Terminal Output",
      icon: <Terminal className="h-6 w-6 text-red-500" />,
      description: "The formatted response is displayed in the terminal window with appropriate styling, completing the interaction loop. The terminal maintains a history of these interactions."
    },
    {
      title: "Vim Keybindings",
      icon: <Zap className="h-6 w-6 text-emerald-500" />,
      description: "Optional Vim-inspired keyboard shortcuts enhance the terminal experience. Toggle between normal and insert modes, navigate command history, and more with keyboard shortcuts."
    }
  ];

  // Handle auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayTimerRef.current = setTimeout(() => {
        setCurrentStep(prev => {
          const nextStep = (prev + 1) % stepExplanations.length;
          setActiveNodeId((nextStep + 1).toString());
          return nextStep;
        });
      }, 3000); // Change step every 3 seconds
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [isAutoPlaying, currentStep, stepExplanations.length]);

  // Sync current step with active node
  useEffect(() => {
    if (activeNodeId) {
      const nodeIndex = parseInt(activeNodeId) - 1;
      if (nodeIndex >= 0 && nodeIndex < stepExplanations.length) {
        setCurrentStep(nodeIndex);
      }
    }
  }, [activeNodeId, stepExplanations.length]);

  const handleStepClick = (index: number) => {
    // Stop auto-play if user manually selects a step
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    }

    setCurrentStep(index);
    setActiveNodeId((index + 1).toString());
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
  };

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-800">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Interactive Terminal Interface</h2>
          <p className="text-gray-400">
            This portfolio features a fully interactive terminal that responds to both system commands and natural language
            queries, creating a unique way to explore my skills and experience.
          </p>
        </div>

        {/* Flowchart visualization */}
        <div className="relative mb-8" 
             onMouseLeave={() => !showStepExplanation && setActiveNodeId(null)}>
          <FlowChart 
            initialNodes={enhancedNodes} 
            initialEdges={enhancedEdges}
            title="Terminal Workflow"
            description="How the terminal processes commands and interacts with the AI"
          />
          
          {/* Interactive controls overlay */}
          <div className="absolute bottom-4 right-4 flex space-x-2">
            <button 
              onClick={() => setShowStepExplanation(!showStepExplanation)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow text-sm font-medium transition-colors"
            >
              {showStepExplanation ? "Hide Step Guide" : "Show Step Guide"}
            </button>
            {showStepExplanation && (
              <button 
                onClick={toggleAutoPlay}
                className={`px-4 py-2 ${isAutoPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-md shadow text-sm font-medium transition-colors`}
              >
                {isAutoPlaying ? "Stop Auto-Play" : "Auto-Play Steps"}
              </button>
            )}
          </div>
        </div>

        {/* Step-by-step explanation */}
        <AnimatePresence mode="wait">
          {showStepExplanation && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-800 rounded-lg p-6 shadow-inner mb-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Terminal Workflow: Step-by-Step</h3>
                <span className="text-sm text-gray-400">Step {currentStep + 1} of {stepExplanations.length}</span>
              </div>
              
              {/* Step navigation */}
              <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-thin">
                {stepExplanations.map((step, index) => (
                  <button
                    key={index}
                    onClick={() => handleStepClick(index)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      index === currentStep 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <span className="mr-1">{index + 1}.</span> {step.title}
                  </button>
                ))}
              </div>
              
              {/* Current step explanation */}
              <motion.div
                key={currentStep}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start space-x-4"
              >
                <div className="p-3 bg-gray-700 rounded-full">
                  {stepExplanations[currentStep].icon}
                </div>
                <div>
                  <h4 className="text-lg font-medium text-white mb-2">
                    {stepExplanations[currentStep].title}
                  </h4>
                  <p className="text-gray-300">
                    {stepExplanations[currentStep].description}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Brief explanation when step guide is hidden */}
        <AnimatePresence>
          {!showStepExplanation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-gray-800 p-4 rounded-lg"
            >
              <p className="text-gray-400 text-sm">
                Hover over the flowchart nodes to see how commands flow through the terminal system. 
                Click "Show Step Guide" for detailed explanations of each step in the process.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TerminalExplainer; 