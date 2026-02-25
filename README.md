# EatOut Restaurant Owner Admin Dashboard

- **Stack**: Next.js (Pages Router), React, Tailwind CSS, lucide-react
- **Auth**: JWT in HttpOnly cookie, middleware-protected dashboard routes
- **Theme**: Black / white / red, responsive, admin-focused

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo Credentials

- **Email**: `admin@eatout.com`
- **Password**: `password123`

## UX Rules Implemented

- **Status badges** with semantic colors.
- **Forward-only** status updates (`PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → COMPLETED`; or `CANCELLED`).
- **Completed / cancelled** orders have actions disabled.
- Clean, responsive, sidebar + header layout optimized for admins.

