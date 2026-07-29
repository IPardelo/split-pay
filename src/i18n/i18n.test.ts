import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { gl } from './gl'

const DICTS = { gl, es, en } as const

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

describe('dicionarios', () => {
  it('as tres linguas teñen exactamente as mesmas chaves', () => {
    const keys = Object.keys(gl).sort()
    expect(Object.keys(es).sort()).toEqual(keys)
    expect(Object.keys(en).sort()).toEqual(keys)
  })

  it('ningunha tradución está baleira', () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(`${lang}:${key}:${value.trim().length > 0}`).toBe(`${lang}:${key}:true`)
      }
    }
  })

  it('cada chave usa as mesmas variables nas tres linguas', () => {
    for (const key of Object.keys(gl) as (keyof typeof gl)[]) {
      const reference = placeholders(gl[key]).join(',')
      expect(`${key}:${placeholders(es[key]).join(',')}`).toBe(`${key}:${reference}`)
      expect(`${key}:${placeholders(en[key]).join(',')}`).toBe(`${key}:${reference}`)
    }
  })

  it('hai unha etiqueta por categoría, tipo de movemento e estado de sync', () => {
    for (const cat of ['general', 'food', 'groceries', 'transport', 'lodging', 'fun', 'shopping', 'health', 'bills', 'other']) {
      expect(typeof gl[`cat.${cat}` as keyof typeof gl]).toBe('string')
    }
    for (const type of ['EXPENSE', 'INCOME', 'TRANSFER']) {
      expect(typeof gl[`type.${type}` as keyof typeof gl]).toBe('string')
    }
    for (const status of ['off', 'connecting', 'live', 'error']) {
      expect(typeof gl[`sync.status.${status}` as keyof typeof gl]).toBe('string')
    }
  })

  it('o nome da aplicación é o mesmo nas tres linguas', () => {
    expect(gl['app.name']).toBe('Split Pay')
    expect(es['app.name']).toBe('Split Pay')
    expect(en['app.name']).toBe('Split Pay')
  })
})
