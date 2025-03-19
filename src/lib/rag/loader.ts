/**
 * Document loader for resume data
 * Supports loading resume content from various formats
 */

import fs from 'fs';
import path from 'path';

/**
 * Resume data structure
 */
export interface ResumeData {
  personalInfo: {
    name: string;
    title: string;
    summary: string;
    contact: {
      email: string;
      phone?: string;
      linkedin?: string;
      github?: string;
      website?: string;
    };
  };
  skills: {
    category: string;
    items: string[];
  }[];
  experience: {
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate: string | 'Present';
    description: string;
    achievements: string[];
    technologies?: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    location?: string;
    graduationDate: string;
    highlights?: string[];
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
    url?: string;
    highlights?: string[];
  }[];
  certifications?: {
    name: string;
    issuer: string;
    date: string;
    url?: string;
  }[];
}

/**
 * Document chunk with metadata for retrieval
 */
export interface DocumentChunk {
  content: string;
  metadata: {
    source: string;
    section: string;
    subsection?: string;
  };
}

/**
 * Mock resume data for development
 * This would be replaced with actual resume parsing
 */
export const mockResumeData: ResumeData = {
  personalInfo: {
    name: "Portfolio Owner",
    title: "Full-stack Developer",
    summary: "Experienced full-stack developer specializing in AI and machine learning applications.",
    contact: {
      email: "email@example.com",
      linkedin: "linkedin.com/in/portfolio-owner",
      github: "github.com/portfolio-owner",
      website: "portfolioowner.com"
    }
  },
  skills: [
    {
      category: "Frontend",
      items: ["React", "Next.js", "TypeScript", "TailwindCSS", "Framer Motion"]
    },
    {
      category: "Backend",
      items: ["Node.js", "Express", "Python", "FastAPI", "PostgreSQL"]
    },
    {
      category: "AI/ML",
      items: ["TensorFlow", "PyTorch", "LangChain", "Ollama", "RAG", "Embeddings"]
    },
    {
      category: "DevOps",
      items: ["Docker", "Vercel", "GitHub Actions", "AWS", "Monitoring"]
    }
  ],
  experience: [
    {
      title: "Senior Developer",
      company: "AI Solutions Inc.",
      location: "Remote",
      startDate: "2021",
      endDate: "Present",
      description: "Leading development of AI-powered applications for enterprise clients.",
      achievements: [
        "Designed and implemented RAG systems for knowledge retrieval",
        "Reduced API costs by 40% through optimization of prompt engineering",
        "Led team of 5 developers in creating innovative AI products"
      ],
      technologies: ["React", "TypeScript", "Python", "LangChain", "AWS"]
    },
    {
      title: "Full Stack Developer",
      company: "Web Agency",
      location: "San Francisco, CA",
      startDate: "2018",
      endDate: "2021",
      description: "Developed responsive web applications for various clients.",
      achievements: [
        "Built e-commerce platform using Next.js and Stripe",
        "Implemented real-time analytics dashboard with WebSockets",
        "Optimized database queries resulting in 60% faster page loads"
      ],
      technologies: ["React", "Node.js", "MongoDB", "Express", "AWS"]
    }
  ],
  education: [
    {
      degree: "Bachelor of Science in Computer Science",
      institution: "University of Technology",
      location: "Boston, MA",
      graduationDate: "2018",
      highlights: [
        "GPA: 3.8/4.0",
        "Senior project: AI-powered recommendation system",
        "Teaching Assistant for Web Development course"
      ]
    }
  ],
  projects: [
    {
      name: "AI Chat Platform",
      description: "A conversational AI platform using large language models with RAG capabilities.",
      technologies: ["React", "Next.js", "LangChain", "Redis", "OpenAI"],
      url: "github.com/portfolio-owner/ai-chat",
      highlights: [
        "Implemented streaming responses for natural conversation flow",
        "Built document retrieval system for grounding responses in facts",
        "Deployed on Vercel with serverless functions"
      ]
    },
    {
      name: "Terminal Portfolio",
      description: "An interactive terminal-style portfolio showcasing developer skills.",
      technologies: ["TypeScript", "React", "TailwindCSS", "Framer Motion"],
      url: "github.com/portfolio-owner/terminal-portfolio",
      highlights: [
        "Created terminal-inspired UI with Vim-like keybindings",
        "Integrated with local Ollama server for AI responses",
        "Implemented dark mode with custom terminal color theme"
      ]
    }
  ]
};

/**
 * Load resume data from various sources
 */
export async function loadResumeData(): Promise<ResumeData> {
  // In a production environment, this would parse actual resume files
  // For now, we return mock data
  return mockResumeData;
}

/**
 * Split resume data into chunks for retrieval
 */
export async function createDocumentChunks(): Promise<DocumentChunk[]> {
  const resumeData = await loadResumeData();
  const chunks: DocumentChunk[] = [];
  
  // Add personal info chunks
  chunks.push({
    content: `Name: ${resumeData.personalInfo.name}\nTitle: ${resumeData.personalInfo.title}\nSummary: ${resumeData.personalInfo.summary}`,
    metadata: {
      source: 'resume',
      section: 'personalInfo'
    }
  });
  
  // Add skills chunks
  resumeData.skills.forEach(skillCategory => {
    chunks.push({
      content: `Skills in ${skillCategory.category}: ${skillCategory.items.join(', ')}`,
      metadata: {
        source: 'resume',
        section: 'skills',
        subsection: skillCategory.category
      }
    });
  });
  
  // Add experience chunks
  resumeData.experience.forEach(job => {
    chunks.push({
      content: `Position: ${job.title} at ${job.company} (${job.startDate} - ${job.endDate})
Description: ${job.description}
Achievements: ${job.achievements.join('; ')}
Technologies: ${job.technologies?.join(', ') || ''}`,
      metadata: {
        source: 'resume',
        section: 'experience',
        subsection: job.company
      }
    });
  });
  
  // Add education chunks
  resumeData.education.forEach(edu => {
    chunks.push({
      content: `Degree: ${edu.degree} from ${edu.institution} (${edu.graduationDate})
${edu.highlights ? `Highlights: ${edu.highlights.join('; ')}` : ''}`,
      metadata: {
        source: 'resume',
        section: 'education',
        subsection: edu.institution
      }
    });
  });
  
  // Add project chunks
  resumeData.projects.forEach(project => {
    chunks.push({
      content: `Project: ${project.name}
Description: ${project.description}
Technologies: ${project.technologies.join(', ')}
${project.highlights ? `Highlights: ${project.highlights.join('; ')}` : ''}
${project.url ? `URL: ${project.url}` : ''}`,
      metadata: {
        source: 'resume',
        section: 'projects',
        subsection: project.name
      }
    });
  });
  
  return chunks;
} 