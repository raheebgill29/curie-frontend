import type { CSSProperties } from "react";
import { B } from "../lib/brandPalette.js";

const SPIN_DIM = { sm: 22, md: 36 } as const;

export type LoadingProps = {
  /** Omit for default “Loading…”. Pass `null` or `""` for spinner only. */
  message?: string | null;
  variant?: "inline" | "section" | "fullscreen";
  size?: keyof typeof SPIN_DIM;
  className?: string;
  style?: CSSProperties;
};

/** Spinner only — for buttons and tight rows */
export function LoadingSpinner({ size = "md", style, className }: Pick<LoadingProps, "size" | "style" | "className">) {
  const dim = SPIN_DIM[size];
  return (
    <div
      className={`curie-loading-spinner ${className || ""}`}
      style={{ width: dim, height: dim, ...style }}
      role="status"
      aria-hidden
    />
  );
}

/**
 * Reusable loading indicator (inline block, section placeholder, or full-screen overlay).
 */
export default function Loading({ message, variant = "inline", size = "md", className, style }: LoadingProps) {
  const resolved = message === undefined ? "Loading…" : message;
  const showMessage = resolved != null && String(resolved).length > 0;
  const dim = SPIN_DIM[size];

  const row = variant === "inline";
  const inner = (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: row ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: row ? 12 : 14,
        ...style,
      }}
      role="status"
      aria-busy="true"
      aria-label={showMessage ? String(resolved) : "Loading"}
    >
      <div className="curie-loading-spinner" style={{ width: dim, height: dim }} />
      {showMessage ? (
        <p
          style={{
            color: B.creamMid,
            fontSize: size === "sm" ? 12 : 14,
            margin: 0,
            textAlign: row ? "left" : "center",
            lineHeight: 1.45,
            fontFamily: "Georgia, serif",
          }}
        >
          {resolved}
        </p>
      ) : null}
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(63, 77, 81, 0.88)",
          backdropFilter: "blur(6px)",
        }}
      >
        {inner}
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div
        style={{
          padding: "36px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {inner}
      </div>
    );
  }

  return <div style={{ padding: "8px 0" }}>{inner}</div>;
}
