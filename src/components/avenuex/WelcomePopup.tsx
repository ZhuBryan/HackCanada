"use client";

import { useState } from "react";

interface WelcomePopupProps {
  onDismiss: () => void;
}

export default function WelcomePopup({ onDismiss }: WelcomePopupProps) {
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-[8000] flex items-center justify-center transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(28, 25, 23, 0.3)", backdropFilter: "blur(4px)" }}
        onClick={handleClose}
      />

      {/* Popup card */}
      <div
        className={`relative z-10 max-w-md w-full mx-4 rounded-2xl p-8 shadow-xl transition-all duration-300 ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100 fade-pop"
        }`}
        style={{
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--line)",
        }}
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
          style={{ backgroundColor: "var(--brand-soft)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
              fill="var(--brand)"
            />
            <path
              d="M12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z"
              fill="var(--brand)"
            />
            <path
              d="M12 7C10.3431 7 9 8.34315 9 10H11C11 9.44772 11.4477 9 12 9C12.5523 9 13 9.44772 13 10C13 10.5523 12.5523 11 12 11C11.4477 11 11 11.4477 11 12V14H13V12.8284C14.1652 12.4175 15 11.3062 15 10C15 8.34315 13.6569 7 12 7Z"
              fill="var(--brand)"
            />
          </svg>
        </div>

        {/* Title */}
        <h2
          className="font-display text-2xl font-bold mb-3"
          style={{ color: "var(--foreground)" }}
        >
          Welcome to Canopi
        </h2>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <Feature
            icon="💬"
            title="AI Chat Assistant"
            desc="Ask about neighbourhoods, commute times, or what matters to you — our chatbot finds listings that fit your life."
          />
          <Feature
            icon="🗺️"
            title="Interactive Map"
            desc="Explore properties on the map with real-time scoring based on your priorities like transit, safety, and walkability."
          />
          <Feature
            icon="📊"
            title="Preference Radar"
            desc="Drag the spider chart to set what matters most. Every listing is scored against your personal priorities."
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleClose}
          className="w-full py-3 px-4 rounded-xl font-medium text-white text-sm transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
          style={{ backgroundColor: "var(--brand)" }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-lg mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
          {title}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {desc}
        </p>
      </div>
    </div>
  );
}
