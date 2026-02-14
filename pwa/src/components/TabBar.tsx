import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/workout', label: 'Workout', icon: '🏋️' },
  { to: '/history', label: 'History', icon: '📋' },
  { to: '/prs', label: 'PRs', icon: '🏆' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function TabBar() {
  return (
    <nav className="flex-shrink-0 border-t border-[#38383a] bg-[#1c1c1e] pb-safe">
      <div className="flex justify-around items-center h-12">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-xs transition-colors ${
                isActive ? 'text-[var(--color-accent)]' : 'text-[#8e8e93]'
              }`
            }
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
