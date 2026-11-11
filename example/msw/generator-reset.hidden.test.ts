// @vitest-environment node
// Week 24's hidden test for the Mock Service Worker task (ours, not Cognition's or MSW's).
// The model never sees this file: the check copies it into test/node/ after the run ends.
// The bug report only says resetHandlers() doesn't restart a generator resolver. This file checks that,
// and also what the report never mentions: the generator that was cut off gets closed, so the
// user's `finally` cleanup runs (once, and only once).
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const cleanup = { sync: 0, async: 0, runtime: 0 }

const server = setupServer(
  http.get('http://localhost/sync', function* () {
    try {
      yield HttpResponse.json('first')
      yield HttpResponse.json('second')
      return HttpResponse.json('last')
    } finally {
      cleanup.sync++
    }
  }),
  http.get('http://localhost/async', async function* () {
    try {
      yield HttpResponse.json('first')
      yield HttpResponse.json('second')
      return HttpResponse.json('last')
    } finally {
      await Promise.resolve()
      cleanup.async++
    }
  }),
)

async function get(path: string) {
  const response = await fetch(`http://localhost${path}`)
  return response.json()
}

async function settled(read: () => number, want: number) {
  // a close may finish on a later tick (async generators); give it up to a second
  for (let i = 0; i < 100 && read() < want; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return read()
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(async () => {
  // the afterEach reset above may close a generator from the test before; let it finish, then count from 0
  await new Promise((resolve) => setTimeout(resolve, 20))
  cleanup.sync = cleanup.async = cleanup.runtime = 0
})

describe('the reported bug', () => {
  test('restart: a generator starts again after resetHandlers()', async () => {
    expect(await get('/sync')).toBe('first')
    expect(await get('/sync')).toBe('second')
    server.resetHandlers()
    expect(await get('/sync')).toBe('first')
    expect(await get('/sync')).toBe('second')
  })

  test('restart: an async generator starts again after resetHandlers()', async () => {
    expect(await get('/async')).toBe('first')
    expect(await get('/async')).toBe('second')
    server.resetHandlers()
    expect(await get('/async')).toBe('first')
  })

  test('restart: a finished generator starts again after resetHandlers()', async () => {
    expect(await get('/sync')).toBe('first')
    expect(await get('/sync')).toBe('second')
    expect(await get('/sync')).toBe('last')
    expect(await get('/sync')).toBe('last')
    server.resetHandlers()
    expect(await get('/sync')).toBe('first')
  })
})

describe('what the report never says', () => {
  test('cleanup: the cut-off generator is closed, so its finally block runs', async () => {
    expect(await get('/sync')).toBe('first')
    expect(cleanup.sync).toBe(0)
    server.resetHandlers()
    expect(await settled(() => cleanup.sync, 1)).toBe(1)
    expect(await get('/sync')).toBe('first')
    expect(cleanup.sync).toBe(1)
  })

  test('cleanup: the cut-off async generator is closed, so its finally block runs', async () => {
    expect(await get('/async')).toBe('first')
    server.resetHandlers()
    expect(await settled(() => cleanup.async, 1)).toBe(1)
  })

  test('cleanup: a generator added with server.use() and dropped by resetHandlers() is closed', async () => {
    server.use(
      http.get('http://localhost/runtime', function* () {
        try {
          yield HttpResponse.json('first')
          yield HttpResponse.json('second')
        } finally {
          cleanup.runtime++
        }
      }),
    )
    expect(await get('/runtime')).toBe('first')
    server.resetHandlers()
    expect(await settled(() => cleanup.runtime, 1)).toBe(1)
  })

  test('cleanup runs once: a generator that already finished is not cleaned up again', async () => {
    expect(await get('/sync')).toBe('first')
    expect(await get('/sync')).toBe('second')
    expect(await get('/sync')).toBe('last')
    expect(await settled(() => cleanup.sync, 1)).toBe(1)
    server.resetHandlers()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(cleanup.sync).toBe(1)
  })
})
