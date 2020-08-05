import path from 'path'
import fs from 'fs'
import { coalesce, forceNumber } from './lib/functions.js'

const modes = new Set([
  'default',
  'no-store',
  'reload',
  'no-cache',
  'force-cache',
  'only-if-cached'
])

const cacheable = new Set([
  'GET',
  'HEAD',
  'POST'
])

// const pattern = {
//   request: /^([A-Z]+)\s+([^\s]+)\s+(.*)\n/i,
//   header: /((.*):\s+(.*))\n/i,
//   body:
// }

export default class Cache {
  #storageEngine
  #dir = null
  #store = new Map()

  #parse = content => {
    return content
  }

  #write = (request, response) => {
    const conn = this.connection(request)
    if (!this.#store.has(conn.protocol)) {
      this.#store.set(conn.protocol, new Map())
    }
    if (!this.#store.get(conn.protocol).has(conn.host)) {
      this.#store.get(conn.protocol).set(conn.host, new Map())
    }
    if (!this.#store.get(conn.protocol).get(conn.host).has(conn.method)) {
      this.#store.get(conn.protocol).get(conn.host).set(conn.method, new Map())
    }

    const item = {}

    Object.defineProperties(item, {
      request: {
        enumerable: true,
        get: () => {
          if (this.#storageEngine === 'memory') {
            const conn = this.connection(request)
            return {
              method: conn.method,
              path: conn.path,
              host: conn.host,
              headers: request.headers,
              raw: request.RESPONSE_BUFFER
            }
          } else {
            try {
              return this.#parse(fs.readFileSync(path.resolve(this.#dir, conn.host, conn.method, conn.path + '.cache')).toString().split(/\n-{3,}\n/)[0], 'response')
            } catch (e) {
              return null
            }
          }
        }
      },

      response: {
        enumerable: true,
        get: () => {
          if (this.#storageEngine === 'memory') {
            return Object.assign(response, { raw: coalesce(request.RESPONSE_BUFFER, Buffer.from([])).toString() })
          } else if (this.#storageEngine === 'disk') {
            try {
              return this.#parse(fs.readFileSync(path.resolve(this.#dir, conn.host, conn.method, conn.path + '.cache')).toString().split(/\n-{3,}\n/)[1], 'response')
            } catch (e) {
              return null
            }
          }
        }
      }
    })

    this.#store.get(conn.protocol).get(conn.host).get(conn.method).set(conn.path, item)

    // if (this.#storageEngine === 'disk' && request.hasOwnProperty('rawResponse')) {
    //   fs.mkdirSync(path.join(this.#dir, conn.host, conn.method, path.dirname(conn.path)), { recursive: true })
    //   if (request.hasOwnProperty('RAW_BUFFER')) {
    //     fs.writeFileSync(path.join(this.#dir, conn.host, conn.method, conn.path + '.cache'), request.RESPONSE_BUFFER)
    //   } else {
    //     let cache = request._header
    //     // let cache = `${conn.method} ${conn.path} HTTP/${rawResponse.version}\n` + Object.keys(rawResponse.headers).map(key => `${key.trim().toLowerCase()}: ${rawResponse.headers[key]}`).join('\n')
    //     if (coalesceb(request.body)) {
    //       cache = `${cache}\n\n${request.body.trim()}`
    //     }
    //     fs.writeFileSync(path.join(this.#dir, conn.host, conn.method, conn.path + '.cache'), cache)
    //   }
    //   fs.appendFile(path.join(this.#dir, conn.host, conn.method, conn.path + '.cache'), '\n---\n')
    //   fs.appendFile(path.join(this.#dir, conn.host, conn.method, conn.path + '.cache'), request.rawResponse)
    // }
  }

  constructor (storage = 'memory') {
    if (globalThis[Symbol.for('NGN.HttpCache')] instanceof Cache) {
      return globalThis[Symbol.for('NGN.HttpCache')]
    }

    this.#storageEngine = storage.trim().toLowerCase()

    // Handle shared cache
    if (this.#storageEngine !== 'memory') {
      this.#dir = path.resolve(this.#storageEngine)
      this.#storageEngine = 'directory'

      if (!fs.accessSync(this.#dir, fs.constants.W_OK) || !fs.statSync(this.#dir).isDirectory()) {
        throw new Error(`Cannot access the cache storage directory "${this.#dir}". Make sure the path exists and is a writable directory.`)
      }

      // fs.readdirSync(path.resolve(this.#dir)).forEach(filepath => {
      //     try {
      //       const content = fs.readFileSync(path.join(this.#dir, filepath)).toString()
      //     }
      // })
    }

    globalThis[Symbol.for('NGN.HttpCache')] = this
  }

  get size () {
    let ct = 0

    this.#store.forEach(hosts => hosts.forEach(res => { ct += res.size }))

    return ct
  }

  // Retrieve a response from the cache
  // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching#Freshness for cache freshness.
  get (request, cachemode = null) {
    // Determine whether cache should be used
    if (cachemode !== null) {
      cachemode = cachemode.trim().toLowerCase()

      if (!modes.has(cachemode)) {
        throw new Error(`"${cachemode}" is not a valid cachemode. Must be one of: ${Array.from(modes).join(', ')}.`)
      }

      if (!cacheable.has(request.method.trim().toUpperCase())) {
        return null
      }

      switch (cachemode) {
        case 'no-store':
          return null
        case 'reload':
          return null
      }
    }

    const conn = this.connection(request)
    const meta = {
      age: 0,
      status: 'stale'
    }

    const result = {
      status: 'stale'
    }

    if (this.has(request)) {
      const item = this.#store.get(conn.protocol).get(conn.host).get(conn.method).get(conn.path)
      result.exists = true

      Object.defineProperty(result, 'response', {
        enumerable: true,
        get: () => {
          item.age = meta.age
          item.status = meta.status
          return item
        }
      })

      let freshnessLifetime = null

      if (item.response.headers['cache-control']) {
        freshnessLifetime = coalesce(/^max-age\s+?=\s+?([0-9]+)/i.exec(item.response.headers['cache-control'] || ''), [null, null])[1]
      }

      if (item.response.headers.date) {
        if (freshnessLifetime === null && item.response.headers.expires) {
          try {
            freshnessLifetime = forceNumber(item.response.headers.expires) - Date.parse(item.response.headers.date).getTime()
          } catch (e) {}
        }

        if (freshnessLifetime === null && item.response.headers['last-modified']) {
          try {
            freshnessLifetime = (Date.parse(item.response.headers.date).getTime() - Date.parse(item.response.headers['last-modified']).getTime()) / 10
          } catch (e) {}
        }
      }

      const currentDateTime = (new Date()).getTime()
      meta.age = (new Date()).getTime() - coalesce(item.cacheDate, 0)
      const expirationTime = (currentDateTime + coalesce(freshnessLifetime, 0)) - meta.age

      if (expirationTime > 0) {
        result.status = 'fresh'
      }
    } else {
      Object.defineProperty(result, 'response', {
        enumerable: true,
        get: () => null
      })
    }

    return coalesce(result.response)
  }

  // Add a response to the cache
  put (request, response, cachemode = 'default') {
    if (!modes.has(cachemode)) {
      throw new Error(`"${cachemode}" is an invalid caching mode. Must be one of: ${Array.from(modes).map(', ')}.`)
    }

    if (!cacheable.has(request.method.toUpperCase()) || request.RESPONSE_BUFFER === undefined) {
      return response
    }

    // Respect cache-control: no-store response header
    const control = response.headers['cache-control'] || ''
    if (control.toLowerCase() === 'no-store') {
      return response
    }

    request.headers = coalesce(request.headers, {})
    switch (cachemode) {
      // case 'no-store':
      //  break
      case 'reload':
      case 'force-cache':
        this.#write(request, response)
        break
      // case 'only-if-cached':
      //   break
      case 'default':
      case 'no-cache': {
        // const item = this.get(request)
        // if (item && item.status === 'stale') {
        //   console.log('stale')
        // }
        if (response.statusCode !== 304) {
          this.#write(request, response)
        }
        break
      }
    }

    return response
  }

  connection (request) {
    return {
      method: request.method.toUpperCase(),
      protocol: coalesce(request.protocol, request.agent.protocol).replace(/:/gi, ''),
      host: /^(.*:[0-9]+):?/i.exec(Object.keys(request.agent.sockets)[0])[1],
      path: request.path
    }
  }

  // Matches request on headers
  match (request, cacheItem = null) {
    let vary = coalesce(request.getHeader('vary'), '')

    if (vary.length === '') {
      return true
    }

    let item = cacheItem

    if (!item) {
      const conn = this.connection(request)

      try {
        item = this.#store.get(conn.host).get(conn.method).get(conn.path)
      } catch (e) {
        return false
      }
    }

    if (!item) {
      return false
    }

    if (vary.length === 0) {
      return true
    }

    vary = vary.split(',')

    const headers = new Set(Array.from(item.headers.keys()).map(header => header.trim().toLowerCase()))
    if (vary.length === 1 && vary[0].trim() === '*') {
      return vary.filter(header => !headers.has(header.trim().toLowerCase())).length === 0
    }

    if (vary.filter(header => headers.delete(header.trim().toLowerCase())).length === 0) {
      return headers.size === 0
    }

    return false
  }

  has (request) {
    if (this.size === 0) {
      return false
    }

    const conn = this.connection(request)

    if (this.#store.has(conn.protocol)) {
      if (this.#store.get(conn.protocol).has(conn.host)) {
        if (this.#store.get(conn.protocol).get(conn.host).has(conn.method)) {
          if (this.#store.get(conn.protocol).get(conn.host).get(conn.method).has(conn.path)) {
            return this.match(request, this.#store.get(conn.protocol).get(conn.host).get(conn.method).get(conn.path))
          }
        }
      }
    }

    return false
  }

  shouldCapture (request, cachemode = 'no-store') {
    if (cacheable.has(request.method.trim().toUpperCase()) && modes.has(cachemode)) {
      // let URI = `${request.agent.protocol}//${host}${request.path}`
      switch (cachemode) {
        // case 'no-store':
        // return false
        case 'reload':
          return true
        case 'force-cache':
          return !this.has(request)
        // case 'only-if-cached':
        //   return false
        case 'default': {
          if (!this.has(request)) {
            return true
          }

          const item = this.get(request)
          if (item.status === 'stale') {
            request.headers = request.headers || {}
            request.headers['If-None-Match'] = coalesce(item.response.headers.etag, '*')
            return true
          }

          break
        }
        case 'no-cache':
          if (this.has(request)) {
            const item = this.get(request)
            request.headers = request.headers || {}
            request.headers['If-None-Match'] = coalesce(item.response.headers.etag, '*')
          }

          return true
      }
    }

    return false
  }

  capture (request, cachemode = 'no-store') {
    if (this.shouldCapture(request, cachemode)) {
      request.once('socket', socket => {
        socket.setNoDelay(true)
        socket.on('data', chunk => {
          request.RESPONSE_BUFFER = !request.RESPONSE_BUFFER
            ? chunk
            : Buffer.concat([request.RESPONSE_BUFFER, chunk], request.RESPONSE_BUFFER.length + chunk.length)
        })
      })
    }
  }

  // Remove a specific URL
  flush (uri) {
    const url = new URL(uri)
    const host = url.host

    this.#store.forEach(store => {
      if (store.has(host)) {
        store.get(host).forEach(method => {
          store.get(host).get(method).delete(url.path)

          if (this.#storageEngine === 'disk') {
            fs.unlinkSync(path.join(this.#dir, host, method, url.pathname + '.cache'))
          }

          if (store.get(host).get(method).size === 0) {
            store.get(host).delete(method)
            if (this.#storageEngine === 'disk') {
              fs.rmdirSync(path.join(this.#dir, host, method), { recursive: true })
            }
          }

          if (store.get(host).size === 0) {
            store.delete(host)
            if (this.#storageEngine === 'disk') {
              fs.rmdirSync(path.join(this.#dir, host), { recursive: true })
            }
          }
        })
      }
    })
  }

  // Clear multiple URL's
  clear () {
    (new Set([...arguments])).forEach(this.flush)
  }

  // Empty the entire cache
  empty () {
    if (this.#storageEngine === 'disk') {
      fs.rmdirSync(this.#dir, { maxRetries: 2, recursive: true })
    }

    this.#store = new Map()
  }

  get data () {
    const data = {}

    for (const [protocol, domain] of this.#store.entries()) {
      data[protocol] = convert(domain)
    }

    return data
  }
}

function convert (map) {
  const data = {}

  if (!(map instanceof Map)) {
    if (typeof map === 'object') {
      console.log(map.request.raw.toString())
      for (const [key, value] of Object.entries(map)) {
        data[key] = key === 'request' || key === 'response' ? value.raw.toString() : value
      }

      return data
    }
  }

  for (const [key, value] of map.entries()) {
    data[key] = convert(value)
  }

  return data
}
