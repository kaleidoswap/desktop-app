/** Channel funds and liquidity are different: reserves are excluded from outbound liquidity. */
export const summarizeChannelBalances = (
  channels: Array<{
    local_balance_sat?: number
    outbound_balance_msat?: number
    inbound_balance_msat?: number
  }>
) => ({
  inboundSat: Math.floor(
    channels.reduce(
      (sum, channel) => sum + (channel.inbound_balance_msat ?? 0),
      0
    ) / 1000
  ),
  localBalanceSat: channels.reduce(
    (sum, channel) => sum + (channel.local_balance_sat ?? 0),
    0
  ),
  outboundSat: Math.floor(
    channels.reduce(
      (sum, channel) => sum + (channel.outbound_balance_msat ?? 0),
      0
    ) / 1000
  ),
})
