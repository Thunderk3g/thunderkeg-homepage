'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ModelSelectorProps {
  selectedModel: string;
  models: string[];
  onSelect: (model: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

export default function ModelSelector({
  selectedModel,
  models,
  onSelect,
  onClose,
  disabled = false
}: ModelSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Handle model selection
  const handleSelectModel = (model: string) => {
    onSelect(model);
    onClose();
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <motion.div 
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="relative text-sm bg-gray-900 p-4 rounded-lg shadow-xl max-w-md w-full" 
        ref={dropdownRef}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-200">Select Model</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          <ul className="space-y-1">
            {models.length === 0 ? (
              <li className="text-gray-400 px-3 py-2 cursor-default">
                No models available
              </li>
            ) : (
              models.map((model) => (
                <li
                  key={model}
                  className={`cursor-pointer select-none relative px-3 py-2 rounded ${
                    model === selectedModel
                      ? 'text-blue-400 bg-gray-800'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  role="option"
                  aria-selected={model === selectedModel}
                  onClick={() => handleSelectModel(model)}
                >
                  <div className="flex items-center justify-between">
                    <span className="block truncate">{model}</span>
                    {model === selectedModel && (
                      <span className="text-blue-400">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  );
} 