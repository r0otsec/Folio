import { useState } from 'react'
import {
  BookOpen, GitBranch, Shield, BarChart2, Hash, FileDown,
  Library, Building2, Terminal, Archive, Users, ChevronRight, HelpCircle,
} from 'lucide-react'

type TopicId =
  | 'terminology' | 'workflow' | 'findings' | 'severity'
  | 'cvss' | 'generation' | 'knowledge-base' | 'clients'
  | 'red-team' | 'archiving' | 'roles'

const NAV: { id: TopicId; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'terminology',    label: 'Terminology',           icon: <BookOpen size={13} />,   color: '#9184d9' },
  { id: 'workflow',       label: 'Typical Workflow',      icon: <GitBranch size={13} />,  color: '#1a9e6a' },
  { id: 'findings',       label: 'Findings & Evidence',   icon: <Shield size={13} />,     color: '#f4802b' },
  { id: 'severity',       label: 'Severity Ratings',      icon: <BarChart2 size={13} />,  color: '#e63946' },
  { id: 'cvss',           label: 'CVSS Scoring',          icon: <Hash size={13} />,       color: '#1a7dd9' },
  { id: 'generation',     label: 'Report Generation',     icon: <FileDown size={13} />,   color: '#14b8a6' },
  { id: 'knowledge-base', label: 'Knowledge Base',        icon: <Library size={13} />,    color: '#f5c518' },
  { id: 'clients',        label: 'Clients & Scoping',     icon: <Building2 size={13} />,  color: '#2196f3' },
  { id: 'red-team',       label: 'Red Team Tools',        icon: <Terminal size={13} />,   color: '#e63946' },
  { id: 'archiving',      label: 'Archiving & Lifecycle', icon: <Archive size={13} />,    color: '#8b949e' },
  { id: 'roles',          label: 'User Roles',            icon: <Users size={13} />,      color: '#9184d9' },
]

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: 'var(--mono)', fontSize: 11,
      background: 'rgba(145,132,217,0.12)', border: '1px solid rgba(145,132,217,0.25)',
      padding: '1px 6px', borderRadius: 3, color: '#b0a4e8',
    }}>{children}</code>
  )
}

function Callout({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' | 'tip' }) {
  const cfg = {
    info: { bg: 'rgba(26,125,217,0.08)', border: '#1a7dd9', label: 'Note' },
    warn: { bg: 'rgba(245,197,24,0.09)', border: '#f5c518', label: 'Warning' },
    tip:  { bg: 'rgba(26,158,106,0.09)', border: '#1a9e6a', label: 'Tip' },
  }[type]
  return (
    <div style={{
      background: cfg.bg, borderLeft: `3px solid ${cfg.border}`,
      borderRadius: '0 6px 6px 0', padding: '12px 16px', margin: '18px 0',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: cfg.border, marginBottom: 5 }}>{cfg.label}</div>
      <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{
        fontSize: 24, fontWeight: 700, color: 'var(--c-text-1)',
        margin: '0 0 8px', letterSpacing: '-0.02em',
      }}>{children}</h2>
      <div style={{ height: 3, width: 40, background: color, borderRadius: 2 }} />
    </div>
  )
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: '0 0 24px', lineHeight: 1.7 }}>{children}</p>
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--c-text-3)',
      margin: '28px 0 10px',
    }}>{children}</p>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.75, margin: '0 0 12px' }}>{children}</p>
}

function DefTable({ rows }: { rows: [string, React.ReactNode, string?][] }) {
  return (
    <div style={{ border: '1px solid var(--c-border)', borderRadius: 6, overflow: 'hidden', margin: '12px 0' }}>
      {rows.map(([term, def, color], i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '190px 1fr',
          borderBottom: i < rows.length - 1 ? '1px solid var(--c-border)' : 'none',
        }}>
          <div style={{
            padding: '10px 14px', fontWeight: 600, fontSize: 12,
            color: color || 'var(--c-text-1)',
            background: color ? `${color}12` : 'var(--c-surface)',
            borderRight: `2px solid ${color || 'var(--c-border)'}`,
          }}>{term}</div>
          <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6 }}>{def}</div>
        </div>
      ))}
    </div>
  )
}

function Steps({ items, color }: { items: React.ReactNode[]; color: string }) {
  return (
    <div style={{ margin: '16px 0' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
          <div style={{
            flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
            background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, marginTop: 1, boxShadow: `0 0 0 3px ${color}22`,
          }}>{i + 1}</div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.75, paddingTop: 4 }}>{item}</div>
        </div>
      ))}
    </div>
  )
}

