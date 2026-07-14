'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from 'utils/cn'

function isActivePath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SiteMobileNav({
  items,
  onItemClick,
}) {
  const pathname = usePathname()

  return (
    <nav className="mobile-site-nav" aria-label="Mobile navigation">
      {items.map((item) => (
        <div key={item.to} className="mobile-site-nav__item">
          <Link
            href={item.to}
            className={cn('mobile-site-nav__link', isActivePath(pathname, item.to) && 'is-active')}
            onClick={onItemClick}
          >
            {item.label}
          </Link>

          {item.menuItems?.length ? (
            <div className="mobile-site-nav__menu">
              {item.menuItems.map((menuItem) => (
                <Link
                  key={`${item.to}-${menuItem.to}`}
                  href={menuItem.to}
                  className={cn(
                    'mobile-site-nav__menu-link',
                    isActivePath(pathname, menuItem.to) && 'is-active',
                  )}
                  onClick={onItemClick}
                >
                  {menuItem.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  )
}

export default SiteMobileNav
