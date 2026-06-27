import { Inter } from 'next/font/google'
import 'styles/index.css'
import 'styles/auth.css'
import 'styles/seat-map.css'
import 'styles/basket.css'
import 'styles/profile.css'
import 'styles/tickets-checkout.css'
import Providers from 'app/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata = {
  title: 'SeatLock',
  description: 'Buy and sell event tickets with confidence.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
