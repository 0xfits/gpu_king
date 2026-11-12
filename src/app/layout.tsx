import type { Metadata } from "next";
import "../styles/globals.css";
import { GameProvider } from "../lib/game-context";
import { AppHeader, AppFooter } from "../components/shell";

export const metadata: Metadata = {
  title: "GPU_King",
  description: "三人合资 · 决策投票 · 四域声望",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body style={{ background: "#0d0d0d", color: "#e0e0e0" }}>
        <GameProvider>
          <AppHeader />
          {children}
          <AppFooter />
        </GameProvider>
      </body>
    </html>
  );
}
