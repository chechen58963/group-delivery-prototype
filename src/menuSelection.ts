import presentation from './menuPresentation.json'

export type Temperature = 'HOT' | 'ICE'
export type MenuChoice = { id: number; quantity: number; temperature?: Temperature }
export type MenuItem = { id: number; name: string; price: number }
export type MenuQuantities = Record<string, number>
export type SavedMenuItem = MenuItem & { quantity: number; base_name?: string; temperature?: Temperature; size_label?: string }

export function menuPresentation(storeName: string, menu: MenuItem) {
  return presentation.find(s => s.store_name === storeName)?.menus.find(m => m.id === menu.id && m.name === menu.name)
    ?? { temperature_options: [] as string[], size_label: '기본', section: '메뉴' }
}
export const choiceKey = (id: number, temperature?: string) => temperature ? `${id}:${temperature}` : String(id)
export function menuQuantity(values: MenuQuantities, id: number) {
  return (values[id] ?? 0) + (values[`${id}:HOT`] ?? 0) + (values[`${id}:ICE`] ?? 0)
}
export function menuChoices(menus: MenuItem[], values: MenuQuantities): MenuChoice[] {
  return menus.flatMap(m => [undefined, 'HOT' as const, 'ICE' as const].flatMap(temperature => {
    const quantity = values[choiceKey(m.id, temperature)] ?? 0
    return Number.isInteger(quantity) && quantity > 0 ? [{ id: m.id, quantity, ...(temperature ? { temperature } : {}) }] : []
  }))
}
export const menuSubtotal = (menus: MenuItem[], values: MenuQuantities) => menus.reduce((sum, m) => sum + m.price * menuQuantity(values, m.id), 0)
export function restoreMenuQuantities(items: SavedMenuItem[]): MenuQuantities {
  const result: MenuQuantities = {}
  for (const item of items) {
    const key = choiceKey(item.id, item.temperature)
    result[key] = (result[key] ?? 0) + item.quantity
  }
  return result
}
export function menuOptionReason(storeName: string, menus: MenuItem[], values: MenuQuantities, enabled: boolean) {
  if (!enabled) return ''
  return menus.some(m => (values[m.id] ?? 0) > 0 && menuPresentation(storeName, m).temperature_options.length > 1)
    ? '담은 음료의 HOT·ICE를 선택해 주세요.' : ''
}
