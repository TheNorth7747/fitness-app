import { useState, type FormEvent } from 'react'
import { api } from '../api'
import type { User } from '../../shared/api'

export function GuestProfile({ notice, onAuthenticated }: { notice: string; onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) return setError('账号需为 4–20 位字母、数字或下划线')
    if (password.length < 8 || password.length > 64) return setError('密码长度需为 8–64 位')
    if (mode === 'register' && password !== confirmPassword) return setError('两次输入的密码不一致')
    setLoading(true)
    try {
      const result = mode === 'register'
        ? await api.register(username, password, confirmPassword, displayName)
        : await api.login(username, password)
      onAuthenticated(result.user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败')
    } finally { setLoading(false) }
  }

  return <div className="page guest-profile">
    <header className="page-header guest-heading"><p className="eyebrow">MY FITDAY</p><h1>我的</h1><p>不用登录也能查看今日目标和动作库；登录后才保存训练记录。</p></header>
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    <section className="guest-benefits">
      <div><strong>01</strong><span>计划与训练记录<br/>保存在你的服务器</span></div>
      <div><strong>02</strong><span>换设备登录<br/>进度继续</span></div>
    </section>
    <section className="auth-panel guest-auth-card">
      <div className="segmented" aria-label="账号操作">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>注册</button>
      </div>
      <form onSubmit={submit} noValidate>
        <label>账号<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="4–20 位字母、数字或下划线" aria-describedby="guest-account-rules"/></label>
        <label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="8–64 位密码"/></label>
        {mode === 'register' && <label>确认密码<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="再次输入密码"/></label>}
        {mode === 'register' && <label>昵称（选填）<input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 24))} placeholder="不填就显示账号名" maxLength={24} aria-label="昵称"/></label>}
        <small id="guest-account-rules">密码以安全哈希形式保存，不会存储明文。</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary full" disabled={loading}>{loading ? '请稍候…' : mode === 'login' ? '登录并保存训练' : '创建账号'}</button>
      </form>
    </section>
    <p className="attribution">游客状态下的训练不会上传服务器。</p>
  </div>
}
