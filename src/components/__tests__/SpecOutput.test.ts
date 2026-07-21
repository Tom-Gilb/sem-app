// UNIT_TYPE=Widget
// Spec: S.EvoStep3.ExportUI / F.EvoStep3.DeliverSerialiserSchema
// Tests for SpecOutput.vue — Download .md button, accessibility attributes,
// and Before/After view toggle

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpecOutput from '../SpecOutput.vue'

// Minimal SpecBlock stub used wherever a rendered spec panel is required
const minimalSpec = {
  functions: [{ id: 'F.Test', type: 'Function', level: 'Product', description: 'desc', successCriteria: '', functionOfValue: '' }],
  values: [],
  solutions: [],
}

describe('SpecOutput', () => {

  describe.skip('Download .md button', () => {
    // SKIPPED 2026-06-09: The <a download="spec.md"> anchor was replaced by a
    // <button @click="downloadSpec"> that downloads a .html file (colourful HTML,
    // per universal export rule 2026-06-06). Tests for the new HTML download
    // button should be added to SpecOutput.features.test.ts.

    it('renders a Download .md anchor with aria-label when markdown is provided', () => {
      // Spec: F.EvoStep3.DeliverSerialiserSchema — Download .md button must be present
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: minimalSpec,
          markdown: '#### F.Test\nType: Function',
        },
      })
      const downloadLink = wrapper.find('a[download]')
      expect(downloadLink.exists()).toBe(true)
      expect(downloadLink.attributes('aria-label')).toBe('Download spec as Markdown file')
    })

    it('Download anchor has download="spec.md" attribute', () => {
      // Spec: F.EvoStep3.DeliverSerialiserSchema — exported file must be a .md file
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: minimalSpec,
          markdown: '#### F.Test\nType: Function',
        },
      })
      const downloadLink = wrapper.find('a[download]')
      expect(downloadLink.attributes('download')).toBe('spec.md')
    })

    it('Download anchor has 44px touch target classes (h-11 w-11)', () => {
      // Spec: F.EvoStep3.DeliverSerialiserSchema — export controls meet 44×44px touch target (MOBILE_03)
      // h-11 = 44px, w-11 = 44px in Tailwind
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: minimalSpec,
          markdown: '#### F.Test\nType: Function',
        },
      })
      const downloadLink = wrapper.find('a[download]')
      expect(downloadLink.classes()).toContain('h-11')
      expect(downloadLink.classes()).toContain('w-11')
    })

    it('Download anchor href is a data URI containing the markdown content', () => {
      // Spec: F.EvoStep3.DeliverSerialiserSchema — download href uses data URI, not Blob URL
      const markdown = '#### F.Test\nType: Function\nLevel: Product'
      const wrapper = mount(SpecOutput, {
        props: { loading: false, error: '', spec: minimalSpec, markdown },
      })
      const downloadLink = wrapper.find('a[download]')
      const href = downloadLink.attributes('href') ?? ''
      expect(href).toMatch(/^data:text\/markdown;charset=utf-8,/)
      // The markdown content must be URL-encoded in the href
      expect(href).toContain(encodeURIComponent(markdown).slice(0, 20))
    })

    it('Download anchor href is "#" when markdown is empty', () => {
      // downloadHref returns "#" for empty markdown so the link is inert
      // Section is not rendered when no state is truthy; validate by checking no anchor
      const wrapper = mount(SpecOutput, {
        props: { loading: false, error: '', spec: null, markdown: '' },
      })
      const downloadLink = wrapper.find('a[download]')
      expect(downloadLink.exists()).toBe(false)
    })

    it('does not render Download anchor when markdown is empty and spec is null', () => {
      // The result state block is only shown when spec is truthy
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: null,
          markdown: '',
        },
      })
      const downloadLink = wrapper.find('a[download]')
      expect(downloadLink.exists()).toBe(false)
    })

    it('does not render Download anchor when loading', () => {
      const wrapper = mount(SpecOutput, {
        props: {
          loading: true,
          error: '',
          spec: null,
          markdown: '',
        },
      })
      const downloadLink = wrapper.find('a[download]')
      expect(downloadLink.exists()).toBe(false)
    })

  })

  describe('Copy to clipboard button', () => {

    it('Copy button has 44px touch target classes (h-11 w-11)', () => {
      // Spec: F.EvoStep3.DeliverSerialiserSchema — Copy button meets 44×44px touch target (MOBILE_03)
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: minimalSpec,
          markdown: '#### F.Test\nType: Function',
        },
      })
      // The copy button is the second button[type=button] (after the toggle button)
      const copyBtn = wrapper.findAll('button[type="button"]').find(
        btn => btn.attributes('aria-label')?.includes('clipboard')
      )
      expect(copyBtn).toBeDefined()
      expect(copyBtn!.classes()).toContain('h-11')
      expect(copyBtn!.classes()).toContain('w-11')
    })

    it('Copy button has descriptive aria-label', () => {
      // Accessibility: icon-only buttons must have aria-label (WCAG 2.1 AA)
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: minimalSpec,
          markdown: '#### F.Test\nType: Function',
        },
      })
      const copyBtn = wrapper.findAll('button[type="button"]').find(
        btn => btn.attributes('aria-label')?.includes('clipboard')
      )
      expect(copyBtn).toBeDefined()
      expect(copyBtn!.attributes('aria-label')).toContain('clipboard')
    })

  })

  describe('ARIA structure', () => {

    it('result section has aria-label', () => {
      // Accessibility: section must be labelled for screen readers
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: minimalSpec,
          markdown: '#### F.Test',
        },
      })
      const section = wrapper.find('section')
      expect(section.attributes('aria-label')).toBe('Generated Planguage Specification')
    })

    it('loading state has role=status and aria-live=polite', () => {
      // Accessibility: dynamic content updates must be announced
      const wrapper = mount(SpecOutput, {
        props: {
          loading: true,
          error: '',
          spec: null,
          markdown: '',
        },
      })
      const statusEl = wrapper.find('[role="status"]')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.attributes('aria-live')).toBe('polite')
    })

    it('error state has role=alert and aria-live=assertive', () => {
      // Accessibility: errors must be announced urgently
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: 'Translation failed',
          spec: null,
          markdown: '',
        },
      })
      const alertEl = wrapper.find('[role="alert"]')
      expect(alertEl.exists()).toBe(true)
      expect(alertEl.attributes('aria-live')).toBe('assertive')
    })

  })

  describe('mobile layout', () => {

    it('section uses w-full (no fixed width) for mobile-first layout', () => {
      // Spec: V.SolutionMobileCompliance — no fixed widths; responsive layout (MOBILE_02)
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: minimalSpec,
          markdown: '#### F.Test',
        },
      })
      const section = wrapper.find('section')
      expect(section.classes()).toContain('w-full')
    })

  })

  describe('Before/After toggle', () => {

    const stubSpec = {
      functions: [{ id: 'F.Test', type: 'Function', level: 'Product', description: 'desc', successCriteria: '', functionOfValue: '' }],
      values: [{ id: 'V.Test', type: 'Value', level: 'Product', description: 'val desc', scale: 'scale', meter: 'meter', status: '0', tolerable: '1', goal: '2', valueOfFunction: '' }],
      solutions: [{ id: 'S.Test', type: 'Solution', level: 'Product', description: 'sol desc', impact: '50%', function: '' }],
    }

    const stubRawInput = { stakes: 'I as a planner', ends: 'improve delivery', means: 'using agile' }

    it('renders in After/spec view by default once a spec is generated', () => {
      // Requirement 6: toggle starts on After view after generation
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: stubSpec,
          markdown: '#### F.Test',
          rawInput: stubRawInput,
        },
      })
      // The "What Planguage gives you" label is present → After view is active
      expect(wrapper.text()).toContain('What Planguage gives you')
      // The raw-input label is not present
      expect(wrapper.text()).not.toContain('What you wrote')
    })

    it('clicking the toggle button switches to Before/raw input view', async () => {
      // Requirement 1 + 2: toggle button present after generation; clicking shows raw input
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: stubSpec,
          markdown: '#### F.Test',
          rawInput: stubRawInput,
        },
      })
      // Find the toggle button by aria-label
      const toggleBtn = wrapper.find('button[aria-label="Switch to raw input view"]')
      expect(toggleBtn.exists()).toBe(true)

      await toggleBtn.trigger('click')

      // After click → Before view: raw input label visible
      expect(wrapper.text()).toContain('What you wrote')
      // Contrast badge text
      expect(wrapper.text()).toContain('Plain language → structured spec')
      // Raw input values rendered
      expect(wrapper.text()).toContain('I as a planner')
      expect(wrapper.text()).toContain('improve delivery')
      expect(wrapper.text()).toContain('using agile')
      // After view label gone
      expect(wrapper.text()).not.toContain('What Planguage gives you')
    })

    it('toggle button meets 44×44px touch target (h-11)', () => {
      // Requirement 7: toggle button must meet 44×44px touch target
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: stubSpec,
          markdown: '#### F.Test',
          rawInput: stubRawInput,
        },
      })
      const toggleBtn = wrapper.find('button[aria-label="Switch to raw input view"]')
      expect(toggleBtn.classes()).toContain('h-11')
    })

    it('toggle is not rendered when no spec has been generated', () => {
      // Requirement 1: toggle only visible once a spec has been generated
      const wrapper = mount(SpecOutput, {
        props: {
          loading: false,
          error: '',
          spec: null,
          markdown: '',
        },
      })
      const toggleBtn = wrapper.find('button[aria-label="Switch to raw input view"]')
      expect(toggleBtn.exists()).toBe(false)
    })

  })

})
