import { cn, Icon, type IconName } from 'kaleido-ui'
import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

export interface RouteTab {
  to: string
  icon: IconName
  labelKey: string
}

export function RouteTabs({
  label,
  tabs,
}: {
  label: string
  tabs: readonly RouteTab[]
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const nav = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const strip = nav.current
    if (strip && strip.scrollWidth > strip.clientWidth) {
      strip
        .querySelector<HTMLElement>('[aria-current="page"]')
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
  }, [pathname, t])

  return (
    <nav
      aria-label={label}
      className="mb-4 flex min-w-0 gap-1 overflow-x-auto border-b border-divider/30"
      ref={nav}
    >
      {tabs.map((tab) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-brand font-semibold'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            )
          }
          end
          key={tab.to}
          to={tab.to}
        >
          <Icon name={tab.icon} size="sm" />
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
