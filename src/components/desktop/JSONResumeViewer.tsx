import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Resume data structure (will be loaded from JSON in production)
interface ResumeBasics {
  name: string;
  label: string;
  email: string;
  phone: string;
  website: string;
  summary: string;
  location: {
    city: string;
    countryCode: string;
    region: string;
  };
  profiles: {
    network: string;
    username: string;
    url: string;
  }[];
}

interface ResumeSkill {
  name: string;
  level: string;
  keywords: string[];
}

interface ResumeWork {
  company: string;
  position: string;
  website: string;
  startDate: string;
  endDate: string | null;
  summary: string;
  highlights: string[];
}

interface ResumeEducation {
  institution: string;
  area: string;
  studyType: string;
  startDate: string;
  endDate: string;
  gpa: string;
}

interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

interface Resume {
  basics: ResumeBasics;
  skills: ResumeSkill[];
  work: ResumeWork[];
  education: ResumeEducation[];
  projects: ResumeProject[];
}

// Sample resume data
const sampleResume: Resume = {
  basics: {
    name: "Jane Doe",
    label: "AI Engineer and Full Stack Developer",
    email: "jane.doe@example.com",
    phone: "(123) 456-7890",
    website: "https://janedoe.dev",
    summary: "Innovative AI engineer and full stack developer with 5+ years of experience building intelligent applications. Specialized in machine learning models, NLP, and creating responsive user interfaces. Strong foundation in software design principles and agile methodologies.",
    location: {
      city: "San Francisco",
      countryCode: "US",
      region: "California"
    },
    profiles: [
      {
        network: "GitHub",
        username: "janedoe",
        url: "https://github.com/janedoe"
      },
      {
        network: "LinkedIn",
        username: "janedoe",
        url: "https://linkedin.com/in/janedoe"
      }
    ]
  },
  skills: [
    {
      name: "Programming Languages",
      level: "Advanced",
      keywords: ["Python", "JavaScript", "TypeScript", "C++"]
    },
    {
      name: "Machine Learning",
      level: "Advanced",
      keywords: ["TensorFlow", "PyTorch", "scikit-learn", "NLP"]
    },
    {
      name: "Web Development",
      level: "Advanced",
      keywords: ["React", "Next.js", "Node.js", "Express"]
    },
    {
      name: "DevOps",
      level: "Intermediate",
      keywords: ["Docker", "Kubernetes", "CI/CD", "AWS"]
    }
  ],
  work: [
    {
      company: "AI Solutions Inc.",
      position: "Senior AI Engineer",
      website: "https://aisolutions.example.com",
      startDate: "2021-01",
      endDate: null,
      summary: "Lead AI developer for natural language processing applications",
      highlights: [
        "Developed conversational AI system improving customer service efficiency by 45%",
        "Led team of 5 engineers in implementing sentiment analysis features",
        "Optimized machine learning pipelines reducing inference time by 60%"
      ]
    },
    {
      company: "TechCorp",
      position: "Full Stack Developer",
      website: "https://techcorp.example.com",
      startDate: "2018-03",
      endDate: "2020-12",
      summary: "Worked on enterprise SaaS platform for data analytics",
      highlights: [
        "Designed and implemented real-time dashboard with React and WebSockets",
        "Built RESTful API services using Node.js and Express",
        "Improved page load times by 70% through code optimization"
      ]
    }
  ],
  education: [
    {
      institution: "University of California, Berkeley",
      area: "Computer Science",
      studyType: "Master's Degree",
      startDate: "2016-09",
      endDate: "2018-05",
      gpa: "3.9"
    },
    {
      institution: "Stanford University",
      area: "Software Engineering",
      studyType: "Bachelor's Degree",
      startDate: "2012-09",
      endDate: "2016-05",
      gpa: "3.8"
    }
  ],
  projects: [
    {
      name: "Neural Chat",
      description: "Open-source conversational AI framework with custom training capabilities",
      technologies: ["Python", "TensorFlow", "React", "Flask"],
      url: "https://github.com/janedoe/neural-chat"
    },
    {
      name: "DataViz Platform",
      description: "Interactive data visualization platform for scientific research",
      technologies: ["D3.js", "TypeScript", "Node.js", "MongoDB"],
      url: "https://github.com/janedoe/dataviz-platform"
    }
  ]
};

