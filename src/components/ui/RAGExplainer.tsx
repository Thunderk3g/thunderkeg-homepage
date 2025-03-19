'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FlowChart from './FlowChart';
import { ragNodes, ragEdges } from '@/lib/flowcharts/rag-workflow';
import { Brain, Database, FileText, Search, Zap, MessageSquare } from 'lucide-react';

const RAGExplainer: React.FC = () => {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [showStepExplanation, setShowStepExplanation] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced nodes with hover handler
  const enhancedNodes = ragNodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onNodeHover: () => setActiveNodeId(node.id),
      isActive: node.id === activeNodeId
    }
  }));

  // Enhanced edges that highlight when connected nodes are active
  const enhancedEdges = ragEdges.map(edge => ({
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
      title: "User Query",
      icon: <MessageSquare className="h-6 w-6 text-green-500" />,
      description: "The process begins when a user asks a question about your resume or portfolio. The query is processed and prepared for the RAG system."
    },
    {
      title: "Query Embedding",
      icon: <Zap className="h-6 w-6 text-blue-500" />,
      description: "The user's query is transformed into a numerical vector representation (embedding) using a specialized model. This conversion allows the system to understand the semantic meaning of the question."
    },
    {
      title: "Vector Search",
      icon: <Search className="h-6 w-6 text-purple-500" />,
      description: "The query embedding is compared to pre-computed embeddings of your resume data. The system searches for resume sections that are semantically similar to the question, not just keyword matches."
    },
    {
      title: "Document Retrieval",
      icon: <FileText className="h-6 w-6 text-yellow-500" />,
      description: "The most relevant sections from your resume are retrieved based on their semantic similarity to the query. This targeted retrieval ensures the AI has access to the most pertinent information."
    },
    {
      title: "Context Injection",
      icon: <Database className="h-6 w-6 text-orange-500" />,
      description: "The retrieved resume sections are formatted and added to the prompt as context. This gives the AI model specific information about your background that's relevant to the user's question."
    },
    {
      title: "LLM Response",
      icon: <Brain className="h-6 w-6 text-red-500" />,
      description: "The language model (running locally through Ollama) generates a response based on both the original query and the retrieved context from your resume. This allows for accurate, personalized answers about your experience and skills."
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
          <h2 className="text-2xl font-bold text-white mb-2">Retrieval-Augmented Generation (RAG)</h2>
          <p className="text-gray-400">
            This portfolio uses a RAG system to provide accurate answers about my experience and skills
            by retrieving relevant sections from my resume when responding to queries.
          </p>
        </div>

        {/* Flowchart visualization */}
        <div className="relative mb-8" 
             onMouseLeave={() => !showStepExplanation && setActiveNodeId(null)}>
          <FlowChart 
            initialNodes={enhancedNodes} 
            initialEdges={enhancedEdges}
            title="RAG Workflow"
            description="How the system answers questions about my background"
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
                <h3 className="text-xl font-semibold text-white">How RAG Works: Step-by-Step</h3>
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
                Hover over the flowchart nodes to see how data flows through the RAG system. 
                Click "Show Step Guide" for detailed explanations of each step in the process.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RAGExplainer; 