import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Shows a readable message instead of a blank window if rendering ever throws. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unlimited UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal" role="alert">
          <h1>Unlimited hit a display problem</h1>
          <p>{this.state.error.message}</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload the window
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
