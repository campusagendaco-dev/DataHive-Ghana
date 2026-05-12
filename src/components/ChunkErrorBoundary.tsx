import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; retried: boolean }

/**
 * Catches dynamic-import chunk failures (stale hashes after deploy)
 * and auto-reloads once. On a second failure it shows a manual refresh prompt.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retried: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed") ||
      error?.name === "ChunkLoadError";

    if (isChunkError && !this.state.retried) {
      this.setState({ retried: true });
      // Hard reload to pick up fresh chunks
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError && this.state.retried) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-[#030407]/95 backdrop-blur-md">
          <div className="text-center space-y-4 max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="text-white font-black text-xl">New version available</h2>
            <p className="text-white/40 text-sm">SwiftData was updated. Please refresh to load the latest version.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-2xl bg-amber-400 text-black font-black text-sm hover:bg-amber-300 active:scale-95 transition-all"
            >
              Refresh Now
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
