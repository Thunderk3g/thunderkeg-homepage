'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Move } from 'lucide-react';

// Define types for nodes and edges
interface NodeData {
  label: string;
  description?: string;
  color?: string;
}

interface Node {
  id: string;
  data: NodeData;
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: {
    stroke?: string;
    strokeWidth?: number;
  };
}

// Simple node component
const SimpleNode = ({ 
  data, 
  id,
  position,
  onClick,
  onHover,
  isActive,
  scale,
}: { 
  data: NodeData; 
  id: string;
  position: { x: number; y: number };
  onClick?: (id: string) => void;
  onHover?: (id: string) => void;
  isActive?: boolean;
  scale: number;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const handleMouseEnter = () => {
    setShowTooltip(true);
    if (onHover) {
      onHover(id);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };
  
  return (
    <div 
      className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onClick?.(id)}
    >
      <div className={`px-4 py-2 rounded-md shadow-md font-medium transition-all duration-200 ${
        isActive 
          ? 'ring-2 ring-offset-1 ring-green-500 scale-110' 
          : ''
      } ${data.color || 'bg-blue-500 text-white'}`}>
        {data.label}
      </div>
      
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-10 p-2 bg-gray-800 text-white text-sm rounded shadow-lg w-48 -mt-1 left-full ml-2"
          >
            {data.description}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Simple edge component
const SimpleEdge = ({ 
  edge, 
  nodesMap,
  isActive,
  scale,
  pan,
}: { 
  edge: Edge;
  nodesMap: Map<string, Node>;
  isActive?: boolean;
  scale: number;
  pan: { x: number, y: number };
}) => {
  const sourceNode = nodesMap.get(edge.source);
  const targetNode = nodesMap.get(edge.target);
  
  if (!sourceNode || !targetNode) return null;
  
  const startX = sourceNode.position.x;
  const startY = sourceNode.position.y;
  const endX = targetNode.position.x;
  const endY = targetNode.position.y;
  
  // Calculate the path
  const path = `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`;
  
  // Path styling
  const strokeColor = isActive ? '#10b981' : (edge.style?.stroke || '#6366f1');
  const strokeWidth = isActive ? 3 : (edge.style?.strokeWidth || 1);
  
  return (
    <g>
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={edge.animated ? "5,5" : "none"}
        className={edge.animated ? "animate-dash" : ""}
      />
      {edge.label && (
        <text
          x={(startX + endX) / 2}
          y={(startY + endY) / 2 - 10}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize={12 * scale}
          className="bg-gray-900 px-1"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};

export interface FlowChartProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  title?: string;
  description?: string;
  isVisible?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string) => void;
  height?: string | number;
}

const FlowChart: React.FC<FlowChartProps> = ({ 
  initialNodes, 
  initialEdges,
  title,
  description,
  isVisible = true,
  onNodeClick,
  onNodeHover,
  height = "500px",
}) => {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef<{ x: number, y: number } | null>(null);
  
  // Handle node click
  const handleNodeClick = (id: string) => {
    if (onNodeClick) {
      onNodeClick(id);
    }
  };

  // Handle node hover
  const handleNodeHover = (id: string) => {
    setActiveNodeId(id);
    if (onNodeHover) {
      onNodeHover(id);
    }
  };

  // Create a map of nodes for faster lookup when rendering edges
  const nodesMap = new Map();
  initialNodes.forEach(node => {
    nodesMap.set(node.id, node);
  });

  // Animation variants for when the chart appears/disappears
  const variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  };

  // Zoom in and out handlers
  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 2));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };

  // Reset view
  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && lastMousePos.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      
      setPan(prevPan => ({
        x: prevPan.x + dx,
        y: prevPan.y + dy
      }));
      
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    lastMousePos.current = null;
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    setScale(prev => Math.min(Math.max(prev + delta, 0.5), 2));
  };

  // Set up and clean up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    
    if (canvas) {
      if (isDragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        // Change cursor for better UX
        canvas.style.cursor = 'grabbing';
      } else {
        canvas.style.cursor = 'grab';
      }
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="relative border border-gray-700 rounded-lg overflow-hidden bg-gray-900 select-none"
          style={{ height }}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={variants}
          transition={{ duration: 0.3 }}
        >
          {title && (
            <div className="absolute top-0 left-0 right-0 bg-gray-800/80 backdrop-blur-sm p-3 z-10 border-b border-gray-700">
              <h3 className="text-white font-medium">{title}</h3>
              {description && <p className="text-gray-400 text-sm">{description}</p>}
            </div>
          )}
          
          {/* Zoom and pan controls */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
            <button 
              onClick={zoomIn} 
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 p-2 rounded"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
            <button 
              onClick={zoomOut} 
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 p-2 rounded"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <button 
              onClick={resetView} 
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 p-2 rounded"
              title="Reset view"
              aria-label="Reset view"
            >
              <Move size={16} />
            </button>
          </div>
          
          {/* Interactive canvas */}
          <div 
            ref={canvasRef}
            className="relative w-full h-full overflow-hidden"
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          >
            <div 
              className="absolute inset-0 w-full h-full"
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease'
              }}
            >
              {/* SVG for edges */}
              <svg className="absolute inset-0 w-full h-full">
                {initialEdges.map(edge => (
                  <SimpleEdge 
                    key={edge.id} 
                    edge={edge} 
                    nodesMap={nodesMap}
                    isActive={edge.source === activeNodeId || edge.target === activeNodeId}
                    scale={scale}
                    pan={pan}
                  />
                ))}
              </svg>
              
              {/* Nodes */}
              <div className="relative w-full h-full">
                {initialNodes.map(node => (
                  <SimpleNode
                    key={node.id}
                    data={node.data}
                    id={node.id}
                    position={node.position}
                    onClick={handleNodeClick}
                    onHover={handleNodeHover}
                    isActive={node.id === activeNodeId}
                    scale={scale}
                  />
                ))}
              </div>
            </div>
          </div>
          
          {/* Controls and info */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-md p-2 text-xs text-gray-400">
              <span className="hidden sm:inline">Drag to pan • </span>
              <span className="hidden sm:inline">Scroll to zoom • </span>
              <span>Hover over nodes for details • </span>
              <span>Click for more information</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FlowChart; 