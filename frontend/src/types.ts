export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational'
export type ProjectStatus = 'active' | 'complete' | 'archived'

export interface RiskCounts {
  critical: number
  high: number
  medium: number
  low: number
  informational: number
}

export interface ProjectSummary {
  id: number
  name: string
  report_id: string
  client_name: string
  status: ProjectStatus
  created_at: string | null
  updated_at: string | null
  assessment_start: string | null
  assessment_end: string | null
  risk_counts: RiskCounts
}

export interface Finding {
  id: string
  title: string
  severity: Severity
  description: string
  risk_rating_justification: string
  cvss_score?: number | null
  cvss_vector?: string
  impact: {
    technical: string
    business: string
  }
  recommendations: {
    text?: string
    tactical?: string[]
    strategic?: string[]
  }
  affected_hosts: string[]
  references: { title: string; url: string }[]
  evidence: EvidenceItem[]
  content_blocks?: ContentBlock[]
  retest: { enabled: boolean }
}

export interface EvidenceItem {
  type: 'screenshot' | 'code'
  path?: string
  caption?: string
  label?: string
  language?: string
  content?: string
  highlight_lines?: number[]
}

// Unified block type for interleaved content (text + code + screenshot)
export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; label?: string; language: string; content: string; highlight_lines?: number[]; caption?: string }
  | { type: 'screenshot'; path: string; caption?: string; width?: number }

export interface ToolEntry {
  tool: string
  purpose: string
  reference: string
}

export interface RoadmapItem {
  finding_id: string
  effort?: string
  owner?: string
  notes?: string
}

export interface RemediationRoadmap {
  timeframes?: {
    immediate?: { items: RoadmapItem[] }
    short_term?: { items: RoadmapItem[] }
    medium_term?: { items: RoadmapItem[] }
    long_term?: { items: RoadmapItem[] }
  }
}

export interface Section {
  id: string
  title: string
  enabled: boolean
  findings: Finding[]
}

export interface TeamMember {
  name: string
  role: string
}

export interface VersionEntry {
  version: string
  date: string
  author: string
  changes: string
}

export interface ReportData {
  meta: {
    report_id: string
    title: string
    subtitle: string
    client: {
      name: string
      contact_name: string
      contact_title: string
      contact_email: string
      logo_path: string
    }
    consultant: {
      firm: string
      name: string
      title: string
      email: string
      firm_logo_path: string
    }
    dates: {
      assessment_start: string
      assessment_end: string
      report_date: string
      report_version: string
    }
    classification: string
    distribution: { name: string; role: string }[]
  }
  version_history: VersionEntry[]
  introduction: {
    preamble: string
    objective: string
    approach: string
    testing_team: TeamMember[]
    testing_dates: { start: string; end: string }
    caveats: string[]
    authorization: string
  }
  scope: {
    in_scope: { category: string; targets: string }[]
    out_of_scope: string[]
    rules_of_engagement: string
    methodology?: string[]
  }
  executive_summary: {
    overall_risk_rating: string
    narrative: string
    management_summary?: string
    key_findings: string[]
  }
  technical_summary: {
    narrative: string
  }
  risk_summary: {
    counts: Partial<RiskCounts>
  }
  sections: Section[]
  exploitation_scenarios: ExploitScenario[]
  remediation_roadmap?: RemediationRoadmap
  tools_used?: ToolEntry[]
  appendices: Appendix[]
  cover_style?: 'dark' | 'light'
}

export interface ExploitScenario {
  id: string
  title: string
  severity: Severity
  finding_refs: string[]
  narrative: string
  recommendation: string
  evidence: EvidenceItem[]
  content_blocks?: ContentBlock[]
  enabled: boolean
}

export interface Appendix {
  id: string
  title: string
  enabled: boolean
  content: string
}

export interface ProjectDetail extends ProjectSummary {
  report_data: ReportData
}
