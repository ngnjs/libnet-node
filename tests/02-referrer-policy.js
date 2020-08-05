import test from 'tappedout'
import { ReferrerPolicy } from '@ngnjs/libnet-node'

test('Sanity Check', t => {
  const rp = new ReferrerPolicy()
  t.ok(rp.policy === 'no-referrer-when-downgrade', `Default policy is no-referrer-when-downgrade. Detected "${rp.policy}"`)
  t.end()
})

test('Node ReferralPolicy Checks', t => {
  const rp = new ReferrerPolicy()
  let from
  let to
  let result

  // All tests come from examples at https://www.w3.org/TR/referrer-policy/#referrer-policies

  // no-referrer-when-downgrade
  rp.policy = 'no-referrer-when-downgrade'
  t.expect('no-referrer-when-downgrade', rp.policy, 'Set policy to \'no-referrer-when-downgrade\'.')

  from = 'https://example.com/page.html'
  to = 'https://not.example.com/'
  t.expect('https://example.com/page.html', rp.referrerURL(from, to), `'no-referrer-when-downgrade' from "${from}" to "${to}"`)

  to = 'http://not.example.com/'
  t.expect(null, rp.referrerURL(from, to), `'no-referrer-when-downgrade' from "${from}" to "${to}"`)

  from = 'http://example.com/page.html'
  to = 'https://not.example.com/'
  t.expect('http://example.com/page.html', rp.referrerURL(from, to), `'no-referrer-when-downgrade' from "${from}" to "${to}"`)

  // no-referrer
  rp.policy = 'no-referrer'
  t.expect('no-referrer', rp.policy, 'Set policy to \'no-referrer\'.')

  from = 'https://example.com/page.html'
  to = 'https://example.com/'
  t.expect(null, rp.referrerURL(from, to), `'no-referrer' referrer from "${from}" to "${to}" is null`)

  // same-origin
  rp.policy = 'same-origin'
  t.expect('same-origin', rp.policy, 'Set policy to \'same-origin\'.')

  from = 'https://example.com/page.html'
  to = 'https://example.com/not-page.html'
  t.expect('https://example.com/page.html', rp.referrerURL(from, to), `'same-origin' from "${from}" to "${to}"`)

  to = 'https://not.example.com/'
  t.expect(null, rp.referrerURL(from, to), `'same-origin' referrer from "${from}" to "${to}" is null.`)

  // origin
  rp.policy = 'origin'
  t.expect('origin', rp.policy, 'Set policy to \'origin\'.')

  from = 'https://example.com/page.html'
  to = 'http://another.example.com/not-page.html'
  t.expect('https://example.com/', rp.referrerURL(from, to), `'origin' referrer from "${from}" to "${to}"`)

  // strict-origin
  rp.policy = 'strict-origin'
  t.expect('strict-origin', rp.policy, 'Set policy to \'strict-origin\'.')

  from = 'https://example.com/page.html'
  to = 'https://not.example.com'
  t.expect('https://example.com/', rp.referrerURL(from, to), `'strict-origin' referrer from "${from}" to "${to}"`)

  to = 'http://not.example.com'
  t.expect(null, rp.referrerURL(from, to), `'strict-origin' referrer from "${from}" to "${to}"`)

  from = 'http://example.com/page.html'
  to = 'http://not.example.com'
  t.expect('http://example.com/', rp.referrerURL(from, to), `'strict-origin' referrer from "${from}" to "${to}"`)

  from = 'http://example.com/page.html'
  to = 'https://example.com'
  t.expect('http://example.com/', rp.referrerURL(from, to), `'strict-origin' referrer from "${from}" to "${to}"`)

  // origin-when-cross-origin
  rp.policy = 'origin-when-cross-origin'
  t.expect('origin-when-cross-origin', rp.policy, 'Set policy to \'origin-when-cross-origin\'.')

  from = 'https://example.com/page.html'
  to = 'https://example.com/not-page.html'
  t.expect('https://example.com/page.html', rp.referrerURL(from, to), `'origin-when-cross-origin' referrer from "${from}" to "${to}"`)

  to = 'https://not.example.com/'
  t.expect('https://example.com/', rp.referrerURL(from, to), `'origin-when-cross-origin' referrer from "${from}" to "${to}"`)

  // strict-origin-when-cross-origin
  rp.policy = 'strict-origin-when-cross-origin'
  t.expect('strict-origin-when-cross-origin', rp.policy, 'Set policy to \'strict-origin-when-cross-origin\'.')

  from = 'https://example.com/page.html'
  to = 'https://example.com/not-page.html'
  t.expect('https://example.com/page.html', rp.referrerURL(from, to), `'strict-origin-when-cross-origin' referrer from "${from}" to "${to}"`)
  to = 'https://not.example.com/'
  t.expect('https://example.com/', rp.referrerURL(from, to), `'strict-origin-when-cross-origin' referrer from "${from}" to "${to}"`)
  to = 'http://not.example.com/'
  t.expect(null, rp.referrerURL(from, to), `'strict-origin-when-cross-origin' referrer from "${from}" to "${to}"`)

  // unsafe-url
  rp.policy = 'unsafe-url'
  t.expect('unsafe-url', rp.policy, 'Set policy to \'unsafe-url\'.')

  from = 'https://example.com/sekrit.html'
  to = 'http://not.example.com/'
  t.expect('https://example.com/sekrit.html', rp.referrerURL(from, to), `'unsafe-url' referrer from "${from}" to "${to}"`)

  t.throws(() => {
    rp.policy = 'unrecognized'
  }, 'Setting an invalid policy throws an error.')

  t.end()
})
