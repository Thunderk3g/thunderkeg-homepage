'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FlowChart from './FlowChart';
import { Node, Edge } from 'reactflow';

export interface FeatureSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  flowTitle: string;
  flowDescription: string;
  flowNodes: Node[];
  flowEdges: Edge[];
  triggerType?: 'hover' | 'click';
  children?: React.ReactNode;
}

const FeatureSection: React.FC<FeatureSectionProps> = ({
  title,
  description,
  icon,
  flowTitle,
  flowDescription,
  flowNodes,
  flowEdges,
  triggerType = 'hover',
  children,
}) => {
  const [showFlow, setShowFlow] = useState(false);

  const handleMouseEnter = () => {
    if (triggerType === 'hover') {
      setShowFlow(true);
    }
  };

  const handleMouseLeave = () => {
    if (triggerType === 'hover') {
      setShowFlow(false);
    }
  };

  const handleClick = () => {
    if (triggerType === 'click') {
      setShowFlow(!showFlow);
    }
  };

  return (
    <div className="relative">
      <motion.div
        className="p-6 bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
        whileHover={{ scale: 1.02 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="flex items-center mb-4">
          <div className="mr-4 text-blue-400">{icon}</div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        <p className="text-gray-300 mb-4">{description}</p>
        {children}
        <div className="mt-4 text-sm text-blue-400">
          {triggerType === 'hover' ? 'Hover to see how it works' : 'Click to see how it works'}
        </div>
      </motion.div>

      <AnimatePresence>
        {showFlow && (
          <motion.div
            className="absolute z-20 left-full ml-4 top-0 w-[800px]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <FlowChart
              initialNodes={flowNodes}
              initialEdges={flowEdges}
              title={flowTitle}
              description={flowDescription}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FeatureSection; 