'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Resume } from '@/types/Resume';
import { Briefcase, GraduationCap, Code, Activity, User, Calendar, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface ProfileViewerProps {
  resumeData?: Resume;
}

const ProfileViewer: React.FC<ProfileViewerProps> = ({ resumeData }) => {
  const [activeTab, setActiveTab] = useState<'experience' | 'education' | 'skills' | 'projects'>('experience');
  const [resume, setResume] = useState<Resume | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If resume data is provided as a prop, use it
    if (resumeData) {
      setResume(resumeData);
      setIsLoading(false);
      return;
    }

    // Otherwise, fetch it
    const fetchResume = async () => {
      try {
        const res = await fetch('/api/resume');
        if (!res.ok) throw new Error('Failed to fetch resume data');
        const data = await res.json();
        setResume(data);
      } catch (error) {
        console.error('Error fetching resume:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResume();
  }, [resumeData]);

  // Format date to show month and year
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Present';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const renderLoading = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  const renderBasics = () => {
    if (!resume?.basics) return null;
    
    return (
      <div className="mb-6 border-b border-gray-700 pb-6">
        <div className="flex items-center mb-4">
          {resume.basics.image && (
            <div className="relative w-16 h-16 mr-4 rounded-full overflow-hidden border border-gray-600">
              <Image 
                src={resume.basics.image} 
                alt={resume.basics.name || 'Profile picture'} 
                fill
                sizes="64px"
                className="object-cover"
                priority
              />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white">{resume.basics.name}</h2>
            {resume.basics.label && (
              <p className="text-blue-400">{resume.basics.label}</p>
            )}
          </div>
        </div>
        
        {resume.basics.summary && (
          <p className="text-gray-300 mt-2">{resume.basics.summary}</p>
        )}
        
        {resume.basics.profiles && resume.basics.profiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {resume.basics.profiles.map((profile, index) => (
              <a 
                key={index}
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-300 hover:bg-gray-600 transition-colors"
              >
                {profile.network}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExperience = () => {
    if (!resume?.work || resume.work.length === 0) {
      return <p className="text-gray-400">No work experience found</p>;
    }

    return (
      <div className="space-y-6">
        {resume.work.map((job, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-800 p-4 rounded-lg"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-white">{job.position}</h3>
              <div className="flex items-center text-sm text-gray-400">
                <Calendar size={14} className="mr-1" />
                <span>{formatDate(job.startDate)} - {formatDate(job.endDate)}</span>
              </div>
            </div>
            
            <div className="flex items-center mb-3 text-blue-400">
              <Briefcase size={14} className="mr-1" />
              <span>{job.company}</span>
              {job.website && (
                <a 
                  href={job.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-gray-400 hover:text-blue-400"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            
            {job.summary && (
              <p className="text-gray-300 mb-3">{job.summary}</p>
            )}
            
            {job.highlights && job.highlights.length > 0 && (
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {job.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  const renderEducation = () => {
    if (!resume?.education || resume.education.length === 0) {
      return <p className="text-gray-400">No education found</p>;
    }

    return (
      <div className="space-y-6">
        {resume.education.map((edu, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-800 p-4 rounded-lg"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-white">{edu.studyType} in {edu.area}</h3>
              <div className="flex items-center text-sm text-gray-400">
                <Calendar size={14} className="mr-1" />
                <span>{formatDate(edu.startDate)} - {formatDate(edu.endDate)}</span>
              </div>
            </div>
            
            <div className="flex items-center mb-3 text-blue-400">
              <GraduationCap size={14} className="mr-1" />
              <span>{edu.institution}</span>
            </div>
            
            {edu.gpa && (
              <p className="text-gray-300 mb-3">GPA: {edu.gpa}</p>
            )}
            
            {edu.courses && edu.courses.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Relevant Courses:</h4>
                <div className="flex flex-wrap gap-2">
                  {edu.courses.map((course, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-700 rounded-md text-xs text-gray-300">
                      {course}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  const renderSkills = () => {
    if (!resume?.skills || resume.skills.length === 0) {
      return <p className="text-gray-400">No skills found</p>;
    }

    // Group skills by category if available
    const skillsByCategory: Record<string, typeof resume.skills> = {};
    
    resume.skills.forEach(skill => {
      const category = skill.category || 'Other';
      if (!skillsByCategory[category]) {
        skillsByCategory[category] = [];
      }
      skillsByCategory[category].push(skill);
    });

    return (
      <div className="space-y-6">
        {Object.entries(skillsByCategory).map(([category, skills], catIndex) => (
          <motion.div 
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.1 }}
          >
            <h3 className="text-lg font-semibold text-white mb-3">{category}</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <div 
                  key={index}
                  className="px-3 py-2 bg-gray-800 rounded-lg flex items-center"
                >
                  <span className="text-gray-300">{skill.name}</span>
                  {skill.level && (
                    <div className="ml-2 w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ 
                          width: (() => {
                            switch(skill.level.toLowerCase()) {
                              case 'expert': return '100%';
                              case 'advanced': return '80%';
                              case 'intermediate': return '60%';
                              case 'beginner': return '40%';
                              default: return '50%';
                            }
                          })()
                        }}
                      ></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderProjects = () => {
    if (!resume?.projects || resume.projects.length === 0) {
      return <p className="text-gray-400">No projects found</p>;
    }

    return (
      <div className="space-y-6">
        {resume.projects.map((project, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-800 p-4 rounded-lg"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-white">{project.name}</h3>
              {(project.startDate || project.endDate) && (
                <div className="flex items-center text-sm text-gray-400">
                  <Calendar size={14} className="mr-1" />
                  <span>
                    {project.startDate ? formatDate(project.startDate) : ''}
                    {project.startDate && project.endDate ? ' - ' : ''}
                    {project.endDate ? formatDate(project.endDate) : ''}
                  </span>
                </div>
              )}
            </div>
            
            {project.url && (
              <div className="flex items-center mb-3 text-blue-400">
                <ExternalLink size={14} className="mr-1" />
                <a 
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Project Link
                </a>
              </div>
            )}
            
            <p className="text-gray-300 mb-3">{project.description}</p>
            
            {project.highlights && project.highlights.length > 0 && (
              <ul className="list-disc list-inside text-gray-300 space-y-1 mb-3">
                {project.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>
            )}
            
            {project.keywords && project.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {project.keywords.map((keyword, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-700 rounded-md text-xs text-gray-300">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden">
      {isLoading ? (
        renderLoading()
      ) : !resume ? (
        <div className="p-6 text-center text-gray-400">
          <p>Resume data could not be loaded.</p>
        </div>
      ) : (
        <div>
          <div className="p-6">
            {renderBasics()}
            
            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-6">
              <button
                onClick={() => setActiveTab('experience')}
                className={`flex items-center px-4 py-2 mr-2 ${
                  activeTab === 'experience' 
                    ? 'text-blue-400 border-b-2 border-blue-400' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Briefcase size={16} className="mr-2" />
                <span>Experience</span>
              </button>
              <button
                onClick={() => setActiveTab('education')}
                className={`flex items-center px-4 py-2 mr-2 ${
                  activeTab === 'education' 
                    ? 'text-blue-400 border-b-2 border-blue-400' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <GraduationCap size={16} className="mr-2" />
                <span>Education</span>
              </button>
              <button
                onClick={() => setActiveTab('skills')}
                className={`flex items-center px-4 py-2 mr-2 ${
                  activeTab === 'skills' 
                    ? 'text-blue-400 border-b-2 border-blue-400' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Activity size={16} className="mr-2" />
                <span>Skills</span>
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`flex items-center px-4 py-2 ${
                  activeTab === 'projects' 
                    ? 'text-blue-400 border-b-2 border-blue-400' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Code size={16} className="mr-2" />
                <span>Projects</span>
              </button>
            </div>
            
            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'experience' && renderExperience()}
                {activeTab === 'education' && renderEducation()}
                {activeTab === 'skills' && renderSkills()}
                {activeTab === 'projects' && renderProjects()}
              </motion.div>
            </AnimatePresence>
          </div>
          
          <div className="bg-gray-800 px-6 py-3 text-center text-sm text-gray-400">
            Resume data is available to the AI Terminal for more detailed queries about my background.
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileViewer; 