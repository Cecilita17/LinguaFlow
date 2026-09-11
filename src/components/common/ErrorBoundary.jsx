import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Robust React Error Boundary component to prevent uncaught rendering errors
 * from turning the entire page white.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === 'function') {
      try {
        this.props.onReset();
      } catch (e) {
        console.warn('[ErrorBoundary] Error during onReset callback:', e);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, this.handleReset)
          : this.props.fallback;
      }

      return (
        <div className="p-6 m-4 rounded-2xl bg-[var(--surface-primary)] border border-rose-500/40 shadow-xl text-[var(--text-primary)] flex flex-col items-center justify-center text-center my-auto">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3 shadow-inner">
            <AlertTriangle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
          </div>
          <h3 className="text-base font-bold mb-1 text-[var(--text-primary)]">
            {this.props.title || 'Error al renderizar la transcripción'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mb-4 leading-relaxed">
            {this.state.error?.message || 'Se produjo un error inesperado al procesar la transcripción.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{this.props.resetLabel || 'Reiniciar lector'}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
