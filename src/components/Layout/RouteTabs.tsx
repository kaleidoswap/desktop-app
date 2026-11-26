import { buttonVariants, cn, Icon, type IconName } from 'kaleido-ui'
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
      className="mb-4 flex min-w-0 gap-1 overflow-x-auto border-b border-divider/30 p-1"
      ref={nav}
    >
      {tabs.map((tab) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              buttonVariants({
                size: 'sm',
                variant: isActive ? 'ghost' : 'quiet',
              }),
              'shrink-0',
              isActive && 'bg-primary/10 text-brand'
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
