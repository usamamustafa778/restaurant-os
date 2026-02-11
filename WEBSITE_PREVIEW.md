# Website Preview Feature

## Overview
Restaurant owners can now easily preview and access their public restaurant website directly from the dashboard.

## Features Added

### 1. Public Website URL Banner
- Displays the full public URL: `http://localhost:3000/r/{subdomain}`
- Shows visibility status (live or hidden)
- Located at the top of the Website settings page

### 2. Action Buttons

**View Live Website** 
- Opens the public website in a new browser tab
- Primary action button (red/primary color)

**Copy URL**
- Copies the public URL to clipboard
- Shows confirmation feedback when clicked
- Useful for sharing the website link

### 3. Interactive Preview Card
- Click the preview card to open the live website
- Hover effect shows it's clickable
- Visual preview of restaurant hero section

## How It Works

1. Navigate to **Dashboard → Website**
2. At the top, you'll see your public website URL
3. Click **"View Live Website"** to open in a new tab
4. Or click **"Copy URL"** to share with others
5. The preview card below is also clickable

## Public Website Access

Your restaurant's public website is accessible at:
```
http://localhost:3000/r/{your-subdomain}
```

### Visibility Control
- Toggle "Public website" setting to control visibility
- When **Hidden**: Website shows as offline to public
- When **Visible**: Website is live and accessible to everyone

## What Customers See

When they visit your public website:
- Restaurant name, logo, and banner
- Description and contact information
- Full menu organized by categories
- Pricing and item descriptions
- Responsive design (works on mobile/desktop)

## Development URLs

In production, the URLs would be:
- Dashboard: `https://app.restaurantos.com`
- Public sites: `https://{subdomain}.restaurantos.com`

In development (localhost):
- Dashboard: `http://localhost:3000`
- Public sites: `http://localhost:3000/r/{subdomain}`

## Tips

1. **Before making website public**: Add your branding (logo, banner, description)
2. **Add menu items**: Make sure to set "Show on Website" = Yes for items
3. **Test first**: View the live website while it's hidden to preview changes
4. **Share the link**: Use the Copy URL button to easily share with customers
