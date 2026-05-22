import { z } from "zod";

export const PersonalSchema = z.object({
  full_name: z.string(),
  title: z.string(),
  email: z.string().email(),
  phone: z.string(),
  location: z.string(),
  linkedin: z.string().url().optional(),
  github: z.string().url().optional(),
  twitter: z.string().url().optional(),
});

export const ExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  bullets: z.array(z.string()),
});

export const EducationSchema = z.object({
  degree: z.string(),
  major: z.string().optional(),
  institution: z.string(),
  cgpa: z.string().optional(),
  start_date: z.string(),
  end_date: z.string(),
});

export const ProjectSchema = z.object({
  name: z.string(),
  blurb: z.string(),
  tech: z.array(z.string()).optional(),
  link: z.string().url().optional(),
});

export const ResearchSchema = z.object({
  title: z.string(),
  venue: z.string().optional(),
});

export const ResumeSchema = z.object({
  personal: PersonalSchema,
  summary: z.string(),
  experience: z.array(ExperienceSchema),
  skills: z.array(z.string()),
  education: z.array(EducationSchema),
  projects: z.array(ProjectSchema),
  awards: z.array(z.string()),
  research: z.array(ResearchSchema),
});

export type Resume = z.infer<typeof ResumeSchema>;
export type Personal = z.infer<typeof PersonalSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
