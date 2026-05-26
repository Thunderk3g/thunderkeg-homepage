import resumeJson from "./resume.json";

export interface PersonalInformation {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string | null;
  github: string | null;
}

export interface WorkExperience {
  job_title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  responsibilities: string[];
}

export interface Education {
  degree: string;
  major: string;
  university: string;
  cgpa: string;
  start_date: string;
  end_date: string;
}

export interface Certification {
  title: string;
  issuer: string;
  duration: string;
}

export interface Project {
  title: string;
  description: string;
}

export interface ResearchItem {
  title: string;
  institution?: string;
}

export interface Resume {
  personal_information: PersonalInformation;
  summary: string;
  skills: string[];
  work_experience: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  awards: string[];
  projects: Project[];
  research_and_recognition: ResearchItem[];
  technologies_and_tools: string[];
}

export const resume: Resume = resumeJson as Resume;
