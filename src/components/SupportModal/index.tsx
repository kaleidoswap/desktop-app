import { openUrl } from '@tauri-apps/plugin-opener'
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Github,
  ExternalLink,
  X,
  ArrowRight,
  FileText,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SupportModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SupportButtonProps {
  onClick: () => void
}

interface CommonIssue {
  title: string
  description: string
  solutions: string[]
}

export const SupportModal = ({ isOpen, onClose }: SupportModalProps) => {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState('main')
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null)

  if (!isOpen) return null

  const openExternalLink = (url: string) => {
    openUrl(url)
    // Keep the modal open for potential further exploration
  }

  // Common issues for the troubleshooting section
  const COMMON_ISSUES: CommonIssue[] = [
    {
      description: t('supportModal.connectionIssues.description'),
      solutions: [
        t('supportModal.connectionIssues.solution1'),
        t('supportModal.connectionIssues.solution2'),
        t('supportModal.connectionIssues.solution3'),
        t('supportModal.connectionIssues.solution4'),
      ],
      title: t('supportModal.connectionIssues.title'),
    },
    {
      description: t('supportModal.channelCreationFailures.description'),
      solutions: [
        t('supportModal.channelCreationFailures.solution1'),
        t('supportModal.channelCreationFailures.solution2'),
        t('supportModal.channelCreationFailures.solution3'),
        t('supportModal.channelCreationFailures.solution4'),
      ],
      title: t('supportModal.channelCreationFailures.title'),
    },
    {
      description: t('supportModal.paymentFailures.description'),
      solutions: [
        t('supportModal.paymentFailures.solution1'),
        t('supportModal.paymentFailures.solution2'),
        t('supportModal.paymentFailures.solution3'),
      ],
      title: t('supportModal.paymentFailures.title'),
    },
  ]

  const toggleIssue = (index: number) => {
    if (expandedIssue === index) {
      setExpandedIssue(null)
    } else {
      setExpandedIssue(index)
    }
  }

  const goBack = () => {
    setActiveSection('main')
    setExpandedIssue(null)
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-surface-base border border-divider/20 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-divider/10">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-white">
              {activeSection === 'main'
                ? t('supportModal.title')
                : activeSection === 'troubleshoot'
                  ? t('supportModal.troubleshooting')
                  : t('supportModal.title')}
            </h2>
          </div>
          <button
            aria-label="Close modal"
            className="p-2 text-content-secondary hover:text-white hover:bg-surface-overlay/70 rounded-lg transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {activeSection === 'main' && (
            <div className="space-y-6">
              <p className="text-content-secondary">{t('supportModal.intro')}</p>

              {/* Support Options */}
              <div className="grid gap-4">
                {/* Documentation */}
                <div
                  className="bg-surface-overlay/50 border border-divider/20 rounded-xl p-4 cursor-pointer hover:bg-surface-elevated/30 transition-all duration-200 hover:-translate-y-1 group"
                  onClick={() =>
                    openExternalLink('https://docs.kaleidoswap.com')
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-surface-elevated/80 rounded-lg text-primary">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {t('supportModal.documentation')}
                      </h3>
                      <p className="text-sm text-content-secondary">
                        {t('supportModal.documentationDesc')}
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* FAQ */}
                <div
                  className="bg-surface-overlay/50 border border-divider/20 rounded-xl p-4 cursor-pointer hover:bg-surface-elevated/30 transition-all duration-200 hover:-translate-y-1 group"
                  onClick={() =>
                    openExternalLink(
                      'https://docs.kaleidoswap.com/desktop-app/faq'
                    )
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-surface-elevated/80 rounded-lg text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {t('supportModal.faq')}
                      </h3>
                      <p className="text-sm text-content-secondary">
                        {t('supportModal.faqDesc')}
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Telegram */}
                <div
                  className="bg-surface-overlay/50 border border-divider/20 rounded-xl p-4 cursor-pointer hover:bg-surface-elevated/30 transition-all duration-200 hover:-translate-y-1 group"
                  onClick={() => openExternalLink('https://t.me/kaleidoswap')}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-surface-elevated/80 rounded-lg text-primary">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {t('supportModal.telegramGroup')}
                      </h3>
                      <p className="text-sm text-content-secondary">
                        {t('supportModal.telegramGroupDesc')}
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* GitHub */}
                <div
                  className="bg-surface-overlay/50 border border-divider/20 rounded-xl p-4 cursor-pointer hover:bg-surface-elevated/30 transition-all duration-200 hover:-translate-y-1 group"
                  onClick={() =>
                    openExternalLink(
                      'https://github.com/kaleidoswap/desktop-app'
                    )
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-surface-elevated/80 rounded-lg text-primary">
                      <Github className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {t('supportModal.githubIssues')}
                      </h3>
                      <p className="text-sm text-content-secondary">
                        {t('supportModal.githubIssuesDesc')}
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Troubleshooting */}
                <div
                  className="bg-gradient-to-br from-cyan/10 to-transparent border-2 border-primary/20 rounded-xl p-4 cursor-pointer hover:bg-primary/5 transition-all duration-200 hover:-translate-y-1 group"
                  onClick={() => setActiveSection('troubleshoot')}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-surface-elevated/80 rounded-lg text-primary">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {t('supportModal.commonIssues')}
                      </h3>
                      <p className="text-sm text-content-secondary">
                        {t('supportModal.commonIssuesDesc')}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'troubleshoot' && (
            <div className="space-y-5">
              <button
                className="flex items-center gap-2 text-primary hover:underline mb-4"
                onClick={goBack}
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span>{t('supportModal.backToSupport')}</span>
              </button>

              <p className="text-content-secondary mb-4">
                {t('supportModal.troubleshootIntro')}
              </p>

              <div className="space-y-4">
                {COMMON_ISSUES.map((issue, index) => (
                  <div
                    className="bg-surface-overlay/50 rounded-xl border border-divider/20 overflow-hidden"
                    key={index}
                  >
                    <div
                      className="p-5 flex justify-between items-center cursor-pointer hover:bg-surface-elevated/30 transition-colors"
                      onClick={() => toggleIssue(index)}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {issue.title}
                          </h3>
                          <p className="text-sm text-content-secondary">
                            {issue.description}
                          </p>
                        </div>
                      </div>
                      <button className="p-1 text-content-secondary hover:text-white transition-colors">
                        {expandedIssue === index ? (
                          <X className="w-5 h-5" />
                        ) : (
                          <span className="text-primary">
                            {t('supportModal.viewSolutions')}
                          </span>
                        )}
                      </button>
                    </div>

                    {expandedIssue === index && (
                      <div className="px-5 pb-5 pt-2 border-t border-divider/20 bg-surface-base/30">
                        <h4 className="text-sm font-semibold text-primary mb-3">
                          {t('supportModal.solutions')}
                        </h4>
                        <ul className="space-y-2">
                          {issue.solutions.map((solution, sIndex) => (
                            <li
                              className="flex items-start gap-2 text-content-secondary"
                              key={sIndex}
                            >
                              <CheckCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                              <span>{solution}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-5 bg-surface-overlay/30 rounded-xl mt-4 border border-divider/20">
                <p className="text-content-secondary mb-4">
                  {t('supportModal.stillHavingIssues')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="px-4 py-2 bg-surface-elevated text-primary rounded-lg hover:bg-surface-elevated/80 transition-colors flex items-center gap-2 text-sm"
                    onClick={() => openExternalLink('https://t.me/kaleidoswap')}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {t('supportModal.telegramSupport')}
                  </button>
                  <button
                    className="px-4 py-2 bg-surface-elevated text-primary rounded-lg hover:bg-surface-elevated/80 transition-colors flex items-center gap-2 text-sm"
                    onClick={() =>
                      openExternalLink(
                        'https://github.com/kaleidoswap/desktop-app/issues'
                      )
                    }
                  >
                    <Github className="w-4 h-4" />
                    {t('supportModal.reportIssue')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-divider/10 bg-surface-base">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="text-sm text-content-secondary">
              {t('supportModal.needMoreHelp')}{' '}
              <button
                className="text-primary hover:underline"
                onClick={() => {
                  openUrl('mailto:support@kaleidoswap.com')
                }}
              >
                support@kaleidoswap.com
              </button>
            </div>
            <div className="flex gap-3">
              <button
                className="px-4 py-2 bg-surface-elevated/60 text-white rounded-lg hover:bg-surface-elevated/80 transition-colors"
                onClick={onClose}
              >
                {t('supportModal.close')}
              </button>
              {activeSection !== 'main' && (
                <button
                  className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                  onClick={goBack}
                >
                  {t('supportModal.back')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const SupportButton = ({ onClick }: SupportButtonProps) => {
  return (
    <button
      aria-label="Get Support"
      className="flex items-center gap-2 px-4 py-2 bg-surface-overlay hover:bg-surface-elevated text-white rounded-lg transition-colors"
      onClick={onClick}
    >
      <HelpCircle className="w-5 h-5 text-primary" />
      <span>Support</span>
    </button>
  )
}
