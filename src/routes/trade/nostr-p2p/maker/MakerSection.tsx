import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Alert } from '../../../../components/ui'
import { cx, EmptyState, Panel, Pill } from '../market/ui'

import { ChooseMode } from './ChooseMode'
import { LiveScreen } from './LiveScreen'
import { makerAvailableOn, makerBackend, type MakerView } from './makerApi'
import { errorText, useMk } from './parts'
import { PolicyScreen } from './PolicyScreen'
import { StrategyScreen } from './StrategyScreen'

type Screen = 'mode' | 'strategy' | 'policy' | 'live'

/** Whether the maker is set up far enough to configure: a mode, and for hosted its pairing. */
export const isPaired = (v: MakerView | null): boolean =>
  !!v &&
  (v.mode === 'self_hosted'
    ? !v.endpoint || v.has_token
    : v.mode === 'hosted' && !!v.endpoint && v.has_token)

/**
 * The Maker section of the P2P area: become a maker, set the strategy, sign the policy (hosted),
 * watch it live. Mutinynet only; it does not render on any other network.
 */
export function MakerSection({
  networkKey,
  network,
}: {
  networkKey: string
  network: string
}) {
  const tm = useMk()
  const backend = useMemo(() => makerBackend(networkKey), [networkKey])
  const [view, setView] = useState<MakerView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen | null>(null)
  const autoStarted = useRef(false)

  const reload = useCallback(async () => {
    try {
      setView(await backend.view())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
  }, [backend])

  useEffect(() => {
    if (!makerAvailableOn(network)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    const id = setInterval(() => void reload(), 5_000)
    return () => clearInterval(id)
  }, [reload, network])

  // first visit: where the user left off
  useEffect(() => {
    if (!view || screen) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScreen(isPaired(view) ? 'live' : 'mode')
  }, [view, screen])

  // the signer the user left on comes back on with the app
  useEffect(() => {
    if (
      !view ||
      autoStarted.current ||
      view.mode !== 'hosted' ||
      !view.signer_enabled ||
      view.signer.running
    )
      return
    autoStarted.current = true
    backend
      .startSigner()
      .then(setView)
      .catch(() => void reload())
  }, [view, backend, reload])

  if (!makerAvailableOn(network)) {
    return <Alert variant="info">{tm('section.notHere')}</Alert>
  }
  if (!view) {
    return (
      <Panel>
        <EmptyState
          description={error ?? undefined}
          title={error ? tm('section.failed') : tm('common.loading')}
        />
      </Panel>
    )
  }

  const paired = isPaired(view)
  const hosted = view.mode === 'hosted'
  const steps: { id: Screen; label: string; enabled: boolean }[] = [
    { enabled: true, id: 'mode', label: tm('section.stepMode') },
    { enabled: paired, id: 'strategy', label: tm('section.stepStrategy') },
    ...(hosted
      ? [
          {
            enabled: paired,
            id: 'policy' as Screen,
            label: tm('section.stepPolicy'),
          },
        ]
      : []),
    { enabled: paired, id: 'live', label: tm('section.stepLive') },
  ]
  const current = screen ?? 'mode'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-content-primary">
            {tm('section.title')}
          </h2>
          <p className="text-caption text-content-secondary">
            {tm('section.subtitle')}
          </p>
        </div>
        <Pill className="ml-auto" tone="warning">
          {tm('section.pilot')}
        </Pill>
      </div>
      <nav
        aria-label={tm('section.title')}
        className="flex flex-wrap gap-1 rounded-xl bg-surface-inset p-1"
      >
        {steps.map((s, i) => (
          <button
            aria-current={current === s.id ? 'step' : undefined}
            className={cx(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              current === s.id
                ? 'bg-surface-raised text-content-primary'
                : 'text-content-tertiary hover:text-content-secondary'
            )}
            disabled={!s.enabled}
            key={s.id}
            onClick={() => setScreen(s.id)}
            type="button"
          >
            <span
              className={cx(
                'flex h-5 w-5 items-center justify-center rounded-full text-tiny',
                current === s.id
                  ? 'bg-primary text-text-on-accent'
                  : 'bg-surface-raised'
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>
      {current === 'mode' && (
        <ChooseMode
          backend={backend}
          onNext={() => setScreen('strategy')}
          onView={setView}
          view={view}
        />
      )}
      {current === 'strategy' && paired && (
        <StrategyScreen
          backend={backend}
          onNext={() => setScreen('policy')}
          view={view}
        />
      )}
      {current === 'policy' && paired && hosted && (
        <PolicyScreen
          backend={backend}
          onNext={() => setScreen('live')}
          onView={setView}
          view={view}
        />
      )}
      {current === 'live' && paired && (
        <LiveScreen backend={backend} onView={setView} view={view} />
      )}
    </div>
  )
}
