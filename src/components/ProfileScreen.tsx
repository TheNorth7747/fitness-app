import { useEffect, useState } from 'react'
import { displayNameOf, type User } from '../../shared/api'
import { getPlan, orderedDays, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN } from '../../shared/plans'
import { ProfileEditor } from './ProfileEditor'
import { Icon } from './Icon'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function ProfileScreen({ user, onChangePlan, onCustomize, onOpenData, onProfileChange, onLogout }: {
  user: User
  onChangePlan: () => void
  onCustomize: () => void
  onOpenData: () => void
  onProfileChange: (displayName: string, avatar: string) => Promise<void>
  onLogout: () => void
}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => (window as Window & { __fitdayInstallPrompt?: Event }).__fitdayInstallPrompt as BeforeInstallPromptEvent | undefined ?? null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
  const [editingProfile, setEditingProfile] = useState(false)

  useEffect(() => {
    const target = window as Window & { __fitdayInstallPrompt?: Event }
    const handlePrompt = () => {
      if (target.__fitdayInstallPrompt) setInstallPrompt(target.__fitdayInstallPrompt as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => { setInstalled(true); setInstallPrompt(null) }
    window.addEventListener('fitday-install-available', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('fitday-install-available', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const plan = getPlan(user.planId ?? 'gym-three', user.legFocus)

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    ;(window as Window & { __fitdayInstallPrompt?: Event }).__fitdayInstallPrompt = undefined
    setInstallPrompt(null)
  }

  return <div className="page profile-page">
    <header className="profile-header">
      <button className="avatar avatar-button" onClick={() => setEditingProfile(true)} aria-label="编辑头像与昵称">
        {user.avatar ? <img src={user.avatar} alt=""/> : <span>{displayNameOf(user).slice(0, 1).toUpperCase()}</span>}
      </button>
      <div><p className="eyebrow">我的训练</p><h1>{displayNameOf(user)}</h1>{user.displayName && <p className="profile-username">@{user.username}</p>}</div>
      <button className="icon-button" onClick={() => setEditingProfile(true)} aria-label="编辑资料"><Icon name="edit"/></button>
    </header>

    <section className="section-block"><div className="section-title"><h2>当前计划</h2></div><button className="current-plan" onClick={onChangePlan}><span><small>{plan.location === 'gym' ? '健身房' : '居家'} · {plan.days.length} 天循环</small><strong>{plan.name}</strong><span>下一站：{orderedDays(plan, user.planDayOrder)[user.cyclePosition % plan.days.length].name}</span></span><Icon name="arrow"/></button>
      <div className="plan-actions">
        <button className="secondary" onClick={onCustomize}><Icon name="spark" size={16}/>自定义动作与组数</button>
        <button className="secondary" onClick={onChangePlan}>更换计划</button>
      </div>
      <p className="plan-custom-hint">{Object.keys(user.planCustomization ?? {}).length ? '已保存自定义方案，训练时按你的设置执行。' : `推荐每个动作 ${RECOMMENDED_SETS_MIN}–${RECOMMENDED_SETS_MAX} 组，可在自定义里调整。`}</p>
    </section>

    <section className="section-block profile-tools">
      <div className="section-title"><h2>数据与应用</h2></div>
      <button className="utility-row" onClick={onOpenData}><span><Icon name="chart"/><span><strong>训练数据与历史</strong><small>本周复盘、肌群分布与记录纠错</small></span></span><Icon name="arrow" size={18}/></button>
      {!installed && installPrompt && <button className="utility-row" onClick={installApp}><span><Icon name="install"/><span><strong>安装到手机桌面</strong><small>全屏打开，像原生应用一样使用</small></span></span><span>安装</span></button>}
    </section>

    <button className="logout-button" onClick={onLogout}><Icon name="logout"/>退出登录</button>
    <p className="attribution">Fitday v1.7.0<br/>动作数据：hasaneyldrm/exercises-dataset<br/>媒体：© Gym visual · 计划参考：B站好人松松</p>

    {editingProfile && <ProfileEditor user={user} onSave={async (displayName, avatar) => { await onProfileChange(displayName, avatar); setEditingProfile(false) }} onClose={() => setEditingProfile(false)}/>}
  </div>
}
