import { Icon } from './Icon'

export type Tab = 'home' | 'library' | 'profile'

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items = [
    { id: 'home' as const, label: '首页', icon: 'home' as const },
    { id: 'library' as const, label: '动作库', icon: 'library' as const },
    { id: 'profile' as const, label: '我的', icon: 'user' as const },
  ]
  return <nav className="bottom-nav" aria-label="主导航">
    {items.map((item) => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onChange(item.id)} aria-current={active === item.id ? 'page' : undefined}>
      <Icon name={item.icon}/><span>{item.label}</span>
    </button>)}
  </nav>
}
