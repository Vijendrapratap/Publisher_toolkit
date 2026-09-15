import { auth } from '@clerk/nextjs/server'

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthenticatedError'
  }
}

export async function requireCurrentPublisherId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new UnauthenticatedError()
  return userId
}
