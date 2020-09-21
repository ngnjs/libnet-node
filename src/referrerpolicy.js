import { INTERFACES as interfaces, REFERRER_MODES } from './constants.js'

const policies = REFERRER_MODES
const DEFAULT_POLICY = 'no-referrer-when-downgrade'
const INTERFACES = new Set(interfaces)

export default class ReferrerPolicy {
  #policy = DEFAULT_POLICY

  constructor (policy = '') {
    policy = policy.trim().toLowerCase()

    this.policy = policy
  }

  get policy () {
    return this.#policy
  }

  set policy (policy) {
    policy = policy || DEFAULT_POLICY

    if (policy !== this.#policy) {
      if (!policies.has(policy)) {
        throw new Error(`"${policy}" is not a valid policy. Must be one of: ${Array.from(policies).join(', ')}`)
      }

      this.#policy = policy
    }
  }

  stripReferrer (url = null, originonly = true) {
    // If url is null, return no referrer.
    if (url === null) {
      return null
    }

    if (!(url instanceof URL)) {
      if (!/^\w+:/i.test(url)) {
        url = `http://${url}`
      }
      url = new URL(url)
    }

    // If url scheme is local, then return no referrer.
    if (INTERFACES.has(url.hostname.toLowerCase())) {
      return null
    }

    return `${url.protocol}//${url.host}` + (!originonly ? `${url.pathname}${url.search}` : '')
  }

  /**
   * @param {string|URL} from
   * The location from which the request is being made.
   * @param {string|URL} to
   * The destination address.
   * @return {string}
   * The referrer URL to use in HTTP headers. This will be
   * `null` if no referrer is available.
   */
  referrerURL (from, to) {
    if (this.#policy === 'no-referrer' || !from || !to) {
      return null
    }

    from = typeof from === 'string' ? new URL(from) : from
    to = typeof to === 'string' ? new URL(to) : to

    if (from.protocol === 'file:' || from.protocol === 'data:') {
      return null
    }

    const sameOrigin = from.host === to.host

    switch (this.#policy) {
      case 'unsafe-url':
        return this.stripReferrer(from, false)

      case 'no-referrer-when-downgrade':
        if (from.protocol === 'https:' && to.protocol !== 'https:') {
          return null
        }

        return this.stripReferrer(from, false)

      case 'same-origin':
        if (sameOrigin) {
          return this.stripReferrer(from, false)
        }
        return null

      case 'origin':
        return `${from.protocol}//${from.host}/`

      case 'strict-origin':
        if (to.protocol === 'https:' || !sameOrigin) {
          if (from.protocol !== to.protocol && !sameOrigin) {
            return null
          }

          return this.stripReferrer(from) + '/'
        }
        return null

      case 'origin-when-cross-origin':
        if (sameOrigin && from.protocol === to.protocol) {
          return this.stripReferrer(from, false)
        }
        return this.stripReferrer(from) + '/'

      case 'strict-origin-when-cross-origin':
        if (sameOrigin) {
          return this.stripReferrer(from, false)
        } else if (from.protocol === to.protocol) {
          return this.stripReferrer(from) + '/'
        }

        return null
    }

    return null
  }
}
