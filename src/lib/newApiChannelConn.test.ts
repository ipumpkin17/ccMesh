import { describe, expect, it } from 'vitest'

import { nameFromUpstreamUrl, parseNewApiChannelConn } from './newApiChannelConn'

describe('nameFromUpstreamUrl', () => {
  it('strips www and takes brand label', () => {
    expect(nameFromUpstreamUrl('https://www.mofas.one')).toBe('mofas')
  })

  it('strips api prefix', () => {
    expect(nameFromUpstreamUrl('https://api.42w.shop')).toBe('42w')
  })

  it('keeps single label host', () => {
    expect(nameFromUpstreamUrl('http://localhost:3000')).toBe('localhost')
  })
})

describe('parseNewApiChannelConn', () => {
  it('parses single object', () => {
    const r = parseNewApiChannelConn(
      JSON.stringify({
        _type: 'newapi_channel_conn',
        key: 'sk-sss',
        url: 'https://www.mofas.one',
      }),
    )
    expect(r).toEqual({
      name: 'mofas',
      apiUrl: 'https://www.mofas.one',
      apiKey: 'sk-sss',
    })
  })

  it('accepts one-item array', () => {
    const r = parseNewApiChannelConn(
      JSON.stringify([
        {
          _type: 'newapi_channel_conn',
          key: 'sk-a',
          url: 'https://api.42w.shop/',
        },
      ]),
    )
    expect(r.name).toBe('42w')
    expect(r.apiUrl).toBe('https://api.42w.shop')
    expect(r.apiKey).toBe('sk-a')
  })

  it('rejects multiple ndjson objects', () => {
    expect(() =>
      parseNewApiChannelConn(`{"_type":"newapi_channel_conn","key":"a","url":"https://a.com"}\n{"_type":"newapi_channel_conn","key":"b","url":"https://b.com"}`),
    ).toThrow(/一次导入一条/)
  })

  it('rejects wrong type', () => {
    expect(() => parseNewApiChannelConn(JSON.stringify({ _type: 'other', key: 'k', url: 'https://x.com' }))).toThrow(/_type/)
  })

  it('rejects missing key', () => {
    expect(() =>
      parseNewApiChannelConn(
        JSON.stringify({
          _type: 'newapi_channel_conn',
          url: 'https://x.com',
        }),
      ),
    ).toThrow(/key/)
  })
})
