import { useState } from 'react'

export function ExerciseImage({ src, alt, fallback, className = '' }: { src?: string; alt: string; fallback: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <div className={`exercise-media ${className}`}>
    {src && !failed ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}/> : <span aria-hidden="true">{fallback.slice(0, 1)}</span>}
  </div>
}
