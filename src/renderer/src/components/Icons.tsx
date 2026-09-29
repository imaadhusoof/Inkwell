import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 18, children, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const CursorIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M5 3l14 7.5-6.2 1.6L10.5 19z" />
  </Icon>
)
export const HandIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5V4a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V13m0-5a1.5 1.5 0 013 0v6.5A7.5 7.5 0 0112.5 22h-.9a6.6 6.6 0 01-5.4-2.8L3.7 15.6a1.6 1.6 0 012.4-2.1L8 15.4" />
  </Icon>
)
export const PenIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M16.9 3.6a2.1 2.1 0 013 3L8 18.5 3.5 20l1.5-4.5z" />
    <path d="M14.5 6l3 3" />
  </Icon>
)
export const HighlighterIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M9 11l-5 5v3h7l5-5" />
    <path d="M20.5 7.5l-4-4a1.4 1.4 0 00-2 0L8 10l6 6 6.5-6.5a1.4 1.4 0 000-2z" />
  </Icon>
)
export const EraserIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M7 21l-4.3-4.3a1 1 0 010-1.4L13.3 4.7a1 1 0 011.4 0l5.6 5.6a1 1 0 010 1.4L11 21z" />
    <path d="M22 21H7M5.5 12.5l7 7" />
  </Icon>
)
export const UndoIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </Icon>
)
export const RedoIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
  </Icon>
)
export const NotesIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Icon>
)
export const PagesIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
)
export const ExportIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M12 15V3M7 8l5-5 5 5" />
    <path d="M20 15v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4" />
  </Icon>
)
export const PlusIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const MinusIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
)
export const CloseIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
export const HomeIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9v11h14V9" />
  </Icon>
)
export const SunIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)
export const MoonIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z" />
  </Icon>
)
export const MonitorIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
)
export const FitWidthIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
  </Icon>
)
export const FileIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
)
export const TrashIcon = (p: IconProps): React.JSX.Element => (
  <Icon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
)
export const InkwellLogo = ({ size = 22 }: { size?: number }): React.JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <path
      d="M20.8 6.6a2.4 2.4 0 013.4 3.4L13 21.2l-4.6 1.4 1.4-4.6z"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M8 26c3-1.6 6.5-1.6 9.5 0s5.5 1.2 7-.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
