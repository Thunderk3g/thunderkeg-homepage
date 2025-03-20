import { Node } from 'reactflow';
import { Edge } from '@/components/ui/FlowChart';

export const localAiNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 50, y: 100 },
    data: { 
      label: 'Ollama Setup',
      description: 'Local Ollama installation providing API access to open-source LLMs',
      color: 'bg-cyan-500 text-white' 
    },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 250, y: 50 },
    data: { 
      label: 'Model Selection',
      description: 'User selects from available Ollama models (e.g., Llama 3, DeepSeek)',
      color: 'bg-blue-500 text-white' 
    },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 250, y: 150 },
    data: { 
      label: 'Status Checking',
      description: 'System verifies Ollama connection and available models',
      color: 'bg-purple-500 text-white' 
    },
  },
  {
    id: '4',
    type: 'custom',
    position: { x: 450, y: 100 },
    data: { 
      label: 'Portfolio API',
      description: 'Internal API bridge between the UI and local Ollama instance',
      color: 'bg-yellow-500 text-gray-900' 
    },
  },
  {
    id: '5',
    type: 'custom',
    position: { x: 650, y: 50 },
    data: { 
      label: 'Text Generation',
      description: 'LLM processes queries and generates natural language responses',
      color: 'bg-orange-500 text-white' 
    },
  },
  {
    id: '6',
    type: 'custom',
    position: { x: 650, y: 150 },
    data: { 
      label: 'Streaming Response',
      description: 'Responses are streamed in real-time for more interactive experience',
      color: 'bg-red-500 text-white' 
    },
  },
  {
    id: '7',
    type: 'custom',
    position: { x: 850, y: 100 },
    data: { 
      label: 'User Interface',
      description: 'Terminal UI displays responses and accepts new queries',
      color: 'bg-emerald-500 text-white' 
    },
  },
];

export const localAiEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: false,
    style: { stroke: '#6366f1' },
  },
  {
    id: 'e1-3',
    source: '1',
    target: '3',
    animated: false,
    style: { stroke: '#8b5cf6' },
  },
  {
    id: 'e2-4',
    source: '2',
    target: '4',
    animated: true,
    style: { stroke: '#ec4899' },
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    animated: true,
    style: { stroke: '#f59e0b' },
  },
  {
    id: 'e4-5',
    source: '4',
    target: '5',
    animated: true,
    style: { stroke: '#ef4444' },
  },
  {
    id: 'e4-6',
    source: '4',
    target: '6',
    animated: true,
    style: { stroke: '#10b981' },
  },
  {
    id: 'e5-7',
    source: '5',
    target: '7',
    animated: true,
    style: { stroke: '#3b82f6' },
  },
  {
    id: 'e6-7',
    source: '6',
    target: '7',
    animated: true,
    style: { stroke: '#8b5cf6' },
  },
]; 