import { NavLink } from 'react-router-dom'
import { DumbbellIcon, ClockIcon, TrophyIcon, GearIcon } from './Icons'

const tabs = [
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon },
  { to: '/history', label: 'History', Icon: ClockIcon },
  { to: '/prs', label: 'PRs', Icon: TrophyIcon },
  { to: '/settings', label: 'Settings', Icon: GearIcon },
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
            <tab.Icon className="w-5 h-5" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