function SevCard({ label, color, dark, desc }: { label: string; color: string; dark?: boolean; desc: string }) {
  return (
    <div style={{
      display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden',
      border: '1px solid var(--c-border)', marginBottom: 8,
    }}>
      <div style={{
        width: 120, flexShrink: 0, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '14px 0', fontWeight: 700, fontSize: 12, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: dark ? '#1a1a1a' : '#fff',
      }}>{label}</div>
      <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.65, background: 'var(--c-surface)' }}>{desc}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--c-border)', margin: '22px 0' }} />
}

const CONTENT: Record<TopicId, { color: string; node: React.ReactNode }> = {
  terminology: {
    color: '#9184d9',
    node: (
      <>
        <Lead>Key terms used throughout Folio and this documentation.</Lead>
        <DefTable rows={[
          ['Engagement', 'The primary record in Folio. Represents one penetration test for one client. Also called a "Project" in the backend/API.', '#9184d9'],
          ['Report',     'The PDF document generated from an engagement. Not a stored record — produced on-demand from the engagement\'s data.', '#9184d9'],
          ['Report Data','The JSON blob inside each engagement holding all structured content: findings, scope, executive summary, version history.', '#9184d9'],
          ['Finding',    'An individual security vulnerability or observation. Has severity, description, impact, recommendations, evidence, and an optional CVSS score.', '#9184d9'],
          ['Section',    <>A grouping of findings (e.g. <Code>Web Application</Code>, <Code>Internal Network</Code>). Sections appear as separate assessment areas in the PDF.</>, '#9184d9'],
          ['Finding Template', 'A reusable finding stored in the Knowledge Base. Applied when adding a new finding to pre-fill common fields.', '#9184d9'],
          ['Exploitation Scenario', 'A multi-step attack chain narrative combining multiple findings — rendered as a dedicated PDF section.', '#9184d9'],
        ]} />
        <Callout type="info">
          <strong>Engagement</strong> and <strong>Project</strong> are the same thing. The UI calls it an Engagement; the backend database model is named Project. A <strong>Report</strong> is the PDF output, not a separate stored entity.
        </Callout>
      </>
    ),
  },

  workflow: {
    color: '#1a9e6a',
    node: (
      <>
        <Lead>How a standard engagement flows from creation to delivered PDF report.</Lead>
        <Steps color="#1a9e6a" items={[
          <>Create a <strong>Client</strong> in the Clients page, or add one inline when creating a new engagement.</>,
          <>Create a new <strong>Engagement</strong> from the dashboard or the sidebar New Engagement button.</>,
          <>Fill in the <strong>Overview</strong> tab — report metadata, client and consultant details, report ID, version history.</>,
          <>Complete the <strong>Introduction</strong> tab — objective, approach, in-scope targets by category, out-of-scope list, rules of engagement, testing team, and authorisation statement.</>,
          <>Add <strong>Findings</strong> via the Findings tab. Organise into sections, set severity, add evidence via content blocks.</>,
          <>Optionally add <strong>Exploitation Scenarios</strong> — narrative attack chains connecting multiple findings.</>,
          <>Write the <strong>Executive Summary</strong> and <strong>Technical Summary</strong> on the Summary tab.</>,
          <>Optionally build the <strong>Remediation Roadmap</strong> — immediate, short-term, medium-term, and long-term tiers.</>,
          <>Generate and <strong>preview</strong> the PDF from the Generate tab. Click Regenerate after any changes.</>,
          <strong>Download and deliver</strong>,
        ]} />
        <Callout type="tip">
          Auto-save is active on all engagement tabs. Changes are debounced and saved to the database automatically — no manual save needed between tabs.
        </Callout>
      </>
    ),
  },

  findings: {
    color: '#f4802b',
    node: (
      <>
        <Lead>How findings are structured, written, and evidenced within an engagement.</Lead>
        <Prose>Findings live inside <strong>Sections</strong>. Each finding gets an auto-assigned ID based on its section prefix and severity order — e.g. <Code>WEB-001</Code>, <Code>AD-002</Code>.</Prose>

        <SubHeading>Finding fields</SubHeading>
        <DefTable rows={[
          ['ID',                    'Auto-assigned. Format: [PREFIX]-[NUMBER], Critical first.', '#f4802b'],
          ['Title',                 'Short descriptive name of the vulnerability.', '#f4802b'],
          ['Severity',              'Critical / High / Medium / Low / Informational.', '#f4802b'],
          ['Content Blocks',        'Interleaved description and evidence — see below.', '#f4802b'],
          ['Risk Justification',    'Prose explanation of why this severity rating was chosen.', '#f4802b'],
          ['CVSS Score / Vector',   'Optional CVSSv4.0 numeric score and vector string.', '#f4802b'],
          ['Technical Impact',      'What an attacker can technically achieve.', '#f4802b'],
          ['Business Impact',       'What this means for the business or client.', '#f4802b'],
          ['Recommendations',       'Remediation steps in Markdown. Bullet points are supported.', '#f4802b'],
          ['Affected Hosts',        'Hosts or systems affected. Shown in the findings overview table in the PDF.', '#f4802b'],
          ['References',            'Title + URL pairs linking to CVEs, advisories, or documentation.', '#f4802b'],
        ]} />

        <SubHeading>Content block types</SubHeading>
        <DefTable rows={[
          ['Text',        'Markdown prose. Rendered as formatted HTML in the PDF.', '#f4802b'],
          ['Code Block',  'Syntax-highlighted code or command output. Supports a label, language, and caption.', '#f4802b'],
          ['Screenshot',  'Uploaded image with an auto-numbered figure caption. Figures are numbered sequentially across the entire report.', '#f4802b'],
        ]} />

        <Callout type="info">
          Blocks can be reordered by dragging the grip handle, deleted with the X button, and new blocks inserted between any two existing blocks via the <Code>+</Code> insert point that appears on hover.
        </Callout>
      </>
    ),
  },

  severity: {
    color: '#e63946',
    node: (
      <>
        <Lead>Folio uses a five-level severity scale. Findings are always sorted Critical → Informational in the app and in generated PDFs.</Lead>
        <SevCard label="Critical"      color="#e63946"         desc="Immediate, critical risk. Exploitation is trivial and impact is severe — e.g. unauthenticated RCE, plaintext admin credentials, full domain compromise." />
        <SevCard label="High"          color="#f4802b"         desc="Significant risk requiring urgent remediation. Exploitation may require some conditions but impact on confidentiality, integrity, or availability is serious." />
        <SevCard label="Medium"        color="#f5c518" dark    desc="Moderate risk. Exploitation typically requires specific conditions or results in limited impact in isolation, but may chain into higher-severity attack paths." />
        <SevCard label="Low"           color="#2196f3"         desc="Minor risk. Difficult to exploit, limited impact, or requires significant attacker access already in place." />
        <SevCard label="Informational" color="#8b949e"         desc="No direct security risk. Noteworthy observations, hardening recommendations, or best-practice gaps that do not constitute a vulnerability." />
      </>
    ),
  },

  cvss: {
    color: '#1a7dd9',
    node: (
      <>
        <Lead>Folio supports optional CVSSv4.0 scoring on individual findings.</Lead>
        <DefTable rows={[
          ['CVSSv4 Score',         'A numeric score from 0.0 to 10.0.', '#1a7dd9'],
          ['CVSSv4 Vector String', <>The full vector encoding all metric values — e.g. <Code>CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H</Code></>, '#1a7dd9'],
        ]} />
        <SubHeading>Score ranges</SubHeading>
        <DefTable rows={[
          ['0.0',        'None',     '#8b949e'],
          ['0.1 – 3.9',  'Low',      '#2196f3'],
          ['4.0 – 6.9',  'Medium',   '#f5c518'],
          ['7.0 – 8.9',  'High',     '#f4802b'],
          ['9.0 – 10.0', 'Critical', '#e63946'],
        ]} />
        <Callout type="info">
          Both CVSS fields are optional. When populated, the score and vector string appear in the PDF under the <strong>CVSS Score</strong> section of each finding page.
        </Callout>
      </>
    ),
  },

  generation: {
    color: '#14b8a6',
    node: (
      <>
        <Lead>PDFs are generated server-side using Playwright (headless Chromium) rendering Jinja2 HTML templates.</Lead>
        <DefTable rows={[
          ['Preview Report',  'Generates the PDF and displays it inline in the browser. Cached for the session — click Regenerate after changes.', '#14b8a6'],
          ['Download PDF',    'Downloads the PDF directly. Generates first if no preview exists in the current session.', '#14b8a6'],
          ['Filename format', <><Code>[ClientName]-Penetration-Test-Report.pdf</Code></>, '#14b8a6'],
        ]} />
        <Divider />
        <SubHeading>PDF section order</SubHeading>
        <Steps color="#14b8a6" items={[
          'Cover page',
          'Table of Contents',
          'Introduction (objective, approach, scope, rules of engagement, testing team, authorisation)',
          'Executive Summary',
          'Technical Summary',
          'Technical Findings Overview — risk distribution chart + findings table with affected systems',
          'Exploitation Scenarios (only if scenarios are present and enabled)',
          'Individual Finding Pages — one page per finding, sorted by severity',
          'Remediation Roadmap',
          'Appendix A — Tools & Utilities',
          'Appendix B — Engagement Information (distribution list, document control)',
          'Appendix C — Risk Rating Methodology',
        ]} />
      </>
    ),
  },

  'knowledge-base': {
    color: '#d4a017',
    node: (
      <>
        <Lead>The Finding Library stores reusable finding templates that can be applied to any engagement.</Lead>
        <Prose>Access it at <Code>/templates</Code> via the sidebar under Findings. Templates contain a title, severity, category, description, recommendations, and tags.</Prose>
        <Divider />
        <SubHeading>Using templates</SubHeading>
        <Steps color="#d4a017" items={[
          'Open an engagement and go to the Findings tab.',
          'Click Add Finding to open the finding drawer.',
          'Click From Template in the drawer header to browse the library.',
          'Select a template — it pre-fills title, severity, description, and recommendations.',
          'Edit the pre-filled content to match the specific finding, then save.',
        ]} />
        <Callout type="tip">
          Templates are independent from engagement findings. Editing a template in the Knowledge Base does not retroactively change findings already added to any engagement.
        </Callout>
        <Divider />
        <SubHeading>Filtering & search</SubHeading>
        <Prose>The Knowledge Base can be filtered by severity group (collapsible sections), category (checkboxes), or searched by title. Findings are always displayed Critical → Informational within each severity group.</Prose>
      </>
    ),
  },

  clients: {
    color: '#2196f3',
    node: (
      <>
        <Lead>Manage client organisations and define what is in and out of scope for each engagement.</Lead>
        <DefTable rows={[
          ['Clients (/clients)', 'Stores client organisation records — contact name, title, email, industry, and notes. Linking an engagement to a client auto-fills client metadata in the generated report.', '#2196f3'],
          ['Domains (/domains)', 'Tracks domain names — registrar, expiry date, DNS provider, purpose, and status. Useful for pre-engagement recon and infrastructure tracking.', '#2196f3'],
        ]} />
        <Divider />
        <SubHeading>Scope definition (per-engagement)</SubHeading>
        <DefTable rows={[
          ['In-Scope Targets',       'Grouped by category (e.g. Web Applications, IP Ranges). Each category has a comma-separated list of targets.', '#2196f3'],
          ['Out-of-Scope',           'Explicitly excluded systems or areas, listed as bullet points.', '#2196f3'],
          ['Rules of Engagement',    'Free-form Markdown — testing hours, permitted techniques, emergency contacts, and any restrictions.', '#2196f3'],
        ]} />
      </>
    ),
  },

  'red-team': {
    color: '#e63946',
    node: (
      <>
        <Lead>Operational tooling for tracking activity and infrastructure during an engagement.</Lead>
        <DefTable rows={[
          ['Operation Logs (/oplogs)', 'Timestamped activity log for red team actions. Records action, time, operator, and outcome. Used for deconfliction and post-engagement timeline reconstruction.', '#e63946'],
          ['Active Assets (/assets)', 'Tracks compromised or foothold hosts — hostname, IP, OS, access level, and notes.', '#e63946'],
          ['Servers (/servers)',       'Tracks C2 servers, redirectors, and phishing infrastructure — hostname, IP, provider, role, and engagement.', '#e63946'],
          ['GoPhish Integration',      'Connect a GoPhish instance to surface campaign data (sends, opens, clicks, submissions) directly in the sidebar.', '#e63946'],
        ]} />
        <Callout type="info">
          Red Team Tool records are operationally independent from engagement findings. Use Operation Logs to track what you <em>did</em>; use Findings to document what you <em>discovered</em>.
        </Callout>
      </>
    ),
  },

  archiving: {
    color: '#8b949e',
    node: (
      <>
        <Lead>Engagements move through a simple two-state lifecycle: Active → Archived.</Lead>
        <DefTable rows={[
          ['Active',   'Default state. Visible on the main dashboard and in sidebar project lists.', '#1a9e6a'],
          ['Archived', 'Hidden from the dashboard. Accessible at /archived. Can be restored or permanently deleted.', '#8b949e'],
        ]} />
        <Divider />
        <SubHeading>Archiving an engagement</SubHeading>
        <Steps color="#8b949e" items={[
          'From the dashboard, open the engagement actions menu.',
          'Select Archive — the engagement moves off the main view immediately.',
          'Access archived engagements via Archived Reports in the sidebar.',
          'Use the restore icon to return to Active, or the delete icon to permanently remove.',
        ]} />
        <Callout type="warn">
          Permanent deletion cannot be undone. All finding data, scope, and evidence references are removed from the database.
        </Callout>
        <Callout type="tip">
          Archiving does not affect PDF generation. You can still open an archived engagement and generate or download its report at any time.
        </Callout>
      </>
    ),
  },

  roles: {
    color: '#9184d9',
    node: (
      <>
        <Lead>Folio has two roles with different levels of access.</Lead>
        <DefTable rows={[
          ['Admin', 'Full access — engagements, findings, templates, clients, domains, servers, assets, operation logs, import/export, user management, and report design templates.', '#9184d9'],
          ['User',  'Access to all operational features. Cannot manage users or report design templates.', '#8b949e'],
        ]} />
        <Divider />
        <SubHeading>Managing users</SubHeading>
        <Prose>User management is available to admins at <Code>Admin → User Management</Code>. Create users, set roles, reset passwords, and deactivate accounts from there.</Prose>
        <Callout type="warn">
          Default credentials on first run are <Code>admin</Code> / <Code>admin123</Code>. Change the admin password immediately after first login via your profile settings.
        </Callout>
      </>
    ),
  },
}

