import Head from 'next/head';
import { useRouter } from 'next/router';

export default function SEO({
  title = 'Eats Desk - Restaurant Management System | POS, Inventory & Website',
  description = 'All-in-one restaurant management platform for Pakistan. Fast POS system, smart inventory tracking, and free branded website. Start your 3-months free trial today!',
  keywords = 'restaurant POS, restaurant management software, inventory management, online ordering, restaurant website, Pakistan restaurant software, food business software, cafe management system',
  ogImage = '/og-image.jpg',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  canonical,
  noindex = false,
  structuredData,
}) {
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://eatsdesk.com';
  const fullUrl = canonical || `${baseUrl}${router.asPath}`;
  const fullTitle = title.includes('Eats Desk') ? title : `${title} | Eats Desk`;
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Eats Desk" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="language" content="English" />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <meta name="googlebot" content={noindex ? 'noindex, nofollow' : 'index, follow'} />

      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImageUrl} />
      <meta property="og:site_name" content="Eats Desk" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta property="twitter:card" content={twitterCard} />
      <meta property="twitter:url" content={fullUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImageUrl} />
      <meta name="twitter:creator" content="@eatsdesk" />

      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#F97316" />
      <meta name="msapplication-TileColor" content="#F97316" />
      
      {/* Favicon */}
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="manifest" href="/site.webmanifest" />

      {/* Structured Data / JSON-LD */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
    </Head>
  );
}

// Utility function to generate common structured data
export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Eats Desk',
  description: 'Restaurant management system with POS, inventory, and website builder',
  url: 'https://eatsdesk.com',
  logo: 'https://eatsdesk.com/logo.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+92-333-1234567',
    contactType: 'Customer Service',
    areaServed: 'PK',
    availableLanguage: ['English', 'Urdu'],
  },
  sameAs: [
    'https://www.facebook.com/eatsdesk',
    'https://twitter.com/eatsdesk',
    'https://www.linkedin.com/company/eatsdesk',
  ],
});

export const generateSoftwareAppSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Eats Desk',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web Browser',
  offers: {
    '@type': 'Offer',
    price: '39',
    priceCurrency: 'USD',
    priceValidUntil: '2025-12-31',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '127',
  },
  description: 'Complete restaurant management solution with POS, inventory management, and website builder',
});

export const generateBreadcrumbSchema = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});
