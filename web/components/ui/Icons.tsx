import type { SVGProps } from "react";

// One stroke-based icon set at a consistent 1.6 weight. Deliberately not an
// icon library: this product needs about thirty icons, not four thousand.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h3v-5a2 2 0 0 1 4 0v5h3a1.5 1.5 0 0 0 1.5-1.5V9.5" />
  </svg>
);

export const CompassIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.8 9.2 13.4 13.4 9.2 14.8l1.4-4.2z" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.3-4.3" />
  </svg>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7.2-4.4-9.2-8.6C1.2 8 2.9 4.8 6.3 4.4c2-.2 4 .9 5.7 2.7 1.7-1.8 3.6-2.9 5.7-2.7 3.4.4 5.1 3.6 3.5 7C19.2 15.6 12 20 12 20z" />
  </svg>
);

export const MessageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20.5 11.6a8 8 0 0 1-11.6 7.1L4 20l1.3-4.3A8 8 0 1 1 20.5 11.6z" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 14.2A8.4 8.4 0 1 1 9.8 4 6.7 6.7 0 0 0 20 14.2z" />
  </svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H20v15.2H6.2A2.2 2.2 0 0 0 4 20.4z" />
    <path d="M4 5.2v14.2A2.2 2.2 0 0 0 6.2 21.6H20" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.2" r="3.6" />
    <path d="M5 20c.8-3.5 3.7-5.6 7-5.6S18.2 16.5 19 20" />
  </svg>
);

export const UsersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.7-3 3-4.8 6-4.8s5.3 1.8 6 4.8" />
    <path d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1M18 15.2c2 .7 3.3 2.2 3.8 4.3" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3.8 1.4 5.2 1.9 6.2H4.6c.5-1 1.9-2.4 1.9-6.2z" />
    <path d="M10.2 19.4a2 2 0 0 0 3.6 0" />
  </svg>
);

export const ArrowUpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 19.5V5.5" />
    <path d="M6.5 11 12 5.5 17.5 11" />
  </svg>
);

export const ArrowDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4.5v14" />
    <path d="M6.5 13 12 18.5 18.5 13" />
  </svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.5 12h15" />
    <path d="M13.5 6l6 6-6 6" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5.5 9 12 15.5 18.5 9" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12.5 9.5 17 19 7.5" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SparkleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9z" />
    <path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5 17.8 20.2 15.5 19.5 17.8 18.8z" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20.5 3.5 10.5 13.5" />
    <path d="M20.5 3.5 14.2 20.5l-3.7-7-7-3.7z" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.2 12a7.2 7.2 0 0 0-.1-1.2l1.9-1.4-1.9-3.3-2.2.9a7 7 0 0 0-2-1.2L14.4 3.5h-3.8l-.5 2.3a7 7 0 0 0-2 1.2l-2.2-.9L4 9.4l1.9 1.4a7.2 7.2 0 0 0 0 2.4L4 14.6l1.9 3.3 2.2-.9a7 7 0 0 0 2 1.2l.5 2.3h3.8l.5-2.3a7 7 0 0 0 2-1.2l2.2.9 1.9-3.3-1.9-1.4c.07-.4.1-.8.1-1.2z" />
  </svg>
);

export const LogOutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9.5 20.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4" />
    <path d="M16 16.5 20.5 12 16 7.5" />
    <path d="M20.5 12H9.5" />
  </svg>
);

export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 15.5 16 11a2 2 0 0 0-2.8 0L4.5 19.5" />
  </svg>
);

export const LinkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M11 6.8 12.3 5.5a3.7 3.7 0 0 1 5.2 5.2l-1.3 1.3" />
    <path d="M13 17.2l-1.3 1.3a3.7 3.7 0 0 1-5.2-5.2l1.3-1.3" />
  </svg>
);

export const HelpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.2.9-1.2 1.8" />
    <circle cx="12" cy="16.8" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

export const CoinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.8v8.4M9.6 10c0-1.1 1.1-1.8 2.4-1.8s2.4.6 2.4 1.6c0 2.2-4.8 1.1-4.8 3.2 0 1 1.1 1.6 2.4 1.6s2.4-.7 2.4-1.8" />
  </svg>
);

export const FlameIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3s4.6 4.2 4.6 8.8a4.6 4.6 0 0 1-9.2 0c0-1.4.6-2.3 1.4-3.2-.2 1.8.7 2.3 1.4 1.8.3-1.8.4-3.6 1.8-5.4z" />
  </svg>
);

export const TimerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.6M9.5 2.5h5" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.2 19 6v5.6c0 4.2-2.9 7.5-7 9.2-4.1-1.7-7-5-7-9.2V6z" />
  </svg>
);

export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 16V4.5" />
    <path d="M7.5 9 12 4.5 16.5 9" />
    <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </svg>
);

export const DownloadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11.5" />
    <path d="M7.5 11 12 15.5 16.5 11" />
    <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);

export const GlobeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z" />
  </svg>
);

export const MoreIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const FlagIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5.5 21V4M5.5 5h9.8l-1.2 3 1.2 3H5.5" />
  </svg>
);

export const ReplyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M4.5 11.5h9a6 6 0 0 1 6 6v1.5" />
  </svg>
);

export const GithubIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 1.8a10.2 10.2 0 0 0-3.2 19.9c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.2-1.5-1.2-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.1-4.7-5a4 4 0 0 1 1.1-2.8c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1.1a9.6 9.6 0 0 1 5.1 0c1.9-1.4 2.8-1.1 2.8-1.1.6 1.4.2 2.4.1 2.7a4 4 0 0 1 1.1 2.8c0 4-2.4 4.8-4.7 5 .4.3.7 1 .7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 12 1.8z" />
  </svg>
);

export const MenuIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}>
    <path d="M6.5 4.5h11a1 1 0 0 1 1 1v14.2l-6.5-4.2-6.5 4.2V5.5a1 1 0 0 1 1-1z" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20.5V3.5M4 20.5h16" />
    <path d="M8 17v-5M12.5 17V7.5M17 17v-8" />
  </svg>
);

export const SpinnerIcon = ({ size = 20, className = "", ...rest }: IconProps) => (
  <svg {...base({ size, ...rest })} className={`animate-spin ${className}`}>
    <circle cx="12" cy="12" r="8.5" opacity="0.22" />
    <path d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5" />
  </svg>
);
