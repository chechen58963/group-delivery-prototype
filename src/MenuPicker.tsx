import { useState } from 'react'
import MenuPhoto from './MenuPhoto'
import { choiceKey, menuPresentation, menuQuantity, type MenuItem, type MenuQuantities, type Temperature } from './menuSelection'
import './menu-selection.css'

export default function MenuPicker({ storeName, menus, quantities, onChange, disabled = false, optionsEnabled = false }: {
  storeName: string; menus: MenuItem[]; quantities: MenuQuantities; onChange: (value: MenuQuantities) => void; disabled?: boolean; optionsEnabled?: boolean
}) {
  const [selected, setSelected] = useState<Record<number, Temperature>>({})
  const sections = [...new Set(menus.map(m => menuPresentation(storeName, m).section))]
  return <div className="baef-menu-items baef-grouped-menus">{sections.map(section => <section key={section} className="baef-menu-section" aria-label={section}>
    {sections.length > 1 && <h3>{section}</h3>}
    {menus.filter(m => menuPresentation(storeName, m).section === section).map(m => {
      const meta = menuPresentation(storeName, m), temperatures = meta.temperature_options as Temperature[]
      const dual = optionsEnabled && temperatures.length > 1
      const temperature = dual ? selected[m.id] ?? (quantities[`${m.id}:HOT`] ? 'HOT' : quantities[`${m.id}:ICE`] ? 'ICE' : undefined) : optionsEnabled ? temperatures[0] : undefined
      const total = menuQuantity(quantities, m.id), key = choiceKey(m.id, temperature)
      const count = quantities[key] ?? 0
      const change = (delta: number) => {
        const next = { ...quantities }
        // A fixed option can migrate an older, unsuffixed selection without losing its quantity.
        const previous = temperature && !dual ? count + (next[m.id] ?? 0) : count
        if (temperature && !dual) delete next[m.id]
        next[key] = Math.max(0, Math.min(10, previous + delta)); onChange(next)
      }
      return <div className="baef-menu-item" key={m.id} data-selected={total > 0}>
        <MenuPhoto storeName={storeName} name={m.name} temperature={temperature} />
        <div className="baef-menu-description"><b>{m.name}</b><span>{m.price.toLocaleString('ko-KR')}원</span>
          <div className="baef-menu-options">
            {dual ? <select aria-label={`${m.name} 온도`} disabled={disabled} value={temperature ?? ''} onChange={e => {
              const value = e.target.value as Temperature; setSelected(v => ({ ...v, [m.id]: value }))
              if (quantities[m.id]) { const next = { ...quantities }; next[choiceKey(m.id, value)] = (next[choiceKey(m.id, value)] ?? 0) + next[m.id]; delete next[m.id]; onChange(next) }
            }}><option value="" disabled>온도 선택</option>{temperatures.map(t => <option key={t} value={t}>{t}</option>)}</select> : temperatures.length === 1 ? <span className="baef-temperature">{temperatures[0]}</span> : null}
            {meta.size_label !== '기본' && <span>{meta.size_label}</span>}
            {meta.size_label === '기본' && temperatures.length > 0 && <span>기본 사이즈</span>}
          </div>
          {total > 0 && <small className="baef-menu-chosen">{[quantities[m.id] ? `${quantities[m.id]}개${dual ? ' · 온도 선택 필요' : ''}` : '', ...(['HOT', 'ICE'] as const).map(t => quantities[`${m.id}:${t}`] ? `${t} ${quantities[`${m.id}:${t}`]}개` : '')].filter(Boolean).join(' · ')} 담음</small>}
        </div>
        <div className="baef-quantity"><button type="button" aria-label={`${m.name}${temperature ? ` ${temperature}` : ''} 줄이기`} disabled={disabled || (dual && !temperature) || !(count + (!dual ? quantities[m.id] ?? 0 : 0))} onClick={() => change(-1)}>−</button><span>{count + (temperature && !dual ? quantities[m.id] ?? 0 : 0)}</span><button type="button" aria-label={`${m.name}${temperature ? ` ${temperature}` : ''} 추가`} disabled={disabled || (dual && !temperature) || total >= 10} onClick={() => change(1)}>+</button></div>
      </div>
    })}
  </section>)}</div>
}
