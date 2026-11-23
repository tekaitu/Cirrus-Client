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

export function InfoIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.2" />
    </svg>
  );
}

export function KeyboardIcon() {
  return (
    <svg {...common}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  );
}

export function CpuIcon() {
  return (
    <svg {...common}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.8" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </svg>
  );
}

export function CubeIcon() {
  return (
    <svg {...common}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  );
}

export function RocketIcon() {
  return (
    <svg {...common}>
      <path d="M5 19c.4-2.2 1.3-3.4 2.8-4.2M14.5 6.2c2.3-1.8 4.3-2.4 5.9-2.2.2 1.6-.4 3.6-2.2 5.9l-5.6 5.6-3.7-3.7 5.6-5.6Z" />
      <path d="M8.6 13.2 5 12.4 3.5 14l3.1.9M10.8 15.4l.8 3.6-1.6 1.5-.9-3.1" />
      <circle cx="15.2" cy="8.8" r="1.1" />
    </svg>
  );
}

export function CodeIcon() {
  return (
    <svg {...common}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />
    </svg>
  );
}

export function PowerIcon() {
  return (
    <svg {...common}>
      <path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

export function ShirtIcon() {
  return (
    <svg {...common}>
      <path d="m8.5 3.5-5 2.2 1.6 4 2.4-.9V20h9V8.8l2.4.9 1.6-4-5-2.2c-.6 1.2-1.9 2-3.5 2s-2.9-.8-3.5-2Z" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg {...common}>
      <path d="M12 16V4M7 9l5-5 5 5M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg {...common}>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg {...common}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function MinimizeIcon() {
  return (
    <svg {...common}>
      <path d="M6 12.5h12" />
    </svg>
  );
}

export function MaximizeIcon() {
  return (
    <svg {...common}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg {...common}>
      <rect x="4.5" y="4.5" width="6" height="6" rx="1.2" />
      <rect x="13.5" y="4.5" width="6" height="6" rx="1.2" />
      <rect x="4.5" y="13.5" width="6" height="6" rx="1.2" />
      <rect x="13.5" y="13.5" width="6" height="6" rx="1.2" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg {...common}>
      <path d="M8.5 7h11M8.5 12h11M8.5 17h11" />
      <path d="M4.5 7h.1M4.5 12h.1M4.5 17h.1" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg {...common}>
      <path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1Z" />
    </svg>
  );
}

export function ExternalIcon() {
  return (
    <svg {...common}>
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M17 14v3.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 17.5v-9A1.5 1.5 0 0 1 6.5 7H10" />
    </svg>
  );
}

export function TerminalIcon() {
  return (
    <svg {...common}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="m7.5 10 3 2.5-3 2.5M13 15h3.5" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg {...common}>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15L6 16.5Z" />
      <path d="M10 21a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...common}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}

export function ServerIcon() {
  return (
    <svg {...common}>
      <rect x="3.5" y="4" width="17" height="6.5" rx="1.8" />
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.8" />
      <path d="M7.5 7.25h.01M7.5 16.75h.01" />
    </svg>
  );
}

/** A small grass block, used for Vanilla installs. */
export function GrassBlockIcon() {
  return (
    <svg {...common} className="ico ico-grass">
      <path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6l8-4.4Z" />
      <path d="M4 8.2 12 12l8-3.8M12 12v8.8" />
      <path d="M7.2 6.6 15 10.2" />
    </svg>
  );
}

/** A woven loader mark, so Fabric never wears Minecraft's block. */
export function FabricIcon() {
  return (
    <svg {...common} className="ico ico-fabric">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 16V8h7M8 12h5" />
      <path d="M15.5 5.5 18 8" />
    </svg>
  );
}

/** A magnifier over a block: OptiFine is about looking closer, not another Minecraft install. */
export function OptifineIcon() {
  return (
    <svg {...common} className="ico ico-optifine">
      <circle cx="11" cy="11" r="6" />
      <path d="m15.6 15.6 4 4" />
      <path d="M8.6 11.4 10.6 9l2 2.6" />
    </svg>
  );
}

export function WrenchIcon() {
  return (
    <svg {...common}>
      <path d="M14.7 6.3a3.8 3.8 0 0 1 4.8 4.8l-8.6 8.6-4.8-4.8 8.6-8.6Z" />
      <path d="m6 18 1.5 1.5" />
    </svg>
  );
}

export function CopyStackIcon() {
  return (
    <svg {...common}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </svg>
  );
}

export function UpdateIcon() {
  return (
    <svg {...common}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  );
}

export function NewsIcon() {
  return (
    <svg {...common}>
      <path d="M4 5h12v14H5.5A1.5 1.5 0 0 1 4 17.5V5Z" />
      <path d="M16 9h3a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2" />
      <path d="M7 8.5h6M7 12h6M7 15.5h4" />
    </svg>
  );
}
