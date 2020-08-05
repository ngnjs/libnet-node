import test from 'tappedout'
import { SRI } from '@ngnjs/libnet-node'

test('Node SRI Polyfill', t => {
  const source = 'console.log(\'hello\');'
  const hash = 'sha512-/9wXJrT4fVC90Fxko/AY9VO6E6C1+atlV9CThcRFlmWODDqwRABAr/4EwtzU0W7yJy6PGyvNc9kZV66XEmkrKA=='
  const integrity = SRI.generate(source)

  t.expect(hash, integrity, 'Generated hash')

  let result = SRI.verify(integrity, source)
  t.ok(result.valid, 'Successfully verified integrity hash.')

  result = SRI.verify(integrity.replace('sha512', 'sha384'), source)
  t.ok(!result.valid, 'Recognize invalid result')
  t.expect('Integrity mismatch.', result.reason, 'Mismatch successfully identified.')

  result = SRI.verify('123', source)
  t.ok(!result.verified && result.reason.indexOf('improper format') > 0, 'Improper hash successfully identified.')

  t.end()
})
