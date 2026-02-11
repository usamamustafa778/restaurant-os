# Theme System Documentation

## Overview
RestaurantOS Dashboard now supports both **Light Theme** (default) and **Dark Theme** (optional) with a seamless toggle experience.

## Features

### 🌞 Light Theme (Default)
- Clean, modern light interface
- Better for well-lit environments
- Reduced eye strain in daylight
- Professional appearance

### 🌙 Dark Theme (Optional)
- Elegant dark interface
- Better for low-light environments
- Reduced eye strain at night
- Modern, sleek aesthetic

## How It Works

### Theme Toggle
- **Desktop**: Look for the theme toggle button in the top-right header
- **Mobile**: Theme toggle appears next to the logout button
- **Icon Indicators**:
  - 🌙 Moon icon = Currently in light mode, click to switch to dark
  - ☀️ Sun icon = Currently in dark mode, click to switch to light

### Persistence
- Your theme preference is automatically saved to `localStorage`
- Returns to your preferred theme on next visit
- Per-browser setting (doesn't sync across devices)

## Technical Implementation

### Theme Context
Located in `/contexts/ThemeContext.js`:
- Provides global theme state
- Handles theme toggling
- Manages localStorage persistence

### CSS Variables
Defined in `/styles/globals.css`:
- Uses CSS custom properties for colors
- Supports both light and dark color schemes
- Smooth transitions between themes

### Tailwind Configuration
Updated in `tailwind.config.js`:
- Dark mode enabled with `data-theme` attribute
- Supports `dark:` prefix for dark-specific styles

## Using Themes in Components

### Basic Usage
```jsx
// Text colors
className="text-gray-900 dark:text-white"
className="text-gray-800 dark:text-neutral-400"

// Background colors
className="bg-white dark:bg-black"
className="bg-gray-50 dark:bg-neutral-950"

// Border colors
className="border-gray-300 dark:border-neutral-800"
```

### Accessing Theme in Components
```jsx
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      Current theme: {theme}
    </button>
  );
}
```

## Color Palette

### Light Theme
- **Background**: White (#FFFFFF), Gray-50, Gray-100
- **Text**: Gray-900 (primary), Gray-600 (secondary), Gray-400 (tertiary)
- **Borders**: Gray-200, Gray-300
- **Primary**: Red-600 (#EF4444)

### Dark Theme
- **Background**: Black (#000000), Neutral-950, Neutral-900
- **Text**: White (primary), Neutral-300 (secondary), Neutral-500 (tertiary)
- **Borders**: Neutral-800, Neutral-700
- **Primary**: Red-600 (#EF4444)

## Components Updated
- ✅ AdminLayout (sidebar, header, main area)
- ✅ Card component
- ✅ Button component
- ✅ Global styles and scrollbars

## Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- All modern browsers supporting CSS custom properties

## Future Enhancements
- [ ] System theme detection (auto-match OS preference)
- [ ] Additional theme options (high contrast, custom colors)
- [ ] Theme preview before applying
- [ ] Sync theme preference across devices (requires backend)
