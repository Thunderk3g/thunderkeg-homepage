import type { Metadata } from 'next';
import { ManPage, Sec } from '@/content/ManPage';
import { BriefForm } from '@/hire/BriefForm';
import { Process, Services, Status } from '@/hire/HireContent';
import { hire, profile } from '@/data/resume';

export const metadata: Metadata = {
  title: 'Work with me — Diwakar Adhikari',
  description:
    'Freelance projects, consulting and roles: retrieval-grounded LLM systems, evaluation and audits of AI systems, speech and ASR pipelines for Indian languages, document AI, agent governance.',
  alternates: { canonical: '/hire' },
};

export default function HirePage() {
  return (
    <ManPage name="HIRE" section={1} current="/hire">
      <div className="hire man-hire">
        <Sec title="NAME">
          <h1>Work with me</h1>
          <p className="man-role">{profile.tagline}</p>
        </Sec>

        <Sec title="STATUS">
          <Status />
        </Sec>

        <Sec title="SERVICES">
          <Services />
        </Sec>

        <Sec title="USAGE">
          <Process />
        </Sec>

        {hire.open && (
          <Sec title="BRIEF" id="brief">
            <BriefForm />
            <noscript>
              <p>
                The form needs JavaScript. Email <a href={`mailto:${profile.email}`}>{profile.email}</a> directly.
              </p>
            </noscript>
          </Sec>
        )}

        <Sec title="SEE ALSO">
          <p className="man-seealso">
            <a href="/resume">diwakar(1)</a>, <a href="/writing">writing(7)</a>, <a href="/">desktop(1)</a>
          </p>
        </Sec>
      </div>
    </ManPage>
  );
}
