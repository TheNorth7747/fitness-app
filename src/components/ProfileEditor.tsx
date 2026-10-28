import { useRef, useState } from 'react'
import { DISPLAY_NAME_MAX, type User } from '../../shared/api'
import { BackButton } from './BackButton'
import { Icon } from './Icon'

const AVATAR_SIZE = 288
const AVATAR_QUALITY = 0.82

/** 把图片压成正方形 data URL，控制在几十 KB，直接存数据库 */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器不支持图片处理')
  const side = Math.min(bitmap.width, bitmap.height)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY)
}

export function ProfileEditor({ user, onSave, onClose }: {
  user: User
  onSave: (displayName: string, avatar: string) => Promise<void>
  onClose: () => void
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [avatar, setAvatar] = useState(user.avatar ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function pickFile(file: File | undefined) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) return setError('请选择图片文件')
    if (file.size > 12 * 1024 * 1024) return setError('图片过大，请换一张小于 12MB 的')
    try { setAvatar(await compressImage(file)) }
    catch { setError('这张图片无法读取，换一张试试') }
  }

  async function submit() {
    setSaving(true); setError('')
    try { await onSave(displayName.trim(), avatar) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试') }
    finally { setSaving(false) }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="profile-editor" onClick={(event) => event.stopPropagation()}>
      <div className="choice-sheet-top">
        <BackButton label="返回我的" onClick={onClose} compact/>
        <button className="icon-button" onClick={onClose} aria-label="关闭资料编辑"><Icon name="close"/></button>
      </div>
      <div><p className="eyebrow">个人资料</p><h2>头像与昵称</h2></div>

      <div className="avatar-editor">
        <div className="avatar-preview">{avatar ? <img src={avatar} alt="当前头像"/> : <span>{user.username.slice(0, 1).toUpperCase()}</span>}</div>
        <div className="avatar-actions">
          <button className="secondary" onClick={() => inputRef.current?.click()}><Icon name="camera" size={16}/>上传头像</button>
          {avatar && <button className="secondary" onClick={() => setAvatar('')}>移除头像</button>}
          <small>支持 JPG / PNG / WebP，自动裁成正方形并压缩</small>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => { void pickFile(event.target.files?.[0]); event.target.value = '' }}/>

      <label className="field-label">昵称<input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, DISPLAY_NAME_MAX))} placeholder={user.username} maxLength={DISPLAY_NAME_MAX} aria-label="昵称"/></label>
      <small>留空则显示账号名。昵称最多 {DISPLAY_NAME_MAX} 个字。</small>

      {error && <p className="form-error">{error}</p>}
      <div className="editor-footer-actions profile-editor-actions">
        <button className="secondary" onClick={onClose}>取消</button>
        <button className="primary" onClick={submit} disabled={saving}>{saving ? '正在保存…' : '保存资料'}</button>
      </div>
    </section>
  </div>
}
