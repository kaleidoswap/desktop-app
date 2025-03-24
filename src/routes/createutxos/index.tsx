import { Info, DollarSign, Zap, ArrowLeft, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { Button, Card } from '../../components/ui'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface FormFields {
  up_to: boolean
  num: number
  size: number
  fee_rate: string
}

export const Component = () => {
  const [feeRates, setFeeRates] = useState({
    fast: 3,
    normal: 2,
    slow: 1,
  })
  const [customFee, setCustomFee] = useState(1.0)
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()

  const { handleSubmit, register, watch, setValue } = useForm<FormFields>({
    defaultValues: {
      fee_rate: feeRates.normal.toString(),
      num: 4,
      size: 32500,
    },
  })

  const num = watch('num')
  const size = watch('size')
  const feeRate = watch('fee_rate')

  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [createutxos] = nodeApi.useLazyCreateUTXOsQuery()
  const [estimateFee] = nodeApi.useLazyEstimateFeeQuery()

  const onSubmit = (data: FormFields) => {
    setIsLoading(true)
    createutxos({
      fee_rate:
        data.fee_rate !== 'custom' ? parseFloat(data.fee_rate) : customFee,
      num: data.num,
      size: data.size,
      skip_sync: false,
    }).then((res: any) => {
      setIsLoading(false)
      if (res.error) {
        toast.error(res.error.data.error)
      } else {
        navigate(-1)
        toast.success('UTXOs created successfully')
      }
    })
  }

  const refreshData = useCallback(() => {
    btcBalance({ skip_sync: false })
  }, [btcBalance])

  useEffect(() => {
    const fetchFees = async () => {
      const slowFeePromise = estimateFee({ blocks: 6 }).unwrap()
      const normalFeePromise = estimateFee({ blocks: 3 }).unwrap()
      const fastFeePromise = estimateFee({ blocks: 1 }).unwrap()

      try {
        const [slowFee, normalFee, fastFee] = await Promise.all([
          slowFeePromise,
          normalFeePromise,
          fastFeePromise,
        ])
        setFeeRates({
          fast: fastFee.fee_rate,
          normal: normalFee.fee_rate,
          slow: slowFee.fee_rate,
        })
      } catch (e) {
        console.error(e)
      }
    }

    fetchFees()
  }, [estimateFee])

  useEffect(() => {
    refreshData()
    const intervalId = setInterval(refreshData, 3000)
    return () => clearInterval(intervalId)
  }, [refreshData])

  return (
    <div className="max-w-2xl mx-auto">
      <Button
        className="mb-6"
        icon={<ArrowLeft size={18} />}
        onClick={() => navigate(-1)}
        size="sm"
        variant="ghost"
      >
        Back
      </Button>

      <Card className="mb-6">
        <div className="flex flex-col items-center mb-6">
          <Wallet className="w-12 h-12 text-blue-500 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-4">
            Create Colored UTXOs
          </h3>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3 w-full">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">
              Colored UTXOs are necessary for opening RGB asset lightning
              channels. They allow for the creation of asset-specific payment
              channels, enabling fast and secure transactions of RGB assets over
              the Lightning Network.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Number of UTXOs
              </label>
              <input
                {...register('num', { valueAsNumber: true })}
                className="w-full bg-slate-800/50 text-white px-4 py-3 rounded-lg border border-slate-600 
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                max={10}
                min={1}
                placeholder="Enter amount"
                type="number"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                UTXO Size (in satoshis)
              </label>
              <div className="flex items-center gap-4">
                <input
                  {...register('size', { valueAsNumber: true })}
                  className="flex-1 bg-slate-800/50 text-white px-4 py-3 rounded-lg border border-slate-600 
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  max={
                    btcBalanceResponse.data
                      ? Math.floor(
                          btcBalanceResponse.data?.vanilla.spendable / num
                        )
                      : 0
                  }
                  min={0}
                  placeholder="Enter size"
                  type="number"
                />
                <span className="text-lg font-semibold text-white min-w-[100px] text-right">
                  {size.toLocaleString()}
                </span>
              </div>
              <input
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer mt-4"
                max={
                  btcBalanceResponse.data
                    ? Math.floor(
                        btcBalanceResponse.data?.vanilla.spendable / num
                      )
                    : 0
                }
                min={0}
                onChange={(e) => setValue('size', Number(e.target.value))}
                step="1000"
                type="range"
                value={size}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Fee Rate
              </label>
              <select
                className="w-full bg-slate-800/50 text-white px-4 py-3 rounded-lg border border-slate-600 
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                value={feeRate}
                {...register('fee_rate')}
              >
                <option value={feeRates.slow}>
                  Slow ({feeRates.slow} sat/vB)
                </option>
                <option value={feeRates.normal}>
                  Normal ({feeRates.normal} sat/vB)
                </option>
                <option value={feeRates.fast}>
                  Fast ({feeRates.fast} sat/vB)
                </option>
                <option value="custom">Custom</option>
              </select>
              {feeRate === 'custom' && (
                <input
                  className="w-full bg-slate-800/50 text-white px-4 py-3 mt-4 rounded-lg border border-slate-600 
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  defaultValue={customFee}
                  onChange={(e) => setCustomFee(parseFloat(e.target.value))}
                  step={0.1}
                  type="number"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4">
            <div className="flex items-center text-slate-300">
              <DollarSign className="text-yellow-500 mr-2" size={20} />
              <span>
                Available Balance:{' '}
                {btcBalanceResponse.data?.vanilla.spendable.toLocaleString()}{' '}
                sats
              </span>
            </div>
            <Button
              fullWidth={false}
              icon={<Zap size={20} />}
              isLoading={isLoading}
              size="lg"
              type="submit"
              variant="primary"
            >
              Create UTXOs
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
