export interface Education {
  institution: string;
  area: string;
  studyType: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
  courses?: string[];
}

export interface WorkExperience {
  company: string;
  position: string;
  website?: string;
  startDate: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface Project {
  name: string;
  description: string;
  highlights?: string[];
  keywords?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  roles?: string[];
  entity?: string;
  type?: string;
}

export interface Skill {
  name: string;
  level?: string;
  keywords?: string[];
  category?: string;
}

export interface Basics {
  name: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: {
    address?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
    region?: string;
  };
  profiles?: Array<{
    network: string;
    username: string;
    url: string;
  }>;
}

export interface Resume {
  basics: Basics;
  work: WorkExperience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
  awards?: Array<{
    title: string;
    date: string;
    awarder: string;
    summary: string;
  }>;
  publications?: Array<{
    name: string;
    publisher: string;
    releaseDate: string;
    website: string;
    summary: string;
  }>;
  languages?: Array<{
    language: string;
    fluency: string;
  }>;
  interests?: Array<{
    name: string;
    keywords: string[];
  }>;
  references?: Array<{
    name: string;
    reference: string;
  }>;
} 