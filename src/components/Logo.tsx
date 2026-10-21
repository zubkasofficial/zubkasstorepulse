type LogoProps = {
  className?: string
  height?: string
  variant?: 'default' | 'white'
}

export default function Logo({ className = '', height = 'h-8', variant = 'default' }: LogoProps) {
  const src = variant === 'white' ? '/zubkas_icon_hd_white.png' : '/zubkas-logo.png'
  return (
    <img
      src={src}
      alt="Zubkas Logo"
      className={`${height} w-auto object-contain ${className}`}
    />
  )
}
