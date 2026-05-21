"use client";

import { useState, type CSSProperties } from "react";
import {
  useGetNudgeTopicsQuery,
  useSendChildNudgeMutation,
  type NudgeTopicItem,
} from "../lib/api/homeApi";

const SCREEN_BG = "#3e4f57";
const CARD_BG = "#4a5b63";
const ACCENT_GOLD = "#f0a043";
const ACCENT_TERRA = "#c95c4a";
const TEXT_PRIMARY = "#f6efe3";
const TEXT_MUTED = "rgba(246,239,227,0.62)";
const HAIRLINE = "rgba(246,239,227,0.16)";
const FONT_SERIF = '"Lora", "Libre Caslon Text", Georgia, serif';
const FONT_SANS = '"Inter", system-ui, sans-serif';

const CAPS_LABEL: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: ACCENT_GOLD,
  marginBottom: 12,
};

export type NudgeTopicModalProps = {
  childId: number;
  /** Active session (for logging / future use). */
  sessionId: number;
  onClose: () => void;
  onSent?: (label: string, message: string) => void;
};

export default function NudgeTopicModal({
  childId,
  sessionId: _sessionId,
  onClose,
  onSent,
}: NudgeTopicModalProps) {
  const { data, isLoading, isError } = useGetNudgeTopicsQuery();
  const [sendNudge, { isLoading: sending }] = useSendChildNudgeMutation();
  const [selected, setSelected] = useState<NudgeTopicItem | null>(null);
  const [sent, setSent] = useState(false);
  const [sentLabel, setSentLabel] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState("");
  const [offlineMsg, setOfflineMsg] = useState("");

  const topics = data?.topics ?? [];

  const isOfflineError = (msg: string) =>
    msg.toLowerCase().includes("offline");

  const handleSend = async () => {
    if (!selected || sending) return;
    setError("");
    setOfflineMsg("");
    try {
      const res = await sendNudge({
        childId,
        topicId: selected.id,
      }).unwrap();
      if (!res.ok) {
        const msg = res.message || "Could not send nudge right now.";
        if (isOfflineError(msg)) {
          setOfflineMsg(msg);
        } else {
          setError(msg);
        }
        return;
      }
      setSentLabel(res.topic_label || selected.label);
      setSentMessage(res.message || "Curious Buddy will steer toward this topic at the next natural moment.");
      setSent(true);
      onSent?.(res.topic_label || selected.label, res.message);
    } catch (e) {
      const msg =
        e && typeof e === "object" && "data" in e
          ? String((e as { data?: { detail?: string } }).data?.detail ?? "")
          : "";
      setError(msg || "Failed to send instruction. Try again.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(63,77,81,0.85)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 999,
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: SCREEN_BG,
          borderRadius: "22px 22px 0 0",
          padding: "24px 22px 44px",
          border: `1px solid ${HAIRLINE}`,
          borderBottom: "none",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: HAIRLINE,
            borderRadius: 99,
            margin: "0 auto 22px",
          }}
        />

        {!sent ? (
          <>
            <p style={CAPS_LABEL}>Nudge Topic</p>
            <p
              style={{
                color: TEXT_PRIMARY,
                fontWeight: 700,
                fontSize: 17,
                marginBottom: 6,
                fontFamily: FONT_SERIF,
              }}
            >
              Guide the conversation
            </p>
            <p
              style={{
                color: TEXT_MUTED,
                fontSize: 13,
                marginBottom: 20,
                lineHeight: 1.5,
                fontFamily: FONT_SANS,
              }}
            >
              Choose a topic for Curious Buddy to naturally steer towards:
            </p>

            {isLoading ? (
              <p style={{ color: TEXT_MUTED, fontSize: 13 }}>Loading topics…</p>
            ) : isError || topics.length === 0 ? (
              <p style={{ color: TEXT_MUTED, fontSize: 13 }}>
                No nudge topics available. Add them in admin.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                {topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    style={{
                      padding: "9px 17px",
                      borderRadius: 99,
                      border: `1.5px solid ${
                        selected?.id === t.id ? ACCENT_GOLD : HAIRLINE
                      }`,
                      background:
                        selected?.id === t.id
                          ? "rgba(240,160,67,0.15)"
                          : "transparent",
                      color: selected?.id === t.id ? ACCENT_GOLD : TEXT_MUTED,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {offlineMsg ? (
              <div
                style={{
                  background: "rgba(240,160,67,0.13)",
                  border: `1.5px solid rgba(240,160,67,0.45)`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>📡</span>
                  <p
                    style={{
                      color: ACCENT_GOLD,
                      fontSize: 13,
                      lineHeight: 1.55,
                      fontFamily: FONT_SANS,
                      margin: 0,
                    }}
                  >
                    {offlineMsg}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    alignSelf: "flex-end",
                    padding: "8px 20px",
                    borderRadius: 8,
                    background: "rgba(240,160,67,0.18)",
                    color: ACCENT_GOLD,
                    border: `1px solid rgba(240,160,67,0.4)`,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    fontFamily: FONT_SANS,
                  }}
                >
                  Got it
                </button>
              </div>
            ) : null}

            {error ? (
              <p
                style={{
                  color: ACCENT_TERRA,
                  fontSize: 13,
                  marginBottom: 12,
                  fontFamily: FONT_SANS,
                }}
              >
                {error}
              </p>
            ) : null}

            {!offlineMsg && (
              <button
                type="button"
                disabled={!selected || sending || topics.length === 0}
                onClick={handleSend}
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 12,
                  background: selected ? ACCENT_GOLD : "rgba(247,242,235,0.08)",
                  color: selected ? CARD_BG : TEXT_MUTED,
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  cursor: selected && !sending ? "pointer" : "default",
                  fontFamily: FONT_SERIF,
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? "Sending…" : "Send Instruction"}
              </button>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>✦</div>
            <p
              style={{
                color: ACCENT_GOLD,
                fontWeight: 700,
                fontSize: 17,
                margin: "0 0 6px",
                fontFamily: FONT_SERIF,
              }}
            >
              Nudged to {sentLabel}
            </p>
            <p
              style={{
                color: TEXT_MUTED,
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: FONT_SANS,
              }}
            >
              {sentMessage}
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: 22,
                padding: "11px 32px",
                borderRadius: 10,
                background: "rgba(246,239,227,0.08)",
                color: TEXT_PRIMARY,
                border: `1px solid ${HAIRLINE}`,
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: FONT_SERIF,
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
