import type { CSSProperties } from "react";

export const panel: CSSProperties = {
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
  background: "#141414",
};

export const badge: CSSProperties = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid #333",
  color: "#9ab",
};

export function voteBtn(bg: string, fg: string): CSSProperties {
  return {
    padding: "8px 18px",
    background: bg,
    color: fg,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 13,
  };
}

export function iconBtn(
  bg: string,
  fg: string,
  size = 40,
): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: 10,
    border: "1px solid #3a3a3a",
    background: bg,
    color: fg,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    flexShrink: 0,
  };
}
