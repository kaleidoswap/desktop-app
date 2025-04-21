import { SuccessCheckmark } from '../../components/SuccessCheckmark'

interface Props {
  error: string | null
  onFinish: VoidFunction
  onRetry: VoidFunction
}

export const Step4 = (props: Props) => {
  if (props.error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
        <div className="text-red-500 text-7xl mb-8 animate-bounce">❌</div>

        <div className="text-center mt-6 bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-gray-700 transition-all duration-300 ease-in-out">
          <h3 className="text-3xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-red-600">
            Channel creation failed
          </h3>

          <p className="text-red-400 mb-8 py-3 px-4 bg-red-900/20 rounded-lg border border-red-800/50">
            {props.error}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="px-8 py-3 rounded-xl text-lg font-bold
                bg-gray-700 hover:bg-gray-600 text-gray-300
                transform transition-all duration-200 hover:scale-105 active:scale-95
                focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50
                shadow-md hover:shadow-lg"
              onClick={props.onRetry}
            >
              Try Again
            </button>

            <button
              className="px-8 py-3 rounded-xl text-lg font-bold text-white
                bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                transform transition-all duration-200 hover:scale-105 active:scale-95
                focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                shadow-lg hover:shadow-xl"
              onClick={props.onFinish}
            >
              Go to Channels Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
      <div className="transition-all duration-300 ease-in-out">
        <SuccessCheckmark />
      </div>

      <div className="text-center mt-8 bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-gray-700 transition-all duration-300 ease-in-out">
        <h3 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          Channel successfully created!
        </h3>

        <p className="text-gray-300 mb-8 py-3 px-4 bg-blue-900/20 rounded-lg border border-blue-800/30">
          The channel has been successfully created, you can now start trading.
        </p>

        <button
          className="px-10 py-4 rounded-xl text-lg font-bold text-white
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
            transform transition-all duration-200 hover:scale-105 active:scale-95
            focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
            shadow-lg hover:shadow-xl"
          onClick={props.onFinish}
        >
          Go to Channels Page
        </button>
      </div>
    </div>
  )
}
