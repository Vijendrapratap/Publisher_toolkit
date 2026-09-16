import Link from 'next/link'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/platform/EmptyState'
import { buttonClasses } from '@/components/ui/button'

export default function PlatformNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <EmptyState
        icon={<Compass className="size-7" aria-hidden />}
        title="We couldn’t find that page"
        description="The project may have been removed, or the link is out of date."
        action={
          <Link href="/" className={buttonClasses()}>
            Back to all tools
          </Link>
        }
      />
    </div>
  )
}
