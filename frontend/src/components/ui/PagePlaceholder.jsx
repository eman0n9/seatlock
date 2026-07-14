import Link from 'next/link'

function PagePlaceholder({ actions = [], description, eyebrow, title }) {
  return (
    <section className="page-card page-card--stack">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>

      {actions.length ? (
        <div className="page-actions">
          {actions.map((action) => (
            <Link
              key={action.label}
              className={action.variant === 'secondary' ? 'button-link is-secondary' : 'button-link'}
              href={action.to}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default PagePlaceholder
