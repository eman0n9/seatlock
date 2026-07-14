import { redirect } from 'next/navigation'
import { routePaths } from 'app/routePaths'

export default function Page() {
  redirect(routePaths.orders)
}
