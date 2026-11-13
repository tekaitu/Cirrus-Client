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
    <svg {...common} className="ico ico-settings">
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

export function ModsIcon() {
  return (
    <svg {...common}>
      <path d="M10 4.5a2 2 0 1 1 4 0V6h3.5A1.5 1.5 0 0 1 19 7.5V11h-1.5a2 2 0 1 0 0 4H19v3.5a1.5 1.5 0 0 1-1.5 1.5H14v-1.5a2 2 0 1 0-4 0V20H6.5A1.5 1.5 0 0 1 5 18.5V15h1.5a2 2 0 1 0 0-4H5V7.5A1.5 1.5 0 0 1 6.5 6H10V4.5Z" />
    </svg>
  );
}

export function LibraryIcon() {
  return (
    <svg {...common}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

export function CompassIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  );
}

/* Icons used inside buttons. Each has its own class so the stylesheet can give it a hover motion. */
export function StopIcon() {
  return (
    <svg {...common} className="ico ico-stop">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...common} className="ico ico-shield">
      <path d="M12 3.5 5 6.2v5.4c0 4.1 2.8 7.2 7 8.9 4.2-1.7 7-4.8 7-8.9V6.2L12 3.5Z" />
      <path d="m9.2 12.1 2.1 2.1 3.6-3.9" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg {...common} className="ico ico-key">
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H20M17 12v3M14.5 12v2" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...common} className="ico ico-plus">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...common} className="ico ico-trash">
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...common} className="ico ico-search">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg {...common} className="ico ico-download">
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg {...common} className="ico ico-chat">
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

export function PackageIcon() {
  return (
    <svg {...common} className="ico ico-package">
      <path d="m12 3.5 8 4.2v8.6l-8 4.2-8-4.2V7.7l8-4.2Z" />
      <path d="m4.5 8 7.5 4 7.5-4M12 12v8" />
    </svg>
  );
}

export function SparkIcon() {
  return (
    <svg {...common} className="ico ico-spark">
      <path d="M12 3.5 13.9 10 20.5 12 13.9 14 12 20.5 10.1 14 3.5 12 10.1 10 12 3.5Z" />
    </svg>
  );
}

export function PlayArrowIcon() {
  return (
    <svg {...common} fill="currentColor" className="ico ico-play">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function RefreshArrowIcon() {
  return (
    <svg {...common} className="ico ico-refresh">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...common} className="ico ico-check">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
