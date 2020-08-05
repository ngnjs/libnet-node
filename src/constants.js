import os from 'os'

export const REFERRER_MODES = new Set([
  'no-referrer',
  'no-referrer-when-downgrade',
  'same-origin',
  'origin',
  'strict-origin',
  'origin-when-cross-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url'
])

export const HOSTNAME = os.hostname().toLocaleLowerCase()

const interfaces = new Set([
  '127.0.0.1',
  'localhost',
  HOSTNAME
])

// Retreive local IP's and hostnames in relevant runtimes
for (const value of Object.values(os.networkInterfaces())) {
  for (const item of value) {
    interfaces.add(item.family === 'IPv4' ? item.address : `[${item.address}]`)
  }
}

export const INTERFACES = Array.from(interfaces)
