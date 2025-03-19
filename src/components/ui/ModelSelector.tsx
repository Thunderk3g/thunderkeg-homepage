'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ModelSelectorProps {
  selectedModel: string;
  availableModels: string[];
  onSelect: (model: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  selectedModel,
  availableModels,
  onSelect,
  disabled = false
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle model selection
  const handleSelectModel = (model: string) => {
    onSelect(model);
    setIsOpen(false);
  };
  
  return (
    <div className="relative text-sm" ref={dropdownRef}>
      <button
        type="button"
        className={`flex items-center justify-between px-3 py-1.5 rounded-md border ${
          disabled
            ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center">
          <span className="block truncate">{selectedModel}</span>
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-gray-800 border border-gray-700 shadow-lg">
          <ul
            className="max-h-56 py-1 overflow-auto text-base sm:text-sm"
            role="listbox"
            aria-labelledby="listbox-label"
          >
            {availableModels.length === 0 ? (
              <li className="text-gray-400 px-3 py-2 cursor-default">
                No models available
              </li>
            ) : (
              availableModels.map((model) => (
                <li
                  key={model}
                  className={`cursor-pointer select-none relative px-3 py-2 ${
                    model === selectedModel
                      ? 'text-blue-400 bg-gray-700'
                      : 'text-gray-300 hover:bg-gray-700'
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
      )}
    </div>
  );
} 