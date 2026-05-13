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
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-[#030407]/95 backdrop-blur-md">
          <div className="text-center space-y-4 max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-white font-black text-xl">Application Error</h2>
            <p className="text-white/40 text-sm">An unexpected issue occurred while loading this section. Please reload to try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-2xl bg-amber-400 text-black font-black text-sm hover:bg-amber-300 active:scale-95 transition-all"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
