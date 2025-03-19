/**
 * Document retriever for finding relevant resume chunks
 */

import { DocumentChunk, createDocumentChunks } from './loader';

// Simple similarity function using keyword matching
// In a production environment, this would use embeddings and vector search
function calculateSimilarity(query: string, text: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();
  
  // Count matches of query terms in the text
  const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 2);
  let matchCount = 0;
  
  queryTerms.forEach(term => {
    if (normalizedText.includes(term)) {
      matchCount++;
    }
  });
  
  // Calculate similarity score
  return queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
}

/**
 * Retrieve relevant document chunks based on query
 */
export async function retrieveRelevantDocuments(
  query: string,
  agentType: 'recruiter' | 'collaborator'
): Promise<DocumentChunk[]> {
  const chunks = await createDocumentChunks();
  
  // Filter chunks based on agent type (optional)
  const filteredChunks = agentType === 'recruiter'
    ? chunks.filter(chunk => 
        ['skills', 'experience', 'education', 'personalInfo'].includes(chunk.metadata.section))
    : chunks.filter(chunk => 
        ['projects', 'personalInfo'].includes(chunk.metadata.section));
  
  // Calculate similarity scores
  const scoredChunks = filteredChunks.map(chunk => ({
    chunk,
    score: calculateSimilarity(query, chunk.content)
  }));
  
  // Sort by similarity score (descending)
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // Return top chunks (with score above threshold)
  const threshold = 0.2;
  return scoredChunks
    .filter(item => item.score > threshold)
    .slice(0, 3) // Limit to top 3 relevant chunks
    .map(item => item.chunk);
} 