const JSONResumeViewer: React.FC = () => {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(2); // Hardcoded for this demo
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Load resume data from JSON file
  useEffect(() => {
    const fetchResume = async () => {
      try {
        setLoading(true);
        const response = await fetch('/resume.json');
        if (!response.ok) {
          throw new Error('Failed to fetch resume data');
        }
        
        const data = await response.json();
        
        // Transform data to fit our Resume interface
        const transformedData: Resume = {
          basics: {
            name: data.personal_information.full_name,
            label: data.personal_information.title || "Software Engineer",
            email: data.personal_information.email,
            phone: data.personal_information.phone,
            website: data.personal_information.website || "",
            summary: data.summary,
            location: {
              city: data.personal_information.location.split(',')[0].trim(),
              countryCode: "IN",
              region: data.personal_information.location.split(',')[1]?.trim() || "India"
            },
            profiles: []
          },
          skills: data.skills.map((skill: string) => ({
            name: skill,
            level: "Advanced",
            keywords: [skill]
          })),
          work: data.work_experience.map((job: any) => ({
            company: job.company,
            position: job.job_title,
            website: "",
            startDate: job.start_date,
            endDate: job.end_date === "Present" ? null : job.end_date,
            summary: job.responsibilities[0] || "",
            highlights: job.responsibilities.slice(1) || []
          })),
          education: data.education?.map((edu: any) => ({
            institution: edu.institution,
            area: edu.field_of_study,
            studyType: edu.degree,
            startDate: edu.start_date,
            endDate: edu.end_date,
            gpa: edu.grade || ""
          })) || [],
          projects: data.projects?.map((project: any) => ({
            name: project.name,
            description: project.description,
            technologies: project.technologies || [],
            url: project.url || ""
          })) || []
        };
        
        setResume(transformedData);
      } catch (error) {
        console.error('Error loading resume:', error);
        // Fall back to sample resume data if loading fails
        setResume(sampleResume);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResume();
  }, []);
  
  // Format date from YYYY-MM to MMM YYYY
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Present';
    
    const [year, month] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  
  const handleZoomIn = () => {
    if (zoomLevel < 1.5) setZoomLevel(prev => prev + 0.1);
  };
  
  const handleZoomOut = () => {
    if (zoomLevel > 0.7) setZoomLevel(prev => prev - 0.1);
  };
  
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };
  
  // Generate and download PDF
  const handleDownloadPDF = () => {
    if (!resume) return;
    
    // Create new PDF document
    const doc = new jsPDF();
    
    // Add resume data to PDF
    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(resume.basics.name, 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(resume.basics.label, 105, 28, { align: 'center' });
    
    // Contact info
    doc.setFontSize(10);
    let contactText = `${resume.basics.email} | ${resume.basics.phone} | ${resume.basics.location.city}, ${resume.basics.location.region}`;
    doc.text(contactText, 105, 36, { align: 'center' });
    
    // Summary
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Professional Summary', 20, 48);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 50, 190, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const summaryLines = doc.splitTextToSize(resume.basics.summary, 170);
    doc.text(summaryLines, 20, 56);
    
    // Skills
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    let yPos = 56 + (summaryLines.length * 5);
    doc.text('Skills', 20, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    
    yPos += 8;
    doc.setFontSize(10);
    
    // Create a skills list
    const skills = resume.skills.map(skill => skill.name).join(' • ');
    const skillsLines = doc.splitTextToSize(skills, 170);
    doc.text(skillsLines, 20, yPos);
    
    // Work Experience
    yPos += (skillsLines.length * 5) + 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Professional Experience', 20, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    
    yPos += 8;
    resume.work.forEach(job => {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(job.position, 20, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${job.company} | ${formatDate(job.startDate)} - ${formatDate(job.endDate)}`, 20, yPos + 5);
      
      doc.setTextColor(80, 80, 80);
      yPos += 10;
      
      // Job highlights
      if (job.highlights.length > 0) {
        job.highlights.forEach(highlight => {
          const lines = doc.splitTextToSize('• ' + highlight, 160);
          doc.text(lines, 25, yPos);
          yPos += (lines.length * 5);
        });
      }
      
      yPos += 5;
    });
    
    // Education (on second page if needed)
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Education', 20, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    
    yPos += 8;
    resume.education.forEach(edu => {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`${edu.studyType} in ${edu.area}`, 20, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${edu.institution} | ${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}`, 20, yPos + 5);
      
      yPos += 12;
    });
    
    // Projects
    if (resume.projects.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Projects', 20, yPos);
      doc.line(20, yPos + 2, 190, yPos + 2);
      
      yPos += 8;
      resume.projects.forEach(project => {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(project.name, 20, yPos);
        
        yPos += 5;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const descLines = doc.splitTextToSize(project.description, 170);
        doc.text(descLines, 20, yPos);
        
        yPos += (descLines.length * 5) + 5;
        
        if (project.technologies.length > 0) {
          const techText = project.technologies.join(', ');
          doc.setTextColor(100, 100, 100);
          doc.text(`Technologies: ${techText}`, 20, yPos);
          yPos += 8;
        }
      });
    }
    
    // Save PDF
    doc.save('resume.pdf');
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <button 
            className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-green-400"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-green-400"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-green-400"
            onClick={handleZoomOut}
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs">{Math.round(zoomLevel * 100)}%</span>
          <button 
            className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-green-400"
            onClick={handleZoomIn}
          >
            <ZoomIn size={18} />
          </button>
          <button className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-green-400" onClick={handleDownloadPDF}>
            <Download size={18} />
          </button>
        </div>
      </div>
      
      {/* PDF-like viewer */}
      <div className="flex-1 overflow-auto bg-gray-900 p-4 flex justify-center">
        <div 
          className="bg-white text-black rounded-md shadow-lg overflow-hidden"
          style={{ 
            width: '8.5in', 
            height: '11in',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            display: currentPage === 1 ? 'block' : 'none'
          }}
        >
          {/* Page 1 content */}
          <div className="p-8 h-full">
            {/* Header section */}
            <div className="border-b-2 border-gray-300 pb-4 mb-6">
              <h1 className="text-3xl font-bold text-center text-gray-800">{resume?.basics.name}</h1>
              <p className="text-center text-gray-600 mt-1">{resume?.basics.label}</p>
              <div className="flex justify-center mt-2 space-x-4 text-sm text-gray-600">
                <span>{resume?.basics.email}</span>
                <span>{resume?.basics.phone}</span>
                <span>{resume?.basics.location.city}, {resume?.basics.location.region}</span>
              </div>
              <div className="flex justify-center mt-1 space-x-4 text-sm text-blue-600">
                {resume?.basics.profiles.map((profile, index) => (
                  <span key={index}>{profile.network}: {profile.username}</span>
                ))}
              </div>
            </div>
            
            {/* Summary section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-gray-800 border-b border-gray-200 pb-1">Professional Summary</h2>
              <p className="text-gray-700">{resume?.basics.summary}</p>
            </div>
            
            {/* Skills section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-gray-800 border-b border-gray-200 pb-1">Skills</h2>
              <div className="grid grid-cols-2 gap-4">
                {resume?.skills.map((skill, index) => (
                  <div key={index} className="mb-2">
                    <h3 className="font-bold text-gray-800">{skill.name}</h3>
                    <p className="text-gray-700 text-sm">{skill.keywords.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Work Experience section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-gray-800 border-b border-gray-200 pb-1">Professional Experience</h2>
              {resume?.work.map((job, index) => (
                <div key={index} className="mb-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">{job.position}</h3>
                    <span className="text-sm text-gray-600">
                      {formatDate(job.startDate)} - {formatDate(job.endDate)}
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">{job.company}</p>
                  <p className="text-gray-700 text-sm mt-1">{job.summary}</p>
                  <ul className="list-disc pl-5 mt-1">
                    {job.highlights.map((highlight, i) => (
                      <li key={i} className="text-gray-700 text-sm">{highlight}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div 
          className="bg-white text-black rounded-md shadow-lg overflow-hidden"
          style={{ 
            width: '8.5in', 
            height: '11in',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            display: currentPage === 2 ? 'block' : 'none'
          }}
        >
          {/* Page 2 content */}
          <div className="p-8 h-full">
            {/* Education section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-gray-800 border-b border-gray-200 pb-1">Education</h2>
              {resume?.education.map((edu, index) => (
                <div key={index} className="mb-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">{edu.institution}</h3>
                    <span className="text-sm text-gray-600">
                      {formatDate(edu.startDate)} - {formatDate(edu.endDate)}
                    </span>
                  </div>
                  <p className="text-gray-700">{edu.studyType} in {edu.area}</p>
                  {edu.gpa && <p className="text-gray-700 text-sm">GPA: {edu.gpa}</p>}
                </div>
              ))}
            </div>
            
            {/* Projects section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-gray-800 border-b border-gray-200 pb-1">Projects</h2>
              {resume?.projects.map((project, index) => (
                <div key={index} className="mb-4">
                  <h3 className="font-bold text-gray-800">{project.name}</h3>
                  <p className="text-gray-700 text-sm mt-1">{project.description}</p>
                  <div className="flex flex-wrap mt-1 gap-1">
                    {project.technologies.map((tech, i) => (
                      <span key={i} className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded text-xs">
                        {tech}
                      </span>
                    ))}
                  </div>
                  {project.url && (
                    <p className="text-blue-600 text-sm mt-1">{project.url}</p>
                  )}
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-gray-200 text-center text-gray-600 text-sm">
              <p>References available upon request</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JSONResumeViewer; 