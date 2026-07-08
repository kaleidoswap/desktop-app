import { UseFormReturn } from 'react-hook-form'

import { Input } from './Input'

interface NetworkSettingsProps {
  form: UseFormReturn<any>
  className?: string
}

/**
 * A reusable component for network configuration settings
 */
export const NetworkSettings = ({
  form,
  className = '',
}: NetworkSettingsProps) => {
  const getErrorMessage = (error: any): string | undefined => {
    return error?.message ? String(error.message) : undefined
  }

  const fieldCls = 'space-y-1.5'
  const labelCls = 'block text-sm font-medium text-content-secondary'

  return (
    <div className={`space-y-4 ${className}`}>
      <div className={fieldCls}>
        <label className={labelCls} htmlFor="rpc_connection_url">
          RPC Connection URL
        </label>
        <Input
          className="!py-2.5 text-sm"
          id="rpc_connection_url"
          placeholder="Enter RPC connection URL"
          {...form.register('rpc_connection_url', {
            required: 'RPC connection URL is required',
          })}
          error={!!form.formState.errors.rpc_connection_url}
        />
        {getErrorMessage(form.formState.errors.rpc_connection_url) && (
          <p className="text-sm text-red-500">
            {getErrorMessage(form.formState.errors.rpc_connection_url)}
          </p>
        )}
      </div>

      <div className={fieldCls}>
        <label className={labelCls} htmlFor="indexer_url">
          Indexer URL
        </label>
        <Input
          className="!py-2.5 text-sm"
          id="indexer_url"
          placeholder="Enter indexer URL"
          {...form.register('indexer_url', {
            required: 'Indexer URL is required',
          })}
          error={!!form.formState.errors.indexer_url}
        />
        {getErrorMessage(form.formState.errors.indexer_url) && (
          <p className="text-sm text-red-500">
            {getErrorMessage(form.formState.errors.indexer_url)}
          </p>
        )}
      </div>

      <div className={fieldCls}>
        <label className={labelCls} htmlFor="proxy_endpoint">
          Proxy Endpoint
        </label>
        <Input
          className="!py-2.5 text-sm"
          id="proxy_endpoint"
          placeholder="Enter proxy endpoint"
          {...form.register('proxy_endpoint', {
            required: 'Proxy endpoint is required',
          })}
          error={!!form.formState.errors.proxy_endpoint}
        />
        {getErrorMessage(form.formState.errors.proxy_endpoint) && (
          <p className="text-sm text-red-500">
            {getErrorMessage(form.formState.errors.proxy_endpoint)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="daemon_listening_port">
            Daemon Listening Port
          </label>
          <Input
            className="!py-2.5 text-sm"
            id="daemon_listening_port"
            placeholder="Enter daemon port"
            {...form.register('daemon_listening_port', {
              required: 'Daemon port is required',
            })}
            error={!!form.formState.errors.daemon_listening_port}
          />
          {getErrorMessage(form.formState.errors.daemon_listening_port) && (
            <p className="text-sm text-red-500">
              {getErrorMessage(form.formState.errors.daemon_listening_port)}
            </p>
          )}
        </div>

        <div className={fieldCls}>
          <label className={labelCls} htmlFor="ldk_peer_listening_port">
            LDK Peer Listening Port
          </label>
          <Input
            className="!py-2.5 text-sm"
            id="ldk_peer_listening_port"
            placeholder="Enter LDK peer port"
            {...form.register('ldk_peer_listening_port', {
              required: 'LDK peer port is required',
            })}
            error={!!form.formState.errors.ldk_peer_listening_port}
          />
          {getErrorMessage(form.formState.errors.ldk_peer_listening_port) && (
            <p className="text-sm text-red-500">
              {getErrorMessage(form.formState.errors.ldk_peer_listening_port)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
