import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from '../store'
import { downloadJSON, backupFilename } from '../logic/download'
import { STORAGE_KEY } from '../logic/safeStorage'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Last-resort boundary: without it any render throw unmounts the whole app
 *  to a blank screen with no recovery path. Offers a backup download so the
 *  user can save their data before reloading. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  handleExport = () => {
    try {
      downloadJSON(useStore.getState().exportData(), backupFilename('my-workouts-emergency-backup'))
    } catch {
      // exportData itself failed — fall back to the raw persisted blob
      downloadJSON(
        localStorage.getItem(STORAGE_KEY) ?? '{}',
        backupFilename('my-workouts-raw-backup'),
      )
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="absolute inset-0 overflow-y-auto pt-safe bg-[#0a0a0a] text-white">
        <div className="p-6 max-w-sm mx-auto space-y-4">
          <h1 className="text-xl font-bold mt-8">Something went wrong</h1>
          <p className="text-sm text-[#8e8e93]">
            The app hit an unexpected error. Your workout data is stored on this
            device and is very likely intact — download a backup now, then reload.
          </p>
          <p className="text-xs text-[#8e8e93] break-words bg-[#1c1c1e] rounded-xl p-3">
            {this.state.error.message}
          </p>
          <button
            onClick={this.handleExport}
            className="w-full py-3 rounded-xl bg-[#1c1c1e] font-semibold text-[var(--color-accent)]"
          >
            Download Backup
          </button>
          <button
            onClick={() => location.reload()}
            className="w-full py-3 rounded-xl bg-[var(--color-accent)] font-semibold text-white"
          >
            Reload App
          </button>
        </div>
      </div>
    )
  }
}
