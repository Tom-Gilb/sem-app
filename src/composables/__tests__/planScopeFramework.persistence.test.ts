/**
 * planScopeFramework.persistence.test.ts
 *
 * v523 (2026-07-21) — Vitest reproduction of Tom Gilb's Plan Scope Framework
 * "no writes ever land in localStorage" bug, ordered by the newly-banked
 * Speculation-Cap-at-Ship-Two SUPREME rule: after 9 speculative ships and
 * one raw-inspector diagnostic that showed localStorage empty, prove
 * mechanically WHY the writes don't land instead of shipping guess #10.
 *
 * Hypotheses under test (each is one `it()`):
 *   (a) Vue 3 auto-unwraps refs passed as props — if true, `planIdRef.value`
 *       inside the composable returns undefined, and the storage key becomes
 *       `sem-app:plan-scope-framework:v1:undefined`.
 *   (b) Composable-level watch fires on deep property mutations of state and
 *       persists to localStorage — the "write path" test.
 *   (c) Two consumers of the SAME planId share the SAME cached Ref via the
 *       module-level _cache Map — the "shared reactive state" test.
 *   (d) Vue reactivity propagates a mutation from consumer A to consumer B's
 *       template via the shared Ref — the "cross-surface visibility" test.
 *
 * Passing tests localise the bug precisely; failing tests point at the
 * exact seam that needs the fix.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { usePlanScopeFramework } from '../usePlanScopeFramework'

/** In-memory localStorage shim — jsdom provides one, we just clear it. */
beforeEach(() => {
  try { localStorage.clear() } catch { /* jsdom */ }
})

/** Small helper — a Vue component that just calls the composable and
 *  exposes a mutation button via a scoped slot so tests can drive it. */
function makeConsumer(planIdRef: Ref<string>) {
  return defineComponent({
    props: { planIdRef: { type: Object, required: true } },
    setup(props) {
      const framework = usePlanScopeFramework(props.planIdRef as Ref<string>)
      return { framework }
    },
    render() {
      return h('div', {
        'data-test': 'consumer',
        'data-deadline-mode': this.framework.state.value.deadlineMode ?? '(null)',
      })
    },
  })
}

