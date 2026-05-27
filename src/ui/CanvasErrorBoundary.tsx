"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Catches hard render-time throws from the 3D subtree (e.g. a WebGL/init error)
 * so a crash degrades to a friendly card + link to the text résumé instead of a
 * blank white page. WebGL *context loss* is handled separately by the quality
 * store (graceful tier step-down); this is the last-resort net for exceptions.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D canvas crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="webgl-fallback">
          <div className="webgl-fallback__card">
            <h2>The 3D world couldn’t start</h2>
            <p>
              Something went wrong rendering the village. No worries — everything
              is also available as plain text.
            </p>
            <div className="webgl-fallback__actions">
              <button onClick={() => window.location.reload()}>Try again</button>
              <a href="/resume">Open text résumé →</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
