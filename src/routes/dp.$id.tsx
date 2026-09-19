import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dp/$id')({ component: () => <main id="main" className="p-8">TODO /dp/$id</main> })
