import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const code = ts.transpileModule(readFileSync(new URL('../src/AppPreferences.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const location = { label: '현재 위치', source: 'gps', coordinates: { lat: 36.3621, lng: 127.3444, accuracy: 15, updatedAt: 100 } }
const module = { exports: {} }
new Function('require', 'module', 'exports', code)(specifier => {
  if (specifier === './campus') return { CAMPUS_LOCATION: '충남대학교 정문 주변' }
  if (specifier === './useCurrentLocation') return { useCurrentLocation: () => location }
  return require(specifier)
}, module, module.exports)
const { AppPreferencesProvider, usePreferences } = module.exports

function readPreferences({ stored = null, dark = false, failStorage = false } = {}) {
  const originalWindow = globalThis.window
  globalThis.window = {
    localStorage: { getItem(key) { assert.equal(key, 'group-delivery-theme'); if (failStorage) throw new Error('storage blocked'); return stored } },
    matchMedia: () => ({ matches: dark }),
  }
  let value
  function Read() { value = usePreferences(); return null }
  try { renderToStaticMarkup(React.createElement(AppPreferencesProvider, null, React.createElement(Read))) }
  finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow }
  return value
}

test('existing light and dark preferences take precedence over the device theme', () => {
  const light = readPreferences({ stored: 'light', dark: true })
  assert.equal(light.themePreference, 'light')
  assert.equal(light.isDark, false)
  assert.equal(readPreferences({ stored: 'dark', dark: false }).isDark, true)
})
test('system theme still works when no explicit preference exists or storage is unavailable', () => {
  assert.equal(readPreferences({ dark: true }).isDark, true)
  assert.equal(readPreferences({ stored: 'system', dark: false }).isDark, false)
  assert.equal(readPreferences({ failStorage: true, dark: true }).isDark, true)
})
test('the shared GPS state and theme control remain available after removing the old UI state', () => {
  const preferences = readPreferences()
  assert.equal(preferences.currentLocation, location)
  assert.equal(typeof preferences.setThemePreference, 'function')
  assert.equal('tx' in preferences, false)
  assert.equal('posts' in preferences, false)
})
