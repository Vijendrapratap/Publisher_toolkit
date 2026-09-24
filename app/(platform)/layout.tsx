import { TopBar } from '@/components/platform/TopBar'
import { requireCurrentPublisherId } from '@/lib/providers/auth'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requireCurrentPublisherId()
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
