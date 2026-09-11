import type { SVGProps } from "react";

// One small, stroke-based icon set — rounded caps/joins to match the app's
// soft, hand-drawn-adjacent visual language. Deliberately not an icon library:
// this project needs about twenty icons, not four thousand.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps) {
  const { size = 22, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9a1 1 0 0 0 1 1h4v-5.5a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1V20h4a1 1 0 0 0 1-1v-9" />
  </svg>
);

export const CompassIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-2 6-6 2 2-6z" />
  </svg>
);

export const HeartIcon = (p: IconProps & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return (
    <svg {...base(rest)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.5s-7.5-4.6-9.8-9.1C.6 8 2.3 4.5 6 4c2.2-.3 4.2.9 6 2.8C13.8 4.9 15.8 3.7 18 4c3.7.5 5.4 4 3.8 7.4C19.5 15.9 12 20.5 12 20.5z" />
    </svg>
  );
};

export const MessageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12a8 8 0 1 1-3.4-6.5" />
    <path d="M21 4l-9.6 9.6" />
    <path d="M3 12a8 8 0 0 0 8 8c1 0 2-.2 3-.6l4.6 1-1-4.4" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5z" />
  </svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z" />
    <path d="M4 5.5V19a2.5 2.5 0 0 0 2.5 2.5H20" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20c1-3.6 4-5.6 7.2-5.6s6.2 2 7.2 5.6" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const ArrowUpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 19V6" />
    <path d="M6 11l6-6 6 6" />
  </svg>
);

export const ArrowDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v13" />
    <path d="M6 13l6 6 6-6" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const StarIcon = (p: IconProps & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return (
    <svg {...base(rest)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 3.5l2.6 5.4 5.9.7-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.7z" />
    </svg>
  );
};

export const SparkleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 3L10.5 13.5" />
    <path d="M21 3l-6.5 18-4-8-8-4z" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const MoreIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.5a7 7 0 0 0-2 1.2l-2.3-.9-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.5a7 7 0 0 0 2-1.2l2.3.9 2-3.5-2-1.5c.07-.4.1-.8.1-1.2z" />
  </svg>
);

export const FlameIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0c0-1.5.7-2.5 1.5-3.5-.2 2 .8 2.5 1.5 2 .3-2 .5-4 2-6z" />
  </svg>
);

export const CoinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v9M9.3 9.5c0-1.2 1.2-2 2.7-2s2.7.7 2.7 1.8c0 2.4-5.4 1.2-5.4 3.6 0 1.1 1.2 1.8 2.7 1.8s2.7-.8 2.7-2" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 13l4.5 4.5L19 7.5" />
  </svg>
);

export const LogOutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5.5-5.5a2 2 0 0 0-2.8 0L4 19" />
  </svg>
);

export const LinkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 15l6-6" />
    <path d="M11 6.5l1-1a3.6 3.6 0 0 1 5 5l-1 1" />
    <path d="M13 17.5l-1 1a3.6 3.6 0 0 1-5-5l1-1" />
  </svg>
);

export const HelpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9.3a2.7 2.7 0 1 1 4 2.4c-.8.5-1.3 1-1.3 2" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </svg>
);
