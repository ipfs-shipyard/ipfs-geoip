// IPv4 and IPv6 address utilities for ipfs-geoip
// All IPs are normalized to 128-bit unsigned integers (BigInt)
// IPv4 addresses are mapped to IPv4-mapped IPv6 space (::ffff:a.b.c.d)

const IPV4_MAPPED_PREFIX = 0xffff00000000n

export function ipv4ToUint128 (str) {
  const parts = str.split('.')
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${str}`)
  const n = ((Number(parts[0]) << 24) | (Number(parts[1]) << 16) |
    (Number(parts[2]) << 8) | Number(parts[3])) >>> 0
  return IPV4_MAPPED_PREFIX | BigInt(n)
}

export function ipv6ToUint128 (str) {
  // handle IPv4-mapped form like ::ffff:1.2.3.4
  const v4Suffix = str.match(/:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4Suffix) {
    const prefix = str.slice(0, str.length - v4Suffix[1].length - 1)
    const v4Parts = v4Suffix[1].split('.').map(Number)
    const v4Num = ((v4Parts[0] << 24) | (v4Parts[1] << 16) |
      (v4Parts[2] << 8) | v4Parts[3]) >>> 0

    const expanded = expandIPv6Prefix(prefix, 6)
    return (expanded << 32n) | BigInt(v4Num)
  }

  return expandIPv6Full(str)
}

function expandIPv6Prefix (prefix, expectedGroups) {
  if (prefix.endsWith(':')) prefix = prefix.slice(0, -1)
  if (prefix.startsWith(':')) prefix = prefix.slice(1)

  const dblColon = prefix.includes('::')

  if (dblColon) {
    const halves = prefix.split('::')
    const left = halves[0] ? halves[0].split(':') : []
    const right = halves[1] ? halves[1].split(':') : []
    const missing = expectedGroups - left.length - right.length
    const allParts = [...left, ...Array(missing).fill('0'), ...right]
    return allParts.reduce((acc, p) => (acc << 16n) | BigInt(parseInt(p, 16)), 0n)
  }

  const parts = prefix.split(':').filter(p => p !== '')
  return parts.reduce((acc, p) => (acc << 16n) | BigInt(parseInt(p, 16)), 0n)
}

function expandIPv6Full (str) {
  const halves = str.split('::')
  let groups

  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : []
    const right = halves[1] ? halves[1].split(':') : []
    const missing = 8 - left.length - right.length
    groups = [...left, ...Array(missing).fill('0'), ...right]
  } else {
    groups = str.split(':')
  }

  if (groups.length !== 8) throw new Error(`Invalid IPv6 address: ${str}`)
  return groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n)
}

export function ipToUint128 (str) {
  if (str.includes(':')) return ipv6ToUint128(str)
  return ipv4ToUint128(str)
}

export function uint128ToBytes (n) {
  const buf = new Uint8Array(16)
  for (let i = 15; i >= 0; i--) {
    buf[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return buf
}

export function bytesToUint128 (buf) {
  let n = 0n
  for (let i = 0; i < 16; i++) {
    n = (n << 8n) | BigInt(buf[i])
  }
  return n
}

export function cidrToRange (cidr) {
  const [addr, prefixStr] = cidr.split('/')
  const prefix = Number(prefixStr)
  const ip = ipToUint128(addr)

  if (addr.includes(':')) {
    // IPv6 CIDR
    const hostBits = 128 - prefix
    const mask = hostBits === 128 ? 0n : ((1n << 128n) - 1n) >> BigInt(hostBits) << BigInt(hostBits)
    const first = ip & mask
    const last = first | ((1n << BigInt(hostBits)) - 1n)
    return { first, last }
  }

  // IPv4 CIDR
  const v4Bits = 32 - prefix
  const v4Ip = Number(ip & 0xffffffffn)
  const v4Mask = v4Bits === 32 ? 0 : (0xffffffff >>> v4Bits) << v4Bits
  const v4First = (v4Ip & v4Mask) >>> 0
  const v4Last = (v4First | ((1 << v4Bits) - 1)) >>> 0

  return {
    first: IPV4_MAPPED_PREFIX | BigInt(v4First),
    last: IPV4_MAPPED_PREFIX | BigInt(v4Last)
  }
}

export function isLocalIPv4 (address) {
  const parts = address.split('.')
  if (parts[0] === '10') return true
  if (parts[0] === '127') return true
  if (parts[0] === '192' && parts[1] === '168') return true
  if (parts[0] === '172' && Number(parts[1]) >= 16 && Number(parts[1]) <= 31) return true
  return false
}

export function isLocalIPv6 (address) {
  const lower = address.toLowerCase()
  if (lower === '::1') return true
  if (lower.startsWith('fe80:')) return true // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
  return false
}
