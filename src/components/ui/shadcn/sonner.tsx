import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from 'lucide-react'
import { Toaster as Sonner } from 'sonner'

import { useSettings } from '@/hooks/useSettings'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useSettings()

  return (
    <Sonner
      className="toaster group"
      icons={{
        error: <OctagonX className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
        success: <CircleCheck className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
      }}
      theme={theme as ToasterProps['theme']}
      toastOptions={{
        classNames: {
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          description: 'group-[.toast]:text-muted-foreground',
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
