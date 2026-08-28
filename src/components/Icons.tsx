import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    >
      {children}
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 14h4l2 2h4l2-2h4" stroke="currentColor" strokeWidth="1.7" />
    </IconBase>
  );
}

export function BoardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="14" rx="1" stroke="currentColor" strokeWidth="1.7" width="5" x="3" y="5" />
      <rect height="9" rx="1" stroke="currentColor" strokeWidth="1.7" width="5" x="10" y="5" />
      <rect height="12" rx="1" stroke="currentColor" strokeWidth="1.7" width="5" x="17" y="5" />
    </IconBase>
  );
}

export function ChainIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.5 14.5 14.5 9.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 16.5 5 19a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" stroke="currentColor" strokeWidth="1.7" transform="translate(2 -2)" />
      <path d="m16.5 7.5 2.5-2.5a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" stroke="currentColor" strokeWidth="1.7" transform="translate(-2 2)" />
    </IconBase>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.7" />
    </IconBase>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}
