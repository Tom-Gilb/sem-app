// UNIT_TYPE=Data
// surpriseSeeds — Feature #37: "Surprise Me" Random Spec seed bank

export interface SurpriseSeed {
  stakes: string
  ends: string
  means: string
}

export const SURPRISE_SEEDS: SurpriseSeed[] = [
  // 1. Healthcare
  { stakes: "Hospital operations manager", ends: "Reduce average patient discharge time from 4.2 hours to under 90 minutes", means: "Implement real-time bed management system with automated nursing handoff notifications" },
  // 2. Education
  { stakes: "University course director", ends: "Increase student assignment submission rate from 68% to 95% before deadlines", means: "Deploy intelligent deadline reminder system with personalised nudge messages and peer accountability groups" },
  // 3. Climate
  { stakes: "Sustainability director at a manufacturing firm", ends: "Reduce carbon footprint by 40% per unit produced within 18 months", means: "Install IoT energy monitoring across all production lines and switch to renewable supplier contracts" },
  // 4. Gaming
  { stakes: "Mobile game studio lead", ends: "Increase 7-day player retention from 22% to 45% and daily active users by 60%", means: "Introduce daily quest system, social gifting mechanics, and personalised difficulty scaling via ML model" },
  // 5. Finance
  { stakes: "CFO of a mid-size fintech company", ends: "Cut accounts payable processing time from 12 days to 2 days and error rate from 8% to 0.5%", means: "Automate invoice matching with ML-based OCR and implement three-way matching rules engine" },
  // 6. Logistics
  { stakes: "Supply chain director at a retail chain", ends: "Reduce out-of-stock incidents by 75% and cut excess inventory holding costs by 30%", means: "Deploy demand forecasting model fed by POS data, weather signals, and promotional calendar" },
  // 7. HR
  { stakes: "Head of People at a 500-person tech company", ends: "Reduce employee onboarding time to productivity from 90 days to 30 days", means: "Build structured 30-day onboarding portal with role-specific learning paths and mentor matching algorithm" },
  // 8. Legal
  { stakes: "General counsel at a SaaS company", ends: "Reduce contract review cycle time from 14 days to 3 days without increasing legal risk", means: "Implement AI contract analysis tool with pre-approved clause library and automated redline generation" },
  // 9. Agriculture
  { stakes: "Farm operations director managing 5,000 acres", ends: "Increase crop yield by 25% while reducing water consumption by 35%", means: "Deploy precision irrigation system using soil moisture sensors and satellite crop health imagery" },
  // 10. Media
  { stakes: "Head of content at a streaming platform", ends: "Increase content discovery rate from 12% to 45% of sessions resulting in new title engagement", means: "Rebuild recommendation engine using collaborative filtering plus contextual signals (time, device, mood)" },
  // 11. Construction
  { stakes: "Project director on a 200M infrastructure build", ends: "Reduce project delays from 35% of milestones to under 5% and rework incidents by 60%", means: "Introduce digital twin of site with real-time sensor data, daily BIM model updates, and AI schedule risk alerts" },
  // 12. Non-profit
  { stakes: "Executive director of a food bank charity", ends: "Increase families served per week from 800 to 2,000 with same volunteer headcount", means: "Implement volunteer routing optimisation, predictive food donation forecasting, and digital intake kiosk system" },
]
