/**
 * Iconos SVG inline: sin librerías externas, heredan color con currentColor
 * y tamaño con la prop `size`.
 */
type Props = { size?: number; className?: string };

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  className,
  "aria-hidden": true as const,
  focusable: "false" as const,
});

/* ------------------------------------------------------------ redes */

export function IconoInstagram({ size = 22, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconoFacebook({ size = 22, className }: Props) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M15.5 3H13a4 4 0 0 0-4 4v3H6.5v3.2H9V21h3.3v-7.8h2.6l.6-3.2h-3.2V7.4c0-.6.4-1 1-1h2.2V3Z" />
    </svg>
  );
}

export function IconoX({ size = 22, className }: Props) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M17.3 3h3.1l-6.8 7.8L21.7 21h-6.2l-4.9-6.3L4.9 21H1.8l7.3-8.3L2.1 3h6.4l4.4 5.8L17.3 3Zm-1.1 16.1h1.7L7.9 4.8H6.1l10.1 14.3Z" />
    </svg>
  );
}

export function IconoYouTube({ size = 22, className }: Props) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10.2 14.9V9.1l5.1 2.9-5.1 2.9Z" />
    </svg>
  );
}

export function IconoTikTok({ size = 22, className }: Props) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M15 3h-3v12.2a2.4 2.4 0 1 1-2-2.4V9.7A5.6 5.6 0 1 0 15 15.2V9.4A7.6 7.6 0 0 0 20 11V8a4.6 4.6 0 0 1-5-5Z" />
    </svg>
  );
}

export function IconoWhatsApp({ size = 22, className }: Props) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M12 2.2A9.7 9.7 0 0 0 3.6 16.8L2.4 21.6l4.9-1.2A9.7 9.7 0 1 0 12 2.2Zm0 17.6a7.9 7.9 0 0 1-4-1.1l-.3-.2-2.9.7.8-2.8-.2-.3A7.9 7.9 0 1 1 12 19.8Zm4.4-5.8c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5 0a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1 2.7 11.5 11.5 0 0 0 4.5 4 5.1 5.1 0 0 0 3.1.6 2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

export const iconosRed: Record<string, (p: Props) => React.JSX.Element> = {
  instagram: IconoInstagram,
  facebook: IconoFacebook,
  x: IconoX,
  youtube: IconoYouTube,
  tiktok: IconoTikTok,
  whatsapp: IconoWhatsApp,
};

/* --------------------------------------------------------------- ui */

export function IconoMenu({ size = 24, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconoCerrar({ size = 24, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconoFlecha({ size = 18, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconoBuscar({ size = 20, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconoPlay({ size = 24, className }: Props) {
  return (
    <svg {...base(size, className)} fill="currentColor">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function IconoCalendario({ size = 20, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function IconoUbicacion({ size = 20, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function IconoEnlaceExterno({ size = 16, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export function IconoEscudo({ size = 24, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3 5 5.5v6c0 4.2 2.9 8 7 9.5 4.1-1.5 7-5.3 7-9.5v-6L12 3Z" />
    </svg>
  );
}

export function IconoImagen({ size = 20, className }: Props) {
  return (
    <svg {...base(size, className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 17 4.5-4.5L13 17l3-2.8L20 18" />
    </svg>
  );
}
