type SvgProps = React.SVGProps<SVGSVGElement>;

export function ArrowDropUp(props: SvgProps) {
  return (
    <svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4 2.5L6.5 6h-5L4 2.5z" fill="currentColor" />
    </svg>
  );
}

export function ArrowDropDown(props: SvgProps) {
  return (
    <svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4 5.5L1.5 2h5L4 5.5z" fill="currentColor" />
    </svg>
  );
}

export function Instagram(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
