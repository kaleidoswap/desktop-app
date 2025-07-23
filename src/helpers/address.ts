const MAX_ADDRESS_LENGTH = 41
const ADDRESS_SLICE_LENGTH = (MAX_ADDRESS_LENGTH - 3) / 2

export const shortenAddress = (address: string) => {
  if (address.length <= MAX_ADDRESS_LENGTH) {
    return address
  }

  return `${address.slice(0, ADDRESS_SLICE_LENGTH)}...${address.slice(
    -ADDRESS_SLICE_LENGTH
  )}`
}

export const isValidPubkeyAndAddress = (value: string): boolean => {
  // Allow pubkey-only format (66 hex chars) for connected peers
  const isPubkeyOnly = value.length === 66 && /^[0-9a-fA-F]{66}$/.test(value)
  if (isPubkeyOnly) {
    return true
  }

  // Check full format: pubkey@host:port
  const parts = value.split('@')
  if (parts.length !== 2) return false

  const [pubkey, hostAndPort] = parts

  // Validate pubkey: 66 characters hex string
  const pubkeyRegex = /^[0-9a-fA-F]{66}$/
  if (!pubkeyRegex.test(pubkey)) return false

  // Validate host:port format
  const hostPortParts = hostAndPort.split(':')
  if (hostPortParts.length !== 2) return false

  const [host, port] = hostPortParts

  // Basic host validation
  if (!host || host.length < 1) return false

  // Port should be a number between 1-65535
  const portNum = parseInt(port, 10)
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) return false

  return true
}
