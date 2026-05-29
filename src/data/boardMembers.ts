// UNIT_TYPE=Data
// boardMembers.ts — board member roster for Maria's auto-suggest engine
//
// ── HOW TO USE ───────────────────────────────────────────────────────────────
// Replace every placeholder name / contact / preference with real board member
// data. The keywords in specialInterests, specialAbilities, volunteersFor, and
// dislikesTasks are matched against Maria's governance-gap and authority-report
// text — keep them short, natural phrases that would appear in board documents.
//
// To add a new member: copy any entry, assign a new unique `id` slug, fill in
// all fields. To remove a member: delete the entry block. Order does not matter.
//
// Do NOT add Vue types or reactive state here — this file must stay framework-free.
// ─────────────────────────────────────────────────────────────────────────────

import type { BoardMember } from '../types/board'

export const boardMembers: BoardMember[] = [
  // ── 1 · Board Chair ──────────────────────────────────────────────────────────
  {
    id: 'chair',
    name: 'Replace with real name',
    role: 'Board Chair',
    phone: '',
    email: '',
    address: '',
    specialInterests: [
      'governance',
      'strategic planning',
      'education policy',
      'board development',
      'stakeholder relations',
    ],
    specialAbilities: [
      'mediation',
      'public speaking',
      'policy review',
      'legal oversight',
      'meeting facilitation',
    ],
    volunteersFor: [
      'chairing committees',
      'community liaison',
      'policy review',
      'stakeholder meetings',
      'board recruitment',
    ],
    dislikesTasks: [
      'detailed financial reconciliation',
      'facilities procurement',
      'IT decisions',
    ],
    availability: '',
    notes: '',
  },

  // ── 2 · Vice Chair / Secretary ───────────────────────────────────────────────
  {
    id: 'secretary',
    name: 'Replace with real name',
    role: 'Secretary',
    phone: '',
    email: '',
    address: '',
    specialInterests: [
      'governance documentation',
      'compliance',
      'board records',
      'policy drafting',
      'communications',
    ],
    specialAbilities: [
      'minutes recording',
      'policy drafting',
      'legal compliance',
      'records management',
      'correspondence',
    ],
    volunteersFor: [
      'minutes review',
      'policy documentation',
      'compliance checks',
      'agenda preparation',
      'action item tracking',
    ],
    dislikesTasks: [
      'financial analysis',
      'IT decisions',
      'fundraising events',
    ],
    availability: '',
    notes: '',
  },

  // ── 3 · Treasurer ────────────────────────────────────────────────────────────
  {
    id: 'treasurer',
    name: 'Replace with real name',
    role: 'Treasurer',
    phone: '',
    email: '',
    address: '',
    specialInterests: [
      'finance',
      'risk management',
      'investment',
      'budget planning',
      'audit',
      'financial controls',
    ],
    specialAbilities: [
      'financial analysis',
      'budget review',
      'audit oversight',
      'vendor contracts',
      'grant financial reporting',
      'investment oversight',
    ],
    volunteersFor: [
      'budget review',
      'financial reporting',
      'vendor contract review',
      'grant management',
      'audit committee',
    ],
    dislikesTasks: [
      'community events',
      'media relations',
      'curriculum decisions',
      'parent communications',
    ],
    availability: '',
    notes: '',
  },

  // ── 4 · Member — Education & Programs ────────────────────────────────────────
  {
    id: 'education-member',
    name: 'Replace with real name',
    role: 'Board Member — Education',
    phone: '',
    email: '',
    address: '',
    specialInterests: [
      'curriculum',
      'education',
      'teacher welfare',
      'student outcomes',
      'pedagogy',
      'professional development',
      'program evaluation',
    ],
    specialAbilities: [
      'curriculum review',
      'educational assessment',
      'teacher hiring',
      'professional development',
      'program design',
    ],
    volunteersFor: [
      'curriculum committees',
      'teacher hiring panels',
      'program evaluation',
      'student welfare review',
      'educational policy',
    ],
    dislikesTasks: [
      'financial audits',
      'legal review',
      'facilities management',
      'procurement',
    ],
    availability: '',
    notes: '',
  },

  // ── 5 · Member — Community & Fundraising ─────────────────────────────────────
  {
    id: 'community-member',
    name: 'Replace with real name',
    role: 'Board Member — Community',
    phone: '',
    email: '',
    address: '',
    specialInterests: [
      'community relations',
      'fundraising',
      'marketing',
      'parent engagement',
      'donor relations',
      'partnerships',
    ],
    specialAbilities: [
      'donor relations',
      'event planning',
      'media outreach',
      'grant writing',
      'public relations',
      'social media',
    ],
    volunteersFor: [
      'fundraising campaigns',
      'community events',
      'parent engagement',
      'annual fund',
      'alumni relations',
      'partnership development',
    ],
    dislikesTasks: [
      'facilities inspections',
      'IT procurement',
      'detailed financial review',
      'legal compliance',
    ],
    availability: '',
    notes: '',
  },

  // ── 6 · Member — Facilities & Operations ─────────────────────────────────────
  {
    id: 'facilities-member',
    name: 'Replace with real name',
    role: 'Board Member — Facilities',
    phone: '',
    email: '',
    address: '',
    specialInterests: [
      'facilities',
      'operations',
      'sustainability',
      'safety',
      'health and safety',
      'building management',
      'environmental',
    ],
    specialAbilities: [
      'project management',
      'contractor oversight',
      'health and safety',
      'building inspections',
      'facilities planning',
      'IT infrastructure',
    ],
    volunteersFor: [
      'facilities committee',
      'building projects',
      'maintenance oversight',
      'safety inspections',
      'capital projects',
      'IT decisions',
    ],
    dislikesTasks: [
      'curriculum decisions',
      'fundraising calls',
      'media relations',
      'communications',
    ],
    availability: '',
    notes: '',
  },
]
