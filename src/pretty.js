import { lookup } from './lookup.js'

function isLocal (address) {
  var split = address.split('.')
  if (split[0] === '10') return true
  if (split[0] === '127') return true
  if (split[0] === '192' && split[1] === '168') return true
  if (split[0] === '172' && Number(split[1]) >= 16 && Number(split[1]) <= 31) return true
  return false
}

export async function lookupPretty (ipfs, multiaddrs) {
  if (multiaddrs.length === 0) {
    throw new Error('lookup requires a multiaddr array with length > 0')
  }

  if (typeof multiaddrs === 'string') {
    multiaddrs = [multiaddrs]
  }

  const current = multiaddrs[0].split('/')
  const address = current[2]

  // No ip6 support at the moment
  if (isLocal(address) || current[1] === 'ip6') {
    const next = multiaddrs.slice(1)
    if (next.length > 0) {
      return lookupPretty(ipfs, multiaddrs.slice(1))
    }
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
