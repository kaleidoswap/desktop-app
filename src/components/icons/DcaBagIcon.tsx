import dcaBagIcon from '../../assets/dca-bag-icon.png'

interface DcaBagIconProps {
  className?: string
}

export const DcaBagIcon = ({ className = 'w-5 h-5' }: DcaBagIconProps) => {
  return (
    <span
      aria-hidden="true"
      className={`${className} relative inline-block shrink-0 align-middle`}
    >
      <span
        className="absolute inset-0 bg-current drop-shadow-[0_0_10px_rgba(255,255,255,0.14)]"
        style={{
          WebkitMaskImage: `url(${dcaBagIcon})`,
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          maskImage: `url(${dcaBagIcon})`,
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
        }}
      />
    </span>
  )
}
