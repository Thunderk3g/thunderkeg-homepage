"use client";

export type ResumeTabKey = "summary" | "experience" | "projects";

interface Tab {
  key: ResumeTabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: "summary", label: "Summary" },
  { key: "experience", label: "Experience" },
  { key: "projects", label: "Projects" },
];

interface ResumeTabsProps {
  active: ResumeTabKey;
  onChange: (key: ResumeTabKey) => void;
}

export function ResumeTabs({ active, onChange }: ResumeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Resume sections"
      className="resume-print-hide flex items-center gap-1 border-b border-border bg-surface px-4 print:hidden"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`resume-panel-${tab.key}`}
            id={`resume-tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={
              "relative -mb-px px-4 py-2 text-xs font-medium transition-colors focus:outline-none " +
              (isActive
                ? "border-b-2 border-accent text-accent"
                : "border-b-2 border-transparent text-muted hover:text-fg focus:text-fg")
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
