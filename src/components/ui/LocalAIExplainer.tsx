'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FlowChart, { Edge as FlowChartEdge } from './FlowChart';
import { localAiNodes, localAiEdges } from '@/lib/flowcharts/local-ai-workflow';
import { Brain, Server, CheckCircle, Database, Cpu, Terminal, Play } from 'lucide-react';

const LocalAIExplainer: React.FC = () => {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [showStepExplanation, setShowStepExplanation] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced nodes with hover handler
  const enhancedNodes = localAiNodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onNodeHover: () => setActiveNodeId(node.id),
      isActive: node.id === activeNodeId
    }
  }));

  // Enhanced edges that highlight when connected nodes are active
  const enhancedEdges: FlowChartEdge[] = localAiEdges.map(edge => ({
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
      title: "Ollama Setup",
      icon: <Server className="h-6 w-6 text-cyan-500" />,
      description: "Ollama is a local service that runs AI models on your own machine. It provides an API for the portfolio to communicate with these locally-hosted models, ensuring data privacy and reducing cloud dependencies."
    },
    {
      title: "Model Selection",
      icon: <Brain className="h-6 w-6 text-blue-500" />,
      description: "Choose from various open-source models available in your Ollama installation such as Llama 3, DeepSeek, or various specialized models. Each has different capabilities and performance characteristics."
    },
    {
      title: "Status Checking",
      icon: <CheckCircle className="h-6 w-6 text-purple-500" />,
      description: "The system periodically checks the connection to Ollama and retrieves the list of available models, ensuring a seamless experience by verifying that everything is functioning properly."
    },
    {
      title: "Portfolio API",
      icon: <Server className="h-6 w-6 text-yellow-500" />,
      description: "An internal API layer bridges between the portfolio's user interface and the local Ollama instance, handling requests, formatting, and adding context from resume data for better responses."
    },
    {
      title: "Text Generation",
      icon: <Cpu className="h-6 w-6 text-orange-500" />,
      description: "The selected language model processes your queries and generates human-like responses based on its training and the additional context provided about the portfolio owner's experience."
    },
    {
      title: "Streaming Response",
      icon: <Play className="h-6 w-6 text-red-500" />,
      description: "Rather than waiting for the complete response, text is streamed back in real-time as it's generated, creating a more interactive experience similar to watching someone type a response."
    },
    {
      title: "User Interface",
      icon: <Terminal className="h-6 w-6 text-emerald-500" />,
      description: "The terminal-like interface displays the AI's responses in a familiar command-line format, while also accepting new queries and commands. The UI updates in real-time as responses stream in."
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
          <h2 className="text-2xl font-bold text-white mb-2">Local AI Integration</h2>
          <p className="text-gray-400">
            This portfolio leverages your local Ollama installation to power AI interactions, providing
            privacy, speed, and the flexibility to use a variety of open-source language models.
          </p>
        </div>

        {/* Flowchart visualization */}
        <div className="relative mb-8" 
             onMouseLeave={() => !showStepExplanation && setActiveNodeId(null)}>
          <FlowChart 
            initialNodes={enhancedNodes} 
            initialEdges={enhancedEdges}
            title="Local AI Workflow"
            description="How the portfolio connects with your local Ollama models"
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
                <h3 className="text-xl font-semibold text-white">Local AI Integration: Step-by-Step</h3>
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
                Hover over the flowchart nodes to see how data flows between the portfolio and your local Ollama installation. 
                Click "Show Step Guide" for detailed explanations of each step in the process.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LocalAIExplainer; 