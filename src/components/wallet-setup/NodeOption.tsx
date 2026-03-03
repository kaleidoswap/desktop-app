import React from 'react'

interface NodeOptionProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  selected?: boolean
  recommended?: boolean
}

const IconWrapper = `
  p-4 rounded-xl backdrop-blur-sm bg-opacity-20
  flex items-center justify-center
  transition-all duration-300
`

export const NodeOption: React.FC<NodeOptionProps> = ({
  title,
  description,
  icon,
  onClick,
  selected,
  recommended,
}) => (
  <div
    className={`relative overflow-hidden transition-all duration-300 border-2 rounded-2xl backdrop-blur-sm
    hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 w-full text-left cursor-pointer fade-in
    ${selected ? 'bg-gradient-to-br from-cyan/15 to-transparent border-cyan' : 'bg-surface-elevated/40 hover:bg-surface-elevated/60 border-divider/20'}`}
    onClick={onClick}
  >
    {recommended && (
      <div className="absolute top-0 right-0">
        {/* <div className="bg-cyan text-blue-darkest text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
          Recommended
        </div> */}
      </div>
    )}
    <div className="p-6">
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`${IconWrapper}
          ${selected ? 'bg-primary/30 text-primary scale-110' : 'bg-primary/5 text-primary/80'}`}
        >
          {React.cloneElement(icon as React.ReactElement, { strokeWidth: 2 })}
        </div>
        <h2
          className={`text-2xl font-bold ${selected ? 'text-primary' : 'text-white'}`}
        >
          {title}
        </h2>
      </div>
      <p className="text-content-secondary text-sm leading-relaxed">{description}</p>
    </div>
    {selected && (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
      </div>
    )}
  </div>
)
