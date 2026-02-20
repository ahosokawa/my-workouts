import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import TabBar from './components/TabBar'
import OnboardingView from './views/OnboardingView'
import CycleCompletionView from './views/CycleCompletionView'
import WorkoutView from './views/WorkoutView'
import HistoryView from './views/HistoryView'
import WorkoutDetailView from './views/WorkoutDetailView'
import PRsView from './views/PRsView'
import E1RMChartView from './views/E1RMChartView'
import SettingsView from './views/SettingsView'

const shellStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}

export default function App() {
  const profile = useStore((s) => s.profile)

  // No profile yet -> onboarding
  if (!profile) {
    return (
      <div style={shellStyle} className="overflow-y-auto overscroll-none pt-safe">
        <Routes>
          <Route path="*" element={<OnboardingView />} />
        </Routes>
      </div>
    )
  }

  // Cycle complete -> cycle completion flow
  if (profile.isCycleComplete) {
    return (
      <div style={shellStyle} className="overflow-y-auto overscroll-none pt-safe">
        <Routes>
          <Route path="*" element={<CycleCompletionView />} />
        </Routes>
      </div>
    )
  }

  // Normal app with tabs
  return (
    <div style={shellStyle} className="flex flex-col">
      <div className="flex-1 overflow-y-auto overscroll-none pt-safe">
        <Routes>
          <Route path="/" element={<Navigate to="/workout" replace />} />
          <Route path="/workout" element={<WorkoutView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/history/:sessionId" element={<WorkoutDetailView />} />
          <Route path="/prs" element={<PRsView />} />
          <Route path="/prs/chart/:liftId" element={<E1RMChartView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/workout" replace />} />
        </Routes>
      </div>
      <TabBar />
    </div>
  )
}
