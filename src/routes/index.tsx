import { createFileRoute } from '@tanstack/react-router'
import { Rail } from '#/components/ui'
import { getHome } from '#/server/fns'

export const Route = createFileRoute('/')({ loader: () => getHome(), component: Home })

function Home() {
  const data = Route.useLoaderData()
  return <main id="main" className="bg-page p-5"><Rail title="Best Sellers" items={data.bestsellers} /></main>
}
