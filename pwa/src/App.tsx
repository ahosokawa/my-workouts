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

export default function App() {
  const profile = useStore((s) => s.profile)

  // No profile yet -> onboarding
  if (!profile) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingView />} />
      </Routes>
    )
  }

  // Cycle complete -> cycle completion flow
  if (profile.isCycleComplete) {
    return (
      <Routes>
        <Route path="*" element={<CycleCompletionView />} />
      </Routes>
    )
  }

  // Normal app with tabs
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
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
