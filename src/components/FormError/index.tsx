interface FormErrorProps {
  errors?: Record<string, string[]>
  message?: string
  variant?: 'box' | 'inline'
}

export const FormError = ({
  errors,
  message = 'There was an error submitting the form.',
  variant = 'box',
}: FormErrorProps) => {
  if (variant === 'inline') {
    return <div className="mt-4 flex justify-end text-red">{message}</div>
  }

  return (
    <div className="mt-4 mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
      <p className="mb-2 text-red-500">{message}</p>
      {errors && Object.entries(errors).length > 0 && (
        <ul className="list-inside list-disc">
          {Object.entries(errors).map(([field, messages]) => (
            <li className="text-sm text-red-400" key={field}>
              {field}: {messages.join(', ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
