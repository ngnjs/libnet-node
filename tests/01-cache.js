import test from 'tappedout'
import { Cache } from '@ngnjs/libnet-node'
import http from 'http'

const uri = new URL('http://localhost/')

let cache
let requestCount = 0
function GET (uri, nodecache = null, mode) {
  const ncache = nodecache
  uri = typeof uri === 'string' ? new URL(uri) : uri

  return new Promise((resolve, reject) => {
    const req = http.request(uri.href, res => {
      requestCount++

      const data = []

      res.setEncoding('utf8')
      res.on('data', c => data.push(c))
      res.on('end', () => {
        res.body = data.join()

        if (ncache) {
          try {
            ncache.put(req, res, mode)
          } catch (e) {
            console.error(e)
          }
        }

        resolve(res)
      })
    })

    req.on('error', reject)

    if (ncache) {
      if (mode !== 'reload' && mode !== 'no-cache') {
        const cached = ncache.get(req, mode)
        if (cached) {
          req.abort() // Prevents orphan request from existing (orphans cause the process to hang)
          return resolve(cached.response)
        }
      }

      ncache.capture(req, mode || 'default')
    }

    req.setNoDelay(true)
    req.end()
  })
}

test('Sanity Check', async t => {
  // Make sure the test harness is returning the proper results
  // This is a test of the harness, not the library.
  uri.pathname = '/static'
  const a = await GET(uri).catch(console.error)
  if (a.body.length === 0 || JSON.parse(a.body).text !== 'static') {
    console.error('GET ' + uri.href + ' returned incorrect result.')
    console.log('Abort test.')
    process.exit(1)
  }

  cache = new Cache()

  t.ok(cache !== undefined, 'HTTP Cache exists in Node-like environments.')
  t.ok(globalThis[Symbol.for('NGN.HttpCache')] instanceof Cache, 'HTTP Cache is recognized globally in runtime.')
  t.expect(0, cache.size, 'Cache is empty upon creation.')
  t.end()
})

test('Node HTTP Cache: no-store', async t => {
  cache.empty()

  uri.pathname = '/static'
  const res = await GET(uri, cache, 'no-store').catch(e => t.fail(e.message))

  t.expect(0, cache.size, 'Cache does not store "no-store" requests.')
  t.end()
})

test('Node HTTP Cache: default', async t => {
  cache.empty()

  uri.pathname = '/static'

  const a = await GET(uri, cache, 'default').catch(console.error)
  t.expect(1, cache.size, '"default" cache mode increases the cache size when the response has been cached.')

  const b = await GET(uri, cache, 'default').catch(console.error)
  t.expect(1, cache.size, 'Caching the same request twice does not change the cache size.')

  const response = await GET(uri, cache, 'default').catch(console.error)
  t.ok(response.raw === a.raw && response.statusCode === a.statusCode && response.rawHeaders.join() === a.rawHeaders.join(), 'Retrieving the cache yields the correct response.')

  t.end()
})

test('Node HTTP Cache: reload', async t => {
  cache.empty()

  uri.pathname = '/static'
  const a = await GET(uri, cache, 'reload').catch(console.error)

  // Change the response, but not the cache.
  uri.pathname = '/change/different'
  await GET(uri).catch(console.error)

  uri.pathname = '/static'
  requestCount = 0

  const b = await GET(uri, cache, 'reload').catch(console.error)
  t.expect(1, requestCount, 'A request was made.')
  t.expect(1, cache.size, 'Cache size does not change when a specific request is updated.')
  t.expect('different', JSON.parse(b.body).text, 'Cache update reflects latest value.')

  const response = await GET(uri, cache, 'default').catch(console.error)
  t.expect(1, requestCount, 'Followup request is short-circuited (request count remains untouched)')
  t.ok(response.body === b.body && response.statusCode === b.statusCode && response.rawHeaders.join() === b.rawHeaders.join(), 'Retrieving the cache yields the correct response.')

  uri.pathname = '/reset'
  await GET(uri).catch(console.error)

  t.end()
})

test('Node HTTP Cache: no-cache', async t => {
  cache.empty()

  uri.pathname = '/reset'
  await GET(uri).catch(console.error)

  uri.pathname = '/static'
  const a = await GET(uri, cache, 'default').catch(console.error)

  // Change the response, but not the cache.
  uri.pathname = '/change/different'
  await GET(uri).catch(console.error)

  requestCount = 0
  uri.pathname = '/static'

  const b = await GET(uri, cache, 'default').catch(console.error)
  t.expect(0, requestCount, 'Standard cached request was not sent to the server.')
  t.expect('static', JSON.parse(b.body).text, 'Standard cached result returns proper result.')

  const c = await GET(uri, cache, 'no-cache').catch(console.error)
  t.expect(1, requestCount, 'Request was still sent to the server.')
  t.expect(1, cache.size, 'Cache size does not change when a specific request is updated.')
  t.expect('different', JSON.parse(c.body).text, 'Cache update reflects latest value.')

  // const { response } = cache.get(a.req)
  // t.ok(response.raw === b.res.raw && response.statusCode === b.res.statusCode && response.rawHeaders.join() === b.res.rawHeaders.join(), 'Retrieving and updated/reloaded cache result yields new value.')

  uri.pathname = '/reset'
  await GET(uri).catch(console.error)

  t.end()
})
