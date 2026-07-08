export const KaleidoswapBoxIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={151}
    width={151}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g filter="url(#a)">
      <rect fill="#1A1A2E" height={143} rx={5} width={143} x={4} />
    </g>
    <g transform="translate(30, 20) scale(2.2)">
      <path
        d="M14 14.0391L14 28.0196L7.00208 21.0314L14 14.0391Z"
        fill="#8FD5EA"
      />
      <path
        d="M28 0.0542004L28 14.0348L21.0021 7.04656L28 0.0542004Z"
        fill="#FFF970"
      />
      <path
        d="M42 0.0541992L35.0021 7.04656L28 0.0541992L42 0.0541992Z"
        fill="#9365FF"
      />
      <path d="M14 0L7.00209 6.99236L0 0H14Z" fill="#9365FF" />
      <path d="M14 42.0002H0L7.00209 35.0078L14 42.0002Z" fill="#9365FF" />
      <path
        d="M28 28.0151L28 41.9999L21.0021 35.0075L28 28.0151Z"
        fill="#FFF970"
      />
      <path d="M42 42.0002H28L35.0021 35.0078L42 42.0002Z" fill="#9365FF" />
      <path
        d="M21.0021 21.027L14 28.0152L14 14.0347L21.0021 21.027Z"
        fill="#7AC3D9"
      />
      <path
        d="M35.0021 35.0075L28 41.9999L28 28.0151L35.0021 35.0075Z"
        fill="#F1EA3C"
      />
      <path
        d="M28 28.0155L14 28.0155L21.0021 21.0273L28 28.0155Z"
        fill="#FD9B99"
      />
      <path
        d="M28 28.0151L21.0021 35.0075L14 28.0151L28 28.0151Z"
        fill="#F58D8A"
      />
      <path
        d="M28 14.0347L21.0021 21.027L14 14.0347L28 14.0347Z"
        fill="#FD9B99"
      />
      <path
        d="M28 14.0346L14 14.0346L21.0021 7.04639L28 14.0346Z"
        fill="#F58D8A"
      />
      <path
        d="M35.0021 7.04656L28 14.0348L28 0.0541992L35.0021 7.04656Z"
        fill="#F1EA3C"
      />
    </g>
    <text
      fill="#FFFFFF"
      fontFamily="Satoshi"
      fontSize="14"
      fontWeight="600"
      letterSpacing="0.5"
      textAnchor="middle"
      x="75"
      y="135"
    >
      KaleidoSwap
    </text>
    <defs>
      <filter
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
        height={151}
        id="a"
        width={151}
        x={0}
        y={0}
      >
        <feFlood floodOpacity={0} result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset dy={4} />
        <feGaussianBlur stdDeviation={2} />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_418_39" />
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_418_39"
          result="shape"
        />
      </filter>
    </defs>
  </svg>
)
