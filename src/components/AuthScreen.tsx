import { useState, type FormEvent } from 'react'
import { api } from '../api'
import type { User } from '../../shared/api'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
        ? await api.register(username, password, confirmPassword)
        : await api.login(username, password)
      onAuthenticated(result.user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败')
    } finally { setLoading(false) }
  }

  return <main className="auth-screen">
    <section className="auth-brand">
      <div className="brand-mark">F<span>·</span></div>
      <p className="eyebrow">FITDAY / 训练从今天开始</p>
      <h1>别想今天练什么。<br/><em>打开就练。</em></h1>
      <p>选择适合你的循环计划，记录每一组，让进步有迹可循。</p>
      <div className="auth-proof"><strong>04</strong><span>套训练计划<br/>健身房与居家</span></div>
    </section>
    <section className="auth-panel">
      <div className="segmented" aria-label="账号操作">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>注册</button>
      </div>
      <form onSubmit={submit} noValidate>
        <label>账号<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="4–20 位字母、数字或下划线" aria-describedby="account-rules"/></label>
        <label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="8–64 位密码"/></label>
        {mode === 'register' && <label>确认密码<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="再次输入密码"/></label>}
        <small id="account-rules">密码仅会以安全哈希形式保存在服务器。</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary full" disabled={loading}>{loading ? '请稍候…' : mode === 'login' ? '登录并继续' : '创建账号'}</button>
      </form>
    </section>
  </main>
}
