import { Node } from 'reactflow';
import { Edge } from '@/components/ui/FlowChart';

export const terminalNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 50, y: 100 },
    data: { 
      label: 'User Command',
      description: 'The user enters a command or question in the terminal interface',
      color: 'bg-green-500 text-white' 
    },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: { 
      label: 'Command Parser',
      description: 'The input is analyzed to determine if it\'s a special command or a query for the AI',
      color: 'bg-blue-500 text-white' 
    },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 450, y: 50 },
    data: { 
      label: 'Built-in Commands',
      description: 'Special commands like "clear", "help", "switch" are handled directly by the terminal',
      color: 'bg-purple-500 text-white' 
    },
  },
  {
    id: '4',
    type: 'custom',
    position: { x: 450, y: 150 },
    data: { 
      label: 'Ollama API Request',
      description: 'For AI queries, the input is sent to the Ollama API with resume context',
      color: 'bg-yellow-500 text-gray-900' 
    },
  },
  {
    id: '5',
    type: 'custom',
    position: { x: 650, y: 150 },
    data: { 
      label: 'Response Formatter',
      description: 'The response is formatted for proper display in the terminal interface',
      color: 'bg-orange-500 text-white' 
    },
  },
  {
    id: '6',
    type: 'custom',
    position: { x: 850, y: 100 },
    data: { 
      label: 'Terminal Output',
      description: 'The formatted response is displayed to the user with appropriate styling',
      color: 'bg-red-500 text-white' 
    },
  },
  {
    id: '7',
    type: 'custom',
    position: { x: 650, y: 250 },
    data: { 
      label: 'Vim Keybindings',
      description: 'Optional Vim-inspired keyboard shortcuts for terminal interaction',
      color: 'bg-emerald-500 text-white' 
    },
  },
];

export const terminalEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    style: { stroke: '#6366f1' },
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    label: 'Special Command',
    animated: false,
    style: { stroke: '#8b5cf6' },
  },
  {
    id: 'e2-4',
    source: '2',
    target: '4',
    label: 'AI Query',
    animated: true,
    style: { stroke: '#ec4899' },
  },
  {
    id: 'e3-6',
    source: '3',
    target: '6',
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
    id: 'e5-6',
    source: '5',
    target: '6',
    animated: true,
    style: { stroke: '#10b981' },
  },
  {
    id: 'e7-1',
    source: '7',
    target: '1',
    label: 'Input Control',
    animated: false,
    style: { stroke: '#10b981' },
  },
]; 