describe('Plan Scope Framework — persistence + reactivity ground truth', () => {

  it('(a) Vue passes props.planIdRef as an object with .value (Ref) — NOT auto-unwrapped', () => {
    const captured: Record<string, unknown> = {}
    const Probe = defineComponent({
      props: { planIdRef: { type: Object, required: true } },
      setup(props) {
        captured.typeofProp   = typeof props.planIdRef
        captured.propValueDot = (props.planIdRef as Ref<string> | undefined)?.value
        captured.propKeys     = props.planIdRef ? Object.keys(props.planIdRef).join(',') : '(no obj)'
        return () => h('div')
      },
    })
    const source = ref('default')
    mount(Probe, { props: { planIdRef: source } })
    // Vue 3 with `type: Object` prop: ref passes as Ref object; NOT auto-unwrapped.
    expect(captured.typeofProp).toBe('object')
    expect(captured.propValueDot).toBe('default')
  })

  it('(b) mutating framework.state.value.deadlineMode persists to localStorage', async () => {
    const planIdRef = ref('default')
    const Consumer = makeConsumer(planIdRef)
    const wrapper = mount(Consumer, { props: { planIdRef } })
    // Sanity — no key yet.
    expect(localStorage.getItem('sem-app:plan-scope-framework:v1:default')).toBeNull()
    // Mutate through the composable's state proxy.
    const vm = wrapper.vm as unknown as { framework: ReturnType<typeof usePlanScopeFramework> }
    vm.framework.state.value.deadlineMode = 'from-start'
    await nextTick()
    // Vue's deep watch is asynchronous; give the microtask queue a chance.
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem('sem-app:plan-scope-framework:v1:default')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.deadlineMode).toBe('from-start')
  })

  it('(c) two consumers of the same planId share the SAME cached Ref', async () => {
    const planIdRef1 = ref('default')
    const planIdRef2 = ref('default')
    const Consumer = makeConsumer(planIdRef1)
    const wrapperA = mount(Consumer, { props: { planIdRef: planIdRef1 } })
    const wrapperB = mount(Consumer, { props: { planIdRef: planIdRef2 } })
    const vmA = wrapperA.vm as unknown as { framework: ReturnType<typeof usePlanScopeFramework> }
    const vmB = wrapperB.vm as unknown as { framework: ReturnType<typeof usePlanScopeFramework> }
    // Mutate via A; read via B.
    vmA.framework.state.value.hasBudget = 'yes'
    await nextTick()
    expect(vmB.framework.state.value.hasBudget).toBe('yes')
  })

  it('(d) mutation in consumer A re-renders consumer B via reactive template dependency', async () => {
    const planIdRef1 = ref('default')
    const planIdRef2 = ref('default')
    const Consumer = makeConsumer(planIdRef1)
    const wrapperA = mount(Consumer, { props: { planIdRef: planIdRef1 } })
    const wrapperB = mount(Consumer, { props: { planIdRef: planIdRef2 } })
    const vmA = wrapperA.vm as unknown as { framework: ReturnType<typeof usePlanScopeFramework> }
    // Before: both DOMs show (null).
    expect(wrapperA.get('[data-test="consumer"]').attributes('data-deadline-mode')).toBe('(null)')
    expect(wrapperB.get('[data-test="consumer"]').attributes('data-deadline-mode')).toBe('(null)')
    // Mutate A; both should reflect after tick.
    vmA.framework.state.value.deadlineMode = 'date'
    await nextTick()
    expect(wrapperA.get('[data-test="consumer"]').attributes('data-deadline-mode')).toBe('date')
    expect(wrapperB.get('[data-test="consumer"]').attributes('data-deadline-mode')).toBe('date')
  })

  it('(e) computed planIdRef (mimicking SEMEntryForm) also carries as ref-with-.value', async () => {
    const captured: Record<string, unknown> = {}
    const Probe = defineComponent({
      props: { planIdRef: { type: Object, required: true } },
      setup(props) {
        captured.typeofProp   = typeof props.planIdRef
        captured.propValueDot = (props.planIdRef as { value?: string } | undefined)?.value
        return () => h('div')
      },
    })
    const source = computed(() => 'default')
    mount(Probe, { props: { planIdRef: source } })
    expect(captured.typeofProp).toBe('object')
    expect(captured.propValueDot).toBe('default')
  })

  it('(g) TypeScript-only defineProps<{ planIdRef: Ref<string> }> — does Vue auto-unwrap?', async () => {
    // This is EXACTLY how PlanScopeStatusStrip.vue declares props:
    //   const props = defineProps<{
    //     planIdRef: Ref<string> | ComputedRef<string>
    //     compact?: boolean
    //   }>()
    // Without a runtime `type: Object` shape, Vue's prop system may treat the
    // prop differently — POTENTIALLY auto-unwrapping the ref before it lands
    // in props.  Prove or disprove here.
    const captured: Record<string, unknown> = {}
    const Probe = defineComponent({
      props: {
        // Simulate what TypeScript-only defineProps produces at runtime:
        // just an entry in the props record, no `type` constraint.
        planIdRef: {},
      },
      setup(props) {
        const p = props as { planIdRef?: unknown }
        captured.typeofProp   = typeof p.planIdRef
        captured.propValueDot = (p.planIdRef as { value?: string } | undefined)?.value
        captured.propRaw      = p.planIdRef
        return () => h('div')
      },
    })
    const source = computed(() => 'default')
    mount(Probe, { props: { planIdRef: source } })
    // If Vue auto-unwraps, typeofProp === 'string' and propValueDot === undefined.
    // If Vue does NOT auto-unwrap, typeofProp === 'object' and propValueDot === 'default'.
    // This test's assertion drives the diagnosis:
    expect(['string', 'object']).toContain(captured.typeofProp)
    // eslint-disable-next-line no-console
    console.info('[test-g] typeofProp=%s, propValueDot=%s, propRaw=%o', captured.typeofProp, captured.propValueDot, captured.propRaw)
  })

  it('(h) template-bound ref prop (parent template :plan-id-ref="planScopePlanId") — auto-unwrapped or not?', async () => {
    // Mimics SEMEntryForm's mount site EXACTLY:
    //   Parent has `const planScopePlanId = computed(() => 'default')`
    //   Parent template: `<Child :plan-id-ref="planScopePlanId" />`
    // Question: does the child receive the ref or the unwrapped string?
    const captured: Record<string, unknown> = {}
    const Child = defineComponent({
      props: { planIdRef: {} }, // TS-only defineProps runtime shape
      setup(props) {
        const p = props as { planIdRef?: unknown }
        captured.typeofProp   = typeof p.planIdRef
        captured.propValueDot = (p.planIdRef as { value?: string } | undefined)?.value
        captured.isString     = typeof p.planIdRef === 'string'
        captured.raw          = String(p.planIdRef)
        return () => h('div')
      },
    })
    // Parent uses TEMPLATE syntax to bind the ref — the actual SEMEntryForm shape.
    const Parent = defineComponent({
      components: { Child },
      setup() {
        const planScopePlanId = computed(() => 'default')
        return { planScopePlanId }
      },
      template: `<Child :plan-id-ref="planScopePlanId" />`,
    })
    mount(Parent)
    // eslint-disable-next-line no-console
    console.info('[test-h] typeofProp=%s, propValueDot=%s, isString=%s, raw=%s',
      captured.typeofProp, captured.propValueDot, captured.isString, captured.raw)
    // The critical assertion — if Vue's template auto-unwraps the ref before
    // passing it as a prop, propValueDot will be undefined and isString true.
    // This directly explains Tom's inspector "<no plan-id-ref>" output.
    // We DO NOT hard-assert here — we just want the log line to reveal truth.
    expect(typeof captured.typeofProp).toBe('string')
  })

  it('(f) v-model on destructured state (mimics ResourcesSharpenPanel EXACTLY) persists to localStorage', async () => {
    // Mimics ResourcesSharpenPanel's exact wiring:
    //   1. Destructures `state: scopeFramework` from usePlanScopeFramework(planIdRef).
    //   2. Uses `v-model="scopeFramework.deadlineMode"` on a radio input.
    //   3. Test drives the radio via setValue() — same code path as Tom clicking.
    const PanelMimic = defineComponent({
      props: { planIdRef: { type: Object, required: true } },
      setup(props) {
        const { state: scopeFramework } = usePlanScopeFramework(props.planIdRef as Ref<string>)
        return { scopeFramework }
      },
      template: `
        <div>
          <input type="radio" v-model="scopeFramework.deadlineMode" value="date" data-test="radio-date" />
          <input type="radio" v-model="scopeFramework.deadlineMode" value="from-start" data-test="radio-fs" />
          <input type="number" v-model.number="scopeFramework.deadlineFromStartValue" data-test="num" />
        </div>
      `,
    })
    // Fresh module state — clear cache indirectly by using a unique planId.
    const planIdRef = ref('test-f')
    const wrapper = mount(PanelMimic, { props: { planIdRef } })
    // Sanity — no key yet.
    expect(localStorage.getItem('sem-app:plan-scope-framework:v1:test-f')).toBeNull()
    // Simulate Tom clicking the 'from-start' radio.
    await wrapper.get('[data-test="radio-fs"]').setValue()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    // Simulate typing 5 into the number input.
    await wrapper.get('[data-test="num"]').setValue(5)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem('sem-app:plan-scope-framework:v1:test-f')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.deadlineMode).toBe('from-start')
    expect(parsed.deadlineFromStartValue).toBe(5)
  })
})
