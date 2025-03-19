import { Node, Edge } from 'reactflow';

export const ollamaNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 50, y: 100 },
    data: { 
      label: 'Frontend Request',
      description: 'The browser sends a request to the Next.js API route',
      color: 'bg-green-500 text-white' 
    },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: { 
      label: 'Next.js API',
      description: 'The server-side API route processes the request and forwards it to Ollama',
      color: 'bg-blue-500 text-white' 
    },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 450, y: 100 },
    data: { 
      label: 'Local Ollama',
      description: 'The locally running Ollama instance receives the request on port 11434',
      color: 'bg-yellow-500 text-gray-900' 
    },
  },
  {
    id: '4',
    type: 'custom',
    position: { x: 650, y: 100 },
    data: { 
      label: 'LLM Processing',
      description: 'The selected model processes the request privately on your local machine',
      color: 'bg-orange-500 text-white' 
    },
  },
  {
    id: '5',
    type: 'custom',
    position: { x: 850, y: 100 },
    data: { 
      label: 'API Response',
      description: 'Ollama sends the response back to the Next.js API route',
      color: 'bg-red-500 text-white' 
    },
  },
  {
    id: '6',
    type: 'custom',
    position: { x: 1050, y: 100 },
    data: { 
      label: 'Frontend Display',
      description: 'The response is streamed back to the browser and displayed to the user',
      color: 'bg-green-500 text-white' 
    },
  },
  {
    id: '7',
    type: 'custom',
    position: { x: 450, y: 200 },
    data: { 
      label: 'Local Privacy',
      description: 'All data stays on your local machine, with no data sent to external servers',
      color: 'bg-emerald-500 text-white' 
    },
  },
];

export const ollamaEdges: Edge[] = [
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
    animated: true,
    style: { stroke: '#8b5cf6' },
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    animated: true,
    style: { stroke: '#ec4899' },
  },
  {
    id: 'e4-5',
    source: '4',
    target: '5',
    animated: true,
    style: { stroke: '#f59e0b' },
  },
  {
    id: 'e5-2',
    source: '5',
    target: '2',
    animated: true,
    type: 'smoothstep',
    style: { stroke: '#ef4444' },
  },
  {
    id: 'e2-6',
    source: '2',
    target: '6',
    animated: true,
    style: { stroke: '#10b981' },
  },
  {
    id: 'e7-3',
    source: '7',
    target: '3',
    type: 'smoothstep',
    animated: true,
    label: 'Data stays local',
    style: { stroke: '#3b82f6' },
  },
]; 