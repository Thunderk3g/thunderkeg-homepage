"use client";

import type { Personal } from "@/lib/resume/schema";
import {
  Mail,
  Phone,
  MapPin,
  Github,
  Linkedin,
  Download,
  FileText,
  LayoutList,
} from "lucide-react";

interface ResumeHeaderProps {
  personal: Personal;
  viewingPdf: boolean;
  onTogglePdf: () => void;
}

function handleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? u.hostname;
  } catch {
    return url;
  }
}

export function ResumeHeader({
  personal,
  viewingPdf,
  onTogglePdf,
}: ResumeHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-elevated px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-mono text-xl font-semibold text-fg">
          {personal.full_name}
        </h1>
        <p className="mt-1 text-sm text-accent">{personal.title}</p>

        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <MapPin size={12} className="text-accent" aria-hidden="true" />
            <span>{personal.location}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Mail size={12} className="text-accent" aria-hidden="true" />
            <a
              href={`mailto:${personal.email}`}
              className="text-fg hover:text-accent focus:text-accent focus:outline-none"
            >
              {personal.email}
            </a>
          </li>
          <li className="flex items-center gap-1.5">
            <Phone size={12} className="text-accent" aria-hidden="true" />
            <a
              href={`tel:${personal.phone.replace(/\s+/g, "")}`}
              className="text-fg hover:text-accent focus:text-accent focus:outline-none"
            >
              {personal.phone}
            </a>
          </li>
          {personal.github ? (
            <li className="flex items-center gap-1.5">
              <Github size={12} className="text-accent" aria-hidden="true" />
              <a
                href={personal.github}
                target="_blank"
                rel="noreferrer"
                className="text-fg hover:text-accent focus:text-accent focus:outline-none"
              >
                {handleFromUrl(personal.github)}
              </a>
            </li>
          ) : null}
          {personal.linkedin ? (
            <li className="flex items-center gap-1.5">
              <Linkedin size={12} className="text-accent" aria-hidden="true" />
              <a
                href={personal.linkedin}
                target="_blank"
                rel="noreferrer"
                className="text-fg hover:text-accent focus:text-accent focus:outline-none"
              >
                {handleFromUrl(personal.linkedin)}
              </a>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="resume-print-hide flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={onTogglePdf}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-3 py-1.5 text-xs text-fg transition-colors hover:border-accent hover:text-accent focus:border-accent focus:text-accent focus:outline-none"
          aria-pressed={viewingPdf}
        >
          {viewingPdf ? (
            <>
              <LayoutList size={14} aria-hidden="true" />
              <span>View Tabs</span>
            </>
          ) : (
            <>
              <FileText size={14} aria-hidden="true" />
              <span>View PDF</span>
            </>
          )}
        </button>
        <a
          href="/resume.pdf"
          download
          className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/20 focus:bg-accent/20 focus:outline-none"
        >
          <Download size={14} aria-hidden="true" />
          <span>Download PDF</span>
        </a>
      </div>
    </header>
  );
}
