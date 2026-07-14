import AppIcon from 'components/ui/AppIcon'
import { cn } from 'utils/cn'

function ExploreCategoryTabs({
  activeCategory,
  activeSubcategory = '',
  categories,
  onCategoryChange,
  onSubcategoryChange = () => {},
  secondaryCategories = [],
}) {
  return (
    <div className="explore-categories">
      <div className="explore-categories__primary" role="tablist" aria-label="Explore categories">
        {categories.map((category) => {
          const isActive = category.id === activeCategory

          return (
            <button
              key={category.id}
              type="button"
              className={cn('explore-primary-tab', isActive && 'is-active')}
              onClick={() => onCategoryChange(category.id)}
            >
              <AppIcon name={category.icon} className="explore-category-icon" />
              <span className="explore-primary-tab__label">{category.label}</span>
            </button>
          )
        })}
      </div>

      {secondaryCategories.length ? (
        <div className="explore-categories__secondary">
          {secondaryCategories.map((subcategory) => (
            <button
              key={subcategory}
              type="button"
              className={cn(
                'explore-secondary-pill',
                subcategory === activeSubcategory && 'is-active',
              )}
              onClick={() => onSubcategoryChange(subcategory)}
            >
              {subcategory}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default ExploreCategoryTabs
