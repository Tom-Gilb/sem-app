// UNIT_TYPE=Widget
// Feature #25 — Tests for StakeholderSignOff.vue

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StakeholderSignOff from '../StakeholderSignOff.vue'
import type { SpecBlock } from '../../types/spec'

// ── Helpers ───────────────────────────────────────────────────────────────────

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'desc',
      successCriteria: '',
      functionOfValue: '',
    },
  ],
  values: [],
  solutions: [],
}

// Spec with stakeholder keywords in descriptions
const stakeholderSpec: SpecBlock = {
  functions: [],
  values: [
    {
      id: 'V.One',
      type: 'Value',
      level: 'Product',
      description: 'Stakeholder: Manager approval rate for requests by Admin',
      scale: '%',
      meter: 'Survey',
      status: '60%',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: '',
    },
    {
      id: 'V.Two',
      type: 'Value',
      level: 'Product',
      description: 'Tracking outcomes for Customer satisfaction',
      scale: 'NPS',
      meter: 'Survey',
      status: '40',
      tolerable: '50',
      goal: '70',
      valueOfFunction: '',
    },
  ],
  solutions: [],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StakeholderSignOff', () => {

  describe('renders correct number of stakeholder rows', () => {
    it('renders at least 3 rows when no stakeholders found (default fallback)', () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })
      const rows = wrapper.findAll('li')
      expect(rows.length).toBeGreaterThanOrEqual(3)
    })

    it('renders default stakeholder names when no keywords matched', () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })
      const text = wrapper.text()
      expect(text).toContain('Reviewer')
      expect(text).toContain('Sponsor')
      expect(text).toContain('Team Lead')
    })

    it('renders extracted stakeholder names from spec descriptions', () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: stakeholderSpec },
      })
      const text = wrapper.text()
      // "Manager" after "Stakeholder:" and "Admin" after "by"
      expect(text).toContain('Manager')
    })

    it('renders at least 3 stakeholder rows regardless of spec content', () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: null },
      })
      const rows = wrapper.findAll('li')
      expect(rows.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Approve button click updates status to approved', () => {
    it('clicking Approve button shows approved status indicator', async () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })

      // Initially pending
      expect(wrapper.text()).toContain('⏳ Pending')
      expect(wrapper.text()).not.toContain('✅ Approved')

      // Click first Approve button
      const approveButtons = wrapper.findAll('button[aria-label^="Approve for"]')
      expect(approveButtons.length).toBeGreaterThan(0)
      await approveButtons[0].trigger('click')

      // Status should now show approved
      expect(wrapper.text()).toContain('✅ Approved')
    })

    it('approving one stakeholder does not affect others', async () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })

      const approveButtons = wrapper.findAll('button[aria-label^="Approve for"]')
      await approveButtons[0].trigger('click')

      // The other rows should still be pending
      const rows = wrapper.findAll('li')
      expect(rows.length).toBeGreaterThanOrEqual(3)

      // Count remaining pending indicators
      const text = wrapper.text()
      expect(text).toContain('⏳ Pending')
    })
  })

  describe('Revise button click', () => {
    it('clicking Revise shows revise indicator', async () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })

      const reviseButtons = wrapper.findAll('button[aria-label^="Request revision for"]')
      expect(reviseButtons.length).toBeGreaterThan(0)
      await reviseButtons[0].trigger('click')

      expect(wrapper.text()).toContain('🔄 Revise')
    })
  })

  describe('All-approved banner', () => {
    it('does NOT show all-approved banner initially', () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })
      expect(wrapper.text()).not.toContain('All stakeholders have approved this spec')
    })

    it('shows all-approved banner when all stakeholders are approved', async () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })

      // Approve all stakeholders
      const approveButtons = wrapper.findAll('button[aria-label^="Approve for"]')
      for (const btn of approveButtons) {
        await btn.trigger('click')
      }

      expect(wrapper.text()).toContain('All stakeholders have approved this spec')
    })

    it('banner disappears if a stakeholder switches back to revise', async () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })

      // Approve all
      const approveButtons = wrapper.findAll('button[aria-label^="Approve for"]')
      for (const btn of approveButtons) {
        await btn.trigger('click')
      }
      expect(wrapper.text()).toContain('All stakeholders have approved this spec')

      // Click revise on first
      const reviseButtons = wrapper.findAll('button[aria-label^="Request revision for"]')
      await reviseButtons[0].trigger('click')

      expect(wrapper.text()).not.toContain('All stakeholders have approved this spec')
    })
  })

  describe('progress bar', () => {
    it('shows "0 / N approved" initially', () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })
      // Should show 0 / 3 approved (3 default stakeholders)
      expect(wrapper.text()).toContain('0 / 3 approved')
    })

    it('updates progress count after approval', async () => {
      const wrapper = mount(StakeholderSignOff, {
        props: { spec: minimalSpec },
      })
      const approveButtons = wrapper.findAll('button[aria-label^="Approve for"]')
      await approveButtons[0].trigger('click')
      expect(wrapper.text()).toContain('1 / 3 approved')
    })
  })
})