export default function Wiki() {
  const [active, setActive] = useState<TopicId>('terminology')
  const topic = CONTENT[active]
  const navIdx = NAV.findIndex(n => n.id === active)

  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>

      {/* ── Left nav ── */}
      <div style={{
        width: 230, flexShrink: 0, borderRight: '1px solid var(--c-border)',
        background: 'var(--c-sidebar)', padding: '20px 0',
        position: 'sticky', top: 0, alignSelf: 'flex-start',
        maxHeight: '100vh', overflowY: 'auto',
      }}>
        <div style={{
          padding: '0 16px 14px', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text-3)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <HelpCircle size={11} /> Reference Guide
        </div>
        {NAV.map(({ id, label, icon, color }) => {
          const isActive = active === id
          return (
            <button key={id} onClick={() => setActive(id)} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', padding: '8px 16px',
              background: isActive ? `${color}14` : 'none',
              border: 'none', borderLeft: `2px solid ${isActive ? color : 'transparent'}`,
              color: isActive ? 'var(--c-text-1)' : 'var(--c-text-3)',
              fontSize: 13, fontWeight: isActive ? 500 : 400,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
            }}>
              <span style={{ color: isActive ? color : 'var(--c-text-3)', transition: 'color 0.12s' }}>{icon}</span>
              {label}
              {isActive && <ChevronRight size={11} style={{ marginLeft: 'auto', color: 'var(--c-text-3)' }} />}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, minWidth: 0, padding: '32px 52px 64px', maxWidth: 800 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, fontSize: 11, color: 'var(--c-text-3)' }}>
          <HelpCircle size={11} />
          <span>Wiki</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: NAV[navIdx].color, fontWeight: 500 }}>{NAV[navIdx].label}</span>
        </div>

        {/* Section title with color accent bar */}
        <SectionTitle color={topic.color}>{NAV[navIdx].label}</SectionTitle>

        {topic.node}

        {/* Prev / Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 52, paddingTop: 20, borderTop: '1px solid var(--c-border)' }}>
          {(() => {
            const prev = NAV[navIdx - 1]
            const next = NAV[navIdx + 1]
            return (
              <>
                {prev ? (
                  <button onClick={() => setActive(prev.id)} style={{
                    display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 16px',
                    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                    borderLeft: `3px solid ${prev.color}`,
                    borderRadius: 6, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s',
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>← Previous</span>
                    <span style={{ fontSize: 13, color: 'var(--c-text-1)', fontWeight: 500 }}>{prev.label}</span>
                  </button>
                ) : <div />}
                {next ? (
                  <button onClick={() => setActive(next.id)} style={{
                    display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 16px',
                    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                    borderRight: `3px solid ${next.color}`,
                    borderRadius: 6, cursor: 'pointer', textAlign: 'right', transition: 'border-color 0.12s',
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>Next →</span>
                    <span style={{ fontSize: 13, color: 'var(--c-text-1)', fontWeight: 500 }}>{next.label}</span>
                  </button>
                ) : <div />}
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
