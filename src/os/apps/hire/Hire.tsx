'use client';

import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { hire, profile } from '@/data/resume';
import { BriefForm } from '@/hire/BriefForm';
import { DirectLinks, Process, Services, Status } from '@/hire/HireContent';
import { downloadResumePdf } from '../terminal/commands/pdf';

/**
 * Work with me — what I take on, and a brief builder that turns into an
 * email. The same content is served without the desktop at /hire.
 *
 * Launch args: `engagement` preselects the kind of enquiry ('project',
 * 'consult', 'role', 'research').
 */
function HireApp({ args }: AppProps) {
  const launch = useOS((s) => s.launch);
  const engagement =
    typeof args?.engagement === 'string' && hire.engagements.some((e) => e.id === args.engagement)
      ? args.engagement
      : 'project';

  // /writing links open in the desktop's own Writing app
  const renderLink = (href: string, label: string) =>
    href.startsWith('/writing/') ? (
      <button className="hire-link" onClick={() => launch('writing', { slug: href.slice('/writing/'.length) })}>
        {label}
      </button>
    ) : (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );

  return (
    <div className="kos-hire-wrap">
    <div className="hire kos-hire">
      <div className="hire-about">
        <Status />
        <h1>Work with me</h1>
        <p className="hire-lede">{profile.tagline}</p>

        <h2>What I take on</h2>
        <Services renderLink={renderLink} />

        <h2>How it starts</h2>
        <Process />

        <DirectLinks>
          <button className="hire-link" onClick={() => downloadResumePdf()}>
            Download résumé (PDF)
          </button>
          <button className="hire-link" onClick={() => launch('browser', { page: 'experience' })}>
            Full experience
          </button>
        </DirectLinks>
      </div>
      <div className="hire-brief">
        <h2>Send a brief</h2>
        <BriefForm key={engagement} initialEngagement={engagement} />
      </div>
    </div>
    </div>
  );
}

export const hireApp: AppDefinition = {
  id: 'hire',
  title: 'Work with me',
  icon: '✉',
  category: 'Internet',
  component: HireApp,
  description: 'What I take on, and a project brief that becomes an email',
  defaultSize: { width: 1040, height: 680 },
  minSize: { width: 380, height: 360 },
  desktop: true,
  launchCommands: ['hire', 'contact', 'gig'],
};

export default HireApp;
