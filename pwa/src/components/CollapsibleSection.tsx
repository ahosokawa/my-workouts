import type { ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  isCollapsed: boolean
  onToggle: () => void
  badge?: ReactNode
  trailing?: ReactNode
  children: ReactNode
}

export default function CollapsibleSection({
  title,
  isCollapsed,
  onToggle,
  badge,
  trailing,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm uppercase tracking-wider text-[#8e8e93]">{title}</h2>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {trailing}
          <span className={`text-[#8e8e93] text-sm transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
            ›
          </span>
        </div>
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isCollapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 300ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="px-4 pb-3 divide-y divide-[#38383a]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
