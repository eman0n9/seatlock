'use client'

import { AuthProvider } from 'features/auth/AuthProvider'
import { FavoritesProvider } from 'features/favorites/FavoritesProvider'
import { PurchaseProvider } from 'features/purchase/PurchaseProvider'
import MainLayout from 'layouts/MainLayout'

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <PurchaseProvider>
        <FavoritesProvider>
          <MainLayout>{children}</MainLayout>
        </FavoritesProvider>
      </PurchaseProvider>
    </AuthProvider>
  )
}
