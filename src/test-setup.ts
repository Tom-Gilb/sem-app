// Global Vitest setup
// Extends expect with vitest-axe matchers so all test files can use toHaveNoViolations
import { expect } from 'vitest'
import { toHaveNoViolations } from 'vitest-axe/matchers.js'

expect.extend({ toHaveNoViolations } as Record<string, unknown>)
