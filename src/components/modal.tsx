"use client";

import { useEffect } from "react";
import { IconX } from "./icons";
import { iconBtn } from "./ui";

interface ModalProps {
  /** 关闭回调：Esc / 点遮罩 / 右上角关闭按钮 都会触发 */
  onClose: () => void;
  /** 关闭按钮的 aria-label 文案（经 i18n 传入） */
  closeLabel: string;
  children: React.ReactNode;
}

/**
 * 通用模态框：全屏遮罩 + 居中深色卡片。
 * Esc 关闭、点遮罩关闭、右上角关闭按钮；role=dialog / aria-modal。
 */
export function Modal({ onClose, closeLabel, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          maxWidth: 420,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 16,
        }}
      >
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          style={{ position: "absolute", top: 10, right: 10, ...iconBtn("#202020", "#999", 28) }}
        >
          <IconX size={15} />
        </button>
        {children}
      </div>
    </div>
  );
}
