interface IconProps { name: 'home' | 'library' | 'user' | 'arrow' | 'back' | 'check' | 'clock' | 'close' | 'plus' | 'logout' | 'spark' | 'chart' | 'download' | 'install' | 'search'; size?: number }

export function Icon({ name, size = 22 }: IconProps) {
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></>,
    library: <><path d="M4 4h6v16H4zM14 4h6v16h-6z"/><path d="M7 8v8M17 8v8"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    back: <><path d="M19 12H5M10 7l-5 5 5 5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/></>,
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="m18.5 16 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/></>,
    chart: <><path d="M4 20V5M4 20h16"/><path d="m7 16 4-5 4 3 5-7"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    install: <><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M10 5h4M12 16v-5M9.5 13.5 12 16l2.5-2.5"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
