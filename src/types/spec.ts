// UNIT_TYPE=Types
// Minimal SpecBlock type stub — expanded fully in Evo Step 3 (S.EvoStep3.SpecBlockInterface)

export interface FEntry {
  id: string
  type: string
  level: string
  description: string
  successCriteria: string
  functionOfValue: string
}

export interface VEntry {
  id: string
  type: string
  level: string
  description: string
  scale: string
  meter: string
  status: string
  tolerable: string
  goal: string
  valueOfFunction: string
}

export interface SEntry {
  id: string
  type: string
  level: string
  description: string
  impact: string
  function: string
}

export interface SpecBlock {
  functions: FEntry[]
  values: VEntry[]
  solutions: SEntry[]
}
