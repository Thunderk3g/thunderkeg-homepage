"use client";

import { useState } from "react";
import { useResumeData } from "./useResumeData";
import { ResumeHeader } from "./ResumeHeader";
import { ResumeTabs, type ResumeTabKey } from "./ResumeTabs";
import { SummaryTab } from "./SummaryTab";
import { ExperienceTab } from "./ExperienceTab";
import { ProjectsTab } from "./ProjectsTab";

export default function ResumeApp() {
  const { data, loading, error, reload } = useResumeData();
  const [activeTab, setActiveTab] = useState<ResumeTabKey>("summary");
  const [viewingPdf, setViewingPdf] = useState(false);

  return (
    <div className="flex h-full w-full flex-col bg-surface text-fg">
      <style jsx global>{`
        @media print {
          .resume-print-hide {
            display: none !important;
          }
          .resume-print-show {
            display: block !important;
          }
          [role="tabpanel"][hidden] {
            display: block !important;
          }
        }
      `}</style>

      {loading ? (
        <div className="flex h-full w-full items-center justify-center">
          <p className="font-mono text-sm text-muted">Loading resume…</p>
        </div>
      ) : error ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-mono text-sm text-danger">
            Couldn&apos;t load the resume.
          </p>
          <p className="max-w-md text-xs text-muted">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="rounded-sm border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/20 focus:bg-accent/20 focus:outline-none"
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          <ResumeHeader
            personal={data.personal}
            viewingPdf={viewingPdf}
            onTogglePdf={() => setViewingPdf((v) => !v)}
          />

          {viewingPdf ? (
            <div className="resume-print-hide min-h-0 flex-1 bg-bg print:hidden">
              <iframe
                src="/resume.pdf"
                title="Resume PDF"
                className="h-full w-full border-0"
              />
            </div>
          ) : (
            <>
              <ResumeTabs active={activeTab} onChange={setActiveTab} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SummaryTab resume={data} active={activeTab === "summary"} />
                <ExperienceTab
                  resume={data}
                  active={activeTab === "experience"}
                />
                <ProjectsTab resume={data} active={activeTab === "projects"} />
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
