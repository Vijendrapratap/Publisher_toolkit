import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'

const PREFIX = 'schematest_'

describe('credits schema', () => {
  afterEach(async () => {
    await prisma.creditLedger.deleteMany({ where: { userId: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } })
  })

  it('rejects a negative balance at the database', async () => {
    await prisma.user.create({ data: { id: `${PREFIX}u1`, email: 'a@b.c', balance: 1 } })
    await expect(
      prisma.user.update({ where: { id: `${PREFIX}u1` }, data: { balance: { decrement: 2 } } })
    ).rejects.toThrow(/check constraint|23514/i)
  })

  it('rejects a duplicate idempotency key', async () => {
    await prisma.user.create({ data: { id: `${PREFIX}u2`, email: 'a@b.c' } })
    const row = { userId: `${PREFIX}u2`, delta: 1, kind: 'adjust', idempotencyKey: `${PREFIX}k1` }
    await prisma.creditLedger.create({ data: row })
    await expect(prisma.creditLedger.create({ data: row })).rejects.toMatchObject({ code: 'P2002' })
  })
})
