import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Full-screen friendly message used for fatal errors and missing WebGL. */
export function FatalScreen({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="fixed inset-0 z-[100] grid place-items-center bg-gradient-to-b from-[#ffb6d5] to-[#fff0f6] p-6">
      <div className="panel max-w-sm px-6 py-7 text-center">
        <div
          className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-[#ff4f93] text-4xl text-white shadow-[0_5px_0_#c42f6c]"
          aria-hidden
        >
          !
        </div>
        <h1 className="mb-2 font-display text-2xl font-extrabold text-pink-700">{title}</h1>
        <p className="mb-5 font-bold text-pink-600">{body}</p>
        <button
          type="button"
          onClick={onRetry ?? (() => window.location.reload())}
          className="min-h-[48px] rounded-full bg-gradient-to-b from-[#ff7eb3] to-[#ff4f93] px-8 font-display text-lg font-extrabold text-white shadow-[0_6px_0_#c42f6c]"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

interface State {
  error: Error | null;
}

/** Catches render errors anywhere below it so a crash never leaves a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[candy-sort-3d] Unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const webgl = /webgl|context/i.test(this.state.error.message);
      return (
        <FatalScreen
          title={webgl ? 'Graphics unavailable' : 'Oops, the candy spilled!'}
          body={
            webgl
              ? 'Your browser could not start 3D graphics. Try enabling hardware acceleration or using another browser.'
              : 'Something went wrong. Your saved progress is safe. Reload to keep playing.'
          }
        />
      );
    }
    return this.props.children;
  }
}

/** Cheap capability check before mounting the 3D canvas. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
