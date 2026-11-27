import { Button, Input } from 'kaleido-ui'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from '../../../components/ui'
import { NostrAvatar } from './NostrParticipants'
import { canonicalNpub } from './nostrPublicKey'
import { nostrProfiles } from './nostrProfiles'

type Profiles = Awaited<ReturnType<typeof nostrProfiles.list>>

function ProfileDialog({
  active,
  onClose,
  onSwitched,
}: {
  active: string
  onClose: () => void
  onSwitched: () => void
}) {
  const { t } = useTranslation()
  const [data, setData] = useState<Profiles>()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [forgetting, setForgetting] = useState<Profiles['profiles'][number]>()
  useEffect(() => {
    let current = true
    nostrProfiles
      .list(active)
      .then((result) => {
        if (current) setData(result)
      })
      .catch((cause) => {
        if (current) setError(String(cause))
      })
    return () => {
      current = false
    }
  }, [active])
  const change = async (target?: string) => {
    if (busy || !data?.supported) return
    setBusy(true)
    setError('')
    try {
      if (target) {
        const next = await nostrProfiles.select(active, target)
        if (next.active !== active) {
          onSwitched()
          return
        }
        setData(next)
      } else {
        const next = await nostrProfiles.create(active, draft.trim())
        setDraft('')
        setData(next)
      }
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy(false)
    }
  }
  const forget = async () => {
    if (
      !forgetting ||
      forgetting.npub === active ||
      forgetting.label === null ||
      !data?.supported ||
      busy
    )
      return
    setBusy(true)
    setError('')
    try {
      setData(await nostrProfiles.forget(active, forgetting.npub))
      setForgetting(undefined)
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active)
      setCopied(true)
    } catch (cause) {
      setError(String(cause))
    }
  }
  const selected = data?.profiles.find((profile) => profile.npub === active)
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) onClose()
      }}
      size="sm"
      title={t('p2pMarket.profiles.title')}
      viewport
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <NostrAvatar npub={active} size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-content-secondary">
              {t('p2pMarket.profiles.active')}
            </p>
            {selected && (
              <strong className="block break-words text-sm text-content-primary">
                {selected.label ?? t('p2pMarket.profiles.original')}
              </strong>
            )}
            <code className="block select-all break-all text-xs text-content-secondary">
              {active}
            </code>
            <Button
              onClick={() => void copy()}
              size="sm"
              type="button"
              variant="quiet"
            >
              {copied ? (
                <Check aria-hidden size={14} />
              ) : (
                <Copy aria-hidden size={14} />
              )}{' '}
              {t(
                copied ? 'p2pMarket.profiles.copied' : 'p2pMarket.profiles.copy'
              )}
            </Button>
          </div>
        </div>
        {data?.supported && (
          <>
            {data.profiles
              .filter((profile) => profile.npub !== active)
              .map((profile) =>
                forgetting?.npub === profile.npub ? (
                  <div
                    aria-label={t('p2pMarket.profiles.forget')}
                    className="space-y-2 rounded-xl border border-status-danger/35 p-3"
                    key={profile.npub}
                    role="group"
                  >
                    <p className="text-caption break-words">
                      {t('p2pMarket.profiles.forgetConfirm', {
                        name: profile.label,
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        disabled={busy}
                        onClick={() => setForgetting(undefined)}
                        size="sm"
                        type="button"
                        variant="surface"
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => void forget()}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        {t('p2pMarket.profiles.forget')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2" key={profile.npub}>
                    <NostrAvatar npub={profile.npub} size={32} />
                    <div className="min-w-0 flex-1">
                      <strong className="block break-words text-sm">
                        {profile.label ?? t('p2pMarket.profiles.original')}
                      </strong>
                      <code
                        className="block truncate text-xs text-content-secondary"
                        title={profile.npub}
                      >
                        {profile.npub}
                      </code>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() => void change(profile.npub)}
                      size="sm"
                      type="button"
                      variant="surface"
                    >
                      {t('p2pMarket.profiles.switch')}
                    </Button>
                    {profile.label !== null && (
                      <Button
                        aria-label={t('p2pMarket.profiles.forget')}
                        disabled={busy}
                        onClick={() => {
                          setForgetting(profile)
                          setError('')
                        }}
                        size="sm"
                        type="button"
                        variant="quiet"
                      >
                        <Trash2 aria-hidden size={15} />
                      </Button>
                    )}
                  </div>
                )
              )}
            <form
              className="flex flex-col gap-2 border-t border-divider/20 pt-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (draft.trim()) void change()
              }}
            >
              <label
                className="text-caption font-medium"
                htmlFor="nostr-profile-name"
              >
                {t('p2pMarket.profiles.label')}
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-32 flex-1"
                  disabled={busy}
                  id="nostr-profile-name"
                  onChange={(event) => setDraft(event.target.value)}
                  value={draft}
                />
                <Button
                  disabled={busy || !draft.trim()}
                  size="sm"
                  type="submit"
                  variant="surface"
                >
                  <Plus aria-hidden size={14} />
                  {t('p2pMarket.profiles.new')}
                </Button>
              </div>
            </form>
          </>
        )}
        {data && !data.supported && (
          <p className="text-caption text-content-secondary">
            {t('p2pMarket.profiles.unavailable')}
          </p>
        )}
        {busy && (
          <p className="text-caption text-content-secondary" role="status">
            {t('common.loading')}
          </p>
        )}
        {!data && !error && (
          <p className="text-caption text-content-secondary" role="status">
            {t('common.loading')}
          </p>
        )}
        {error && (
          <p
            className="break-words text-caption text-status-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

export function NostrProfilesMenu({
  npub,
  onSwitched,
}: {
  npub: string
  onSwitched: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const active = canonicalNpub(npub)
  if (!active) return null
  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="surface"
      >
        <NostrAvatar npub={active} size={22} />
        {t('p2pMarket.profiles.title')}
      </Button>
      {open && (
        <ProfileDialog
          active={active}
          key={active}
          onClose={() => setOpen(false)}
          onSwitched={onSwitched}
        />
      )}
    </>
  )
}
