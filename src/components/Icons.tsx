const common = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function HomeIcon() {
  return (
    <svg {...common}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg {...common}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

export function DiagnosticsIcon() {
  return (
    <svg {...common}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  );
}

export function MemoryIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M7 7v10M11 7v10M15 7v10M5 20v-3M19 20v-3" />
    </svg>
  );
}

export function JavaIcon() {
  return (
    <svg {...common}>
      <path d="M5 10h11v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-4Z" />
      <path d="M16 11h1.5a2 2 0 0 1 0 4H16M8 3c1 1.2-1 2 0 3.5M12 3c1 1.2-1 2 0 3.5" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg {...common}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2.5h7.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V7.5Z" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.4-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  );
}

export function PaletteIcon() {
  return (
    <svg {...common}>
      <path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-1.2-1-1.4-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="15" cy="8" r="1" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg {...common}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg {...common}>
      <path d="M20 11a8 8 0 0 0-14.3-4.5M4 4v3.5h3.5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.5M20 20v-3.5h-3.5" />
    </svg>
  );
}

export function HelpIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg {...common}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M16 6a3 3 0 0 1 0 5.5M17.5 14.7c1.8.6 2.7 2 3 4.3" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...common}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
