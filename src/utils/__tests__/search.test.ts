import { describe, it, expect } from 'vitest'
import { sanitizeSearchTerm } from '../search'

describe('sanitizeSearchTerm', () => {
  it('leaves a plain alphanumeric term unchanged', () => {
    expect(sanitizeSearchTerm('jane')).toBe('jane')
    expect(sanitizeSearchTerm('Jane Doe 123')).toBe('Jane Doe 123')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeSearchTerm('  jane  ')).toBe('jane')
  })

  it('strips PostgREST .or() structural chars (comma and parens)', () => {
    expect(sanitizeSearchTerm('a,b')).toBe('ab')
    expect(sanitizeSearchTerm('(jane)')).toBe('jane')
    expect(sanitizeSearchTerm('a,(b),c')).toBe('abc')
  })

  it("strips the '*' wildcard alias so it can't broaden the match", () => {
    expect(sanitizeSearchTerm('jo*')).toBe('jo')
    expect(sanitizeSearchTerm('*jane*')).toBe('jane')
  })

  it('escapes an underscore so it matches literally (not stripped)', () => {
    expect(sanitizeSearchTerm('jane_doe')).toBe('jane\\_doe')
  })

  it('escapes a percent sign so it matches literally', () => {
    expect(sanitizeSearchTerm('50%')).toBe('50\\%')
  })

  it('escapes a backslash', () => {
    expect(sanitizeSearchTerm('\\')).toBe('\\\\')
  })

  it('combines stripping and escaping in one term', () => {
    // '*' stripped; '_' and '%' escaped; comma stripped.
    expect(sanitizeSearchTerm('a_*b%,c')).toBe('a\\_b\\%c')
  })
})
