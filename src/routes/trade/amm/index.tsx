import { TrendingUp, Lock, Zap, ArrowRight, Info } from 'lucide-react'

import sparkLogo from '../../../assets/spark-logo.svg'
import { Card } from '../../../components/ui'

export const Component = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-4 bg-blue-500/20 rounded-2xl">
            <img alt="Spark" className="w-12 h-12" src={sparkLogo} />
          </div>
          <TrendingUp className="w-12 h-12 text-blue-400" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">
          Spark AMM Trading
        </h1>
        <p className="text-lg text-slate-400">
          Automated Market Making powered by Spark Network
        </p>
      </div>

      {/* Coming Soon Card */}
      <Card className="mb-6 bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/40">
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-amber-500/20 rounded-full mb-6">
            <Lock className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Coming Soon</h2>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            AMM trading functionality is currently in development. This feature
            will enable automated market making for Spark assets with instant
            liquidity and competitive rates.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500 rounded-full text-sm text-blue-400">
            <Info className="w-4 h-4" />
            <span>Expected Release: Q2 2025</span>
          </div>
        </div>
      </Card>

      {/* Features Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6 bg-slate-800/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Instant Liquidity
              </h3>
              <p className="text-sm text-slate-400">
                Trade Spark assets instantly with automated market making
                algorithms providing continuous liquidity.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Competitive Rates
              </h3>
              <p className="text-sm text-slate-400">
                Get the best exchange rates powered by Spark's efficient
                off-chain transfers and low fees.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <ArrowRight className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Simple Interface
              </h3>
              <p className="text-sm text-slate-400">
                Intuitive trading interface designed for both beginners and
                experienced traders.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Lock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Secure Trading
              </h3>
              <p className="text-sm text-slate-400">
                Trade with confidence using Spark's secure protocol and
                trustless asset transfers.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-slate-800/30 border-slate-700">
        <div className="flex items-start gap-4">
          <Info className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">
              About Spark AMM
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              The Spark AMM (Automated Market Maker) will enable seamless
              trading of BTKN assets (Spark tokens) with instant settlement and
              minimal fees. Built on top of the Spark SDK, it leverages Spark's
              layer 2 infrastructure for fast, cost-effective trades.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
