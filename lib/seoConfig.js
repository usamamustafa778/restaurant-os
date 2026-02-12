// SEO Configuration for all pages
// Import this in your pages and use the pre-configured SEO settings

export const dashboardSEO = {
  overview: {
    title: 'Dashboard Overview - Restaurant Analytics & Insights',
    description: 'View your restaurant performance at a glance. Real-time sales, orders, inventory alerts, and key metrics for your restaurant business.',
    keywords: 'restaurant dashboard, sales analytics, restaurant metrics, business insights, POS analytics',
    noindex: true, // Dashboard pages should not be indexed
  },
  
  pos: {
    title: 'POS System - Quick Order Processing',
    description: 'Lightning-fast point of sale system for restaurants. Take orders, process payments, and manage tables efficiently.',
    keywords: 'restaurant POS, point of sale, order processing, restaurant billing',
    noindex: true,
  },
  
  orders: {
    title: 'Orders Management - Track All Restaurant Orders',
    description: 'Manage dine-in, takeaway, and delivery orders from one place. Track order status and history.',
    keywords: 'order management, restaurant orders, order tracking, delivery management',
    noindex: true,
  },
  
  kitchen: {
    title: 'Kitchen Display System (KDS) - Order Management',
    description: 'Real-time kitchen display system for chefs. View incoming orders, update preparation status, and streamline kitchen operations.',
    keywords: 'kitchen display system, KDS, chef display, kitchen management, order preparation',
    noindex: true,
  },
  
  reservations: {
    title: 'Table Reservations - Booking Management',
    description: 'Manage table reservations, customer bookings, and dining schedules for your restaurant.',
    keywords: 'table reservations, restaurant bookings, reservation management, table management',
    noindex: true,
  },
  
  categories: {
    title: 'Menu Categories - Organize Your Menu',
    description: 'Create and manage menu categories for your restaurant. Organize dishes by type, cuisine, or meal time.',
    keywords: 'menu categories, menu organization, food categories, dish types',
    noindex: true,
  },
  
  menuItems: {
    title: 'Menu Items - Manage Your Restaurant Menu',
    description: 'Add, edit, and organize menu items. Set prices, upload images, and link ingredients for inventory tracking.',
    keywords: 'menu management, food items, dish management, menu prices, menu images',
    noindex: true,
  },
  
  customers: {
    title: 'Customer Management - CRM for Restaurants',
    description: 'Manage customer database, order history, and loyalty programs. Build lasting relationships with your patrons.',
    keywords: 'customer management, restaurant CRM, customer database, loyalty program',
    noindex: true,
  },
  
  inventory: {
    title: 'Inventory Management - Stock Control',
    description: 'Track ingredient stock levels, set reorder points, and get low-stock alerts. Never run out during peak hours.',
    keywords: 'inventory management, stock control, ingredient tracking, restaurant supplies',
    noindex: true,
  },
  
  users: {
    title: 'User Management - Staff & Roles',
    description: 'Manage restaurant staff, assign roles, and control access permissions for your team members.',
    keywords: 'user management, staff management, employee roles, access control',
    noindex: true,
  },
  
  branches: {
    title: 'Branch Management - Multi-Location Control',
    description: 'Manage multiple restaurant locations from one dashboard. Track performance across all branches.',
    keywords: 'multi-location, branch management, restaurant chain, multiple outlets',
    noindex: true,
  },
  
  history: {
    title: 'Reports & Analytics - Business Intelligence',
    description: 'View detailed sales reports, profit margins, top-selling items, and comprehensive business analytics.',
    keywords: 'sales reports, business analytics, profit analysis, restaurant reports',
    noindex: true,
  },
  
  website: {
    title: 'Website Settings - Your Restaurant Online Presence',
    description: 'Customize your restaurant website, update branding, colors, and online ordering settings.',
    keywords: 'website settings, restaurant website, online presence, branding',
    noindex: true,
  },
  
  integrations: {
    title: 'Integrations & API - Connect Your Tools',
    description: 'Integrate with third-party services, manage API keys, and connect delivery platforms.',
    keywords: 'restaurant integrations, API, third-party apps, delivery integration',
    noindex: true,
  },
  
  subscription: {
    title: 'Subscription Management - Your Plan & Billing',
    description: 'Manage your Eats Desk subscription, view billing history, and upgrade your plan.',
    keywords: 'subscription management, billing, pricing plan, upgrade',
    noindex: true,
  },
  
  profile: {
    title: 'Profile Settings - Account Management',
    description: 'Update your account details, change password, and manage notification preferences.',
    keywords: 'profile settings, account management, user profile, preferences',
    noindex: true,
  },
  
  deals: {
    title: 'Deals & Promotions - Marketing Campaigns',
    description: 'Create promotional deals, discounts, and special offers to attract more customers.',
    keywords: 'restaurant deals, promotions, discounts, special offers, marketing',
    noindex: true,
  },
};

// Public pages that should be indexed
export const publicSEO = {
  restaurantMenu: (restaurantName) => ({
    title: `${restaurantName} - Order Food Online | Eats Desk`,
    description: `Order delicious food from ${restaurantName}. Browse our menu, see prices, and place your order online for delivery or pickup.`,
    keywords: `${restaurantName}, order food online, restaurant menu, food delivery, online ordering`,
    ogType: 'restaurant.menu',
  }),
};

// Helper function to generate structured data for restaurant menu pages
export const generateRestaurantSchema = (restaurantData) => ({
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: restaurantData.name,
  description: restaurantData.description,
  url: restaurantData.url,
  telephone: restaurantData.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: restaurantData.address?.street,
    addressLocality: restaurantData.address?.city,
    addressRegion: restaurantData.address?.region,
    postalCode: restaurantData.address?.postalCode,
    addressCountry: 'PK',
  },
  servesCuisine: restaurantData.cuisine || [],
  priceRange: restaurantData.priceRange || '$$',
  acceptsReservations: true,
  menu: restaurantData.menuUrl,
});

// Helper function to generate menu item schema
export const generateMenuItemSchema = (item, restaurantUrl) => ({
  '@context': 'https://schema.org',
  '@type': 'MenuItem',
  name: item.name,
  description: item.description,
  image: item.imageUrl,
  offers: {
    '@type': 'Offer',
    price: item.price,
    priceCurrency: 'PKR',
    availability: item.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
  },
  nutrition: item.nutrition ? {
    '@type': 'NutritionInformation',
    calories: item.nutrition.calories,
  } : undefined,
  suitableForDiet: item.dietary || [],
});
