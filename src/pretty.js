import { isLocalIPv4, isLocalIPv6 } from './ip.js'
import { lookup } from './lookup.js'

export async function lookupPretty (ipfs, multiaddrs) {
  if (multiaddrs.length === 0) {
    throw new Error('lookup requires a multiaddr array with length > 0')
  }

  if (typeof multiaddrs === 'string') {
    multiaddrs = [multiaddrs]
  }

  const current = multiaddrs[0].split('/')
  const protocol = current[1]
  const address = current[2]

  if (protocol === 'ip4' && isLocalIPv4(address)) {
    const next = multiaddrs.slice(1)
    if (next.length > 0) return lookupPretty(ipfs, next)
    throw new Error('Unmapped range')
  }

  if (protocol === 'ip6' && isLocalIPv6(address)) {
    const next = multiaddrs.slice(1)
    if (next.length > 0) return lookupPretty(ipfs, next)
    throw new Error('Unmapped range')
  }

  // reject protocols we can't geolocate
  if (protocol !== 'ip4' && protocol !== 'ip6') {
    const next = multiaddrs.slice(1)
    if (next.length > 0) return lookupPretty(ipfs, next)
    throw new Error('Unmapped range')
  }

  const res = await lookup(ipfs, address)

  if (!res.country_name && multiaddrs.length > 1) {
    return lookupPretty(ipfs, multiaddrs.slice(1))
  }

  const location = []

  if (res.planet) location.push(res.planet)
  if (res.country_name) location.unshift(res.country_name)
  if (res.region_code) location.unshift(res.region_code)
  if (res.city) location.unshift(res.city)

  res.formatted = location.join(', ')

  return res
}
