interface IconProps { name: 'home' | 'library' | 'user' | 'arrow' | 'back' | 'check' | 'clock' | 'close' | 'plus' | 'logout' | 'spark' | 'chart' | 'download' | 'install' | 'search' | 'swap' | 'camera' | 'edit' | 'trash'; size?: number }

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
    swap: <><path d="M4 8h12l-3-3M20 16H8l3 3"/></>,
    camera: <><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.3"/></>,
    edit: <><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14.5 5.5 18.5 9.5"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/></>,
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="m18.5 16 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/></>,
    chart: <><path d="M4 20V5M4 20h16"/><path d="m7 16 4-5 4 3 5-7"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    install: <><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M10 5h4M12 16v-5M9.5 13.5 12 16l2.5-2.5"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
