import { Node } from 'reactflow';
import { Edge } from '@/components/ui/FlowChart';

export const ragNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 50, y: 100 },
    data: { 
      label: 'User Query',
      description: 'The user asks a question about the portfolio or resume data',
      color: 'bg-green-500 text-white' 
    },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: { 
      label: 'Query Embedding',
      description: 'The query is converted into a vector embedding using a specialized embedding model',
      color: 'bg-blue-500 text-white' 
    },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 450, y: 100 },
    data: { 
      label: 'Vector Search',
      description: 'The embedding is used to search for similar content in the vector database',
      color: 'bg-purple-500 text-white' 
    },
  },
  {
    id: '4',
    type: 'custom',
    position: { x: 650, y: 100 },
    data: { 
      label: 'Document Retrieval',
      description: 'Relevant documents or sections from resume.json are retrieved based on vector similarity',
      color: 'bg-yellow-500 text-gray-900' 
    },
  },
  {
    id: '5',
    type: 'custom',
    position: { x: 850, y: 100 },
    data: { 
      label: 'Context Injection',
      description: 'The retrieved content is added to the prompt as context for the LLM',
      color: 'bg-orange-500 text-white' 
    },
  },
  {
    id: '6',
    type: 'custom',
    position: { x: 1050, y: 100 },
    data: { 
      label: 'LLM Response',
      description: 'The LLM generates a response using both the query and the retrieved context',
      color: 'bg-red-500 text-white' 
    },
  },
  {
    id: '7',
    type: 'custom',
    position: { x: 850, y: 200 },
    data: { 
      label: 'Resume.json',
      description: 'The structured resume data that has been converted into searchable vector embeddings',
      color: 'bg-emerald-500 text-white' 
    },
  },
];

export const ragEdges: Edge[] = [
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
    id: 'e5-6',
    source: '5',
    target: '6',
    animated: true,
    style: { stroke: '#ef4444' },
  },
  {
    id: 'e7-4',
    source: '7',
    target: '4',
    animated: true,
    label: 'Provides data',
    style: { stroke: '#10b981' },
  },
]; 