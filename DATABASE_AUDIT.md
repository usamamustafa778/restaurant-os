# RestaurantOS — Database Audit Report

**Date:** March 9, 2026
**Scope:** Full database layer — technology, schema, indexes, security, data integrity, and operational concerns

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Technology & Connection](#2-database-technology--connection)
3. [Environment & Credentials](#3-environment--credentials)
4. [ORM & Query Patterns](#4-orm--query-patterns)
5. [Complete Schema Reference](#5-complete-schema-reference)
6. [Indexes & Uniqueness Constraints](#6-indexes--uniqueness-constraints)
7. [Relationships & Referential Integrity](#7-relationships--referential-integrity)
8. [Authentication & Authorization Data](#8-authentication--authorization-data)
9. [Multi-Tenancy Model](#9-multi-tenancy-model)
10. [Soft-Delete Patterns](#10-soft-delete-patterns)
11. [Data Validation](#11-data-validation)
12. [Migration Scripts](#12-migration-scripts)
13. [Real-Time Layer (Socket.IO)](#13-real-time-layer-socketio)
14. [API Surface (CRUD Operations)](#14-api-surface-crud-operations)
15. [Seed Data & Fixtures](#15-seed-data--fixtures)
16. [Caching & Performance](#16-caching--performance)
17. [Audit Logging & Change Tracking](#17-audit-logging--change-tracking)
18. [Transactions](#18-transactions)
19. [Backup & Disaster Recovery](#19-backup--disaster-recovery)
20. [Security Findings & Recommendations](#20-security-findings--recommendations)
21. [Data Integrity Findings & Recommendations](#21-data-integrity-findings--recommendations)
22. [Performance Findings & Recommendations](#22-performance-findings--recommendations)
23. [Operational Findings & Recommendations](#23-operational-findings--recommendations)

---

## 1. Architecture Overview

```
┌──────────────────────┐        HTTP / WS        ┌────────────────────────────┐
│   Next.js Frontend   │ ◄────────────────────►   │   Express.js Backend       │
│   (restaurant-os)    │                          │   (restaurnat-os-backend)  │
│   - Dashboard        │                          │   - REST API               │
│   - POS UI           │                          │   - Socket.IO              │
│   - Public website   │                          │   - Mongoose ODM           │
│   - No direct DB     │                          │                            │
└──────────────────────┘                          └────────────┬───────────────┘
                                                               │
                                                               │ Mongoose
                                                               ▼
                                                  ┌────────────────────────────┐
                                                  │   MongoDB Atlas            │
                                                  │   (cloud-hosted cluster)   │
                                                  └────────────────────────────┘
```

- **Frontend** (`restaurant-os`): Next.js app. Zero direct database access; communicates exclusively through the backend REST API.
- **Backend** (`restaurnat-os-backend`): Express.js server. Sole accessor of MongoDB via Mongoose v8.8.0.
- **Database**: MongoDB (cloud-hosted on Atlas via `mongodb+srv://` connection string).

---

## 2. Database Technology & Connection

| Property | Value |
|---|---|
| **Database** | MongoDB (Atlas cluster) |
| **Protocol** | `mongodb+srv://` |
| **ODM** | Mongoose 8.8.0 |
| **Connection file** | `restaurnat-os-backend/config/db.js` |
| **Invocation** | `server.js` → `connectDB(process.env.MONGO_URI)` |
| **Connection pooling** | Mongoose defaults (no custom pool size, timeout, or retry config) |
| **Connection options** | Empty object `{}` — all Mongoose 8.x defaults apply |
| **On-connect migrations** | Index cleanup & creation runs every time the server starts (see §12) |

---

## 3. Environment & Credentials

Defined in `.env` (template at `.env.example`):

| Variable | Purpose |
|---|---|
| `MONGO_URI` | Full MongoDB connection string (includes credentials) |
| `PORT` | Server port (default `5000`) |
| `JWT_SECRET` | Signing key for JSON Web Tokens |
| `CLOUDINARY_CLOUD_NAME` | Image upload (CDN) |
| `CLOUDINARY_API_KEY` | Image upload (CDN) |
| `CLOUDINARY_API_SECRET` | Image upload (CDN) |
| `CLOUDINARY_URL` | Combined Cloudinary URL |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Transactional email |
| `EMAIL_FROM` | Sender address |
| `CORS_ORIGIN` | Allowed CORS origin for Socket.IO |

**Finding:** The `.env.example` file contains what appear to be real Cloudinary and SMTP credentials rather than dummy placeholders. See §20.

---

## 4. ORM & Query Patterns

- **Mongoose** is the only data-access layer. No raw MongoDB driver calls, no aggregation pipelines, no SQL.
- Common patterns:
  - `Model.find()`, `.findOne()`, `.findById()`, `.findOneAndUpdate()`, `.create()`, `.updateMany()`
  - `.populate()` for joining referenced documents
  - `.lean()` for read-heavy routes (returns plain JS objects, skipping Mongoose hydration)
  - `.select()` to limit returned fields
- No repository or service abstraction layer — route handlers call Mongoose directly.

---

## 5. Complete Schema Reference

### 5.1 User

**Collection:** `users` | **File:** `models/User.js` | **Timestamps:** yes

| Field | Type | Required | Unique | Default | Constraints |
|---|---|---|---|---|---|
| `name` | String | yes | — | — | trim |
| `email` | String | yes | yes | — | lowercase, trim |
| `password` | String | yes | — | — | minlength: 6 |
| `role` | String | — | — | `'manager'` | enum: `super_admin`, `restaurant_admin`, `staff` (legacy), `admin`, `product_manager`, `cashier`, `manager`, `kitchen_staff`, `order_taker` |
| `profileImageUrl` | String | — | — | `null` | — |
| `restaurant` | ObjectId → Restaurant | — | — | — | nullable (super_admin has none) |
| `emailVerified` | Boolean | — | — | `false` | — |
| `emailVerificationOtp` | String | — | — | — | — |
| `emailVerificationOtpExpires` | Date | — | — | — | — |
| `resetPasswordOtp` | String | — | — | — | — |
| `resetPasswordOtpExpires` | Date | — | — | — | — |

**Hooks:** Pre-save bcrypt hashing (salt rounds: 10).
**Methods:** `matchPassword(entered)` — bcrypt compare.

---

### 5.2 Restaurant

**Collection:** `restaurants` | **File:** `models/Restaurant.js` | **Timestamps:** yes

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `website` | Embedded (websiteSettingsSchema) | — | — | See sub-schema below |
| `subscription` | Embedded (subscriptionSchema) | — | — | See sub-schema below |
| `readonly` | Boolean | — | `false` | Set by middleware when subscription expires |
| `isDeleted` | Boolean | — | `false` | Indexed. Soft-delete flag |
| `deletedAt` | Date | — | `null` | Soft-delete timestamp |
| `settings.allowOrderWhenOutOfStock` | Boolean | — | `false` | — |
| `settings.restaurantLogoUrl` | String | — | — | POS / bill logo |

**websiteSettingsSchema (embedded, no `_id`):**

| Field | Type | Required | Unique | Default |
|---|---|---|---|---|
| `subdomain` | String | yes | yes | — |
| `isPublic` | Boolean | — | — | `true` |
| `name` | String | yes | — | — |
| `logoUrl` | String | — | — | — |
| `bannerUrl` | String | — | — | — |
| `description` | String | — | — | — |
| `tagline` | String | — | — | — |
| `contactPhone` | String | — | — | — |
| `contactEmail` | String | — | — | — |
| `address` | String | — | — | — |
| `heroSlides` | Array of {title, subtitle, imageUrl, buttonText, buttonLink, isActive} | — | — | — |
| `socialMedia` | {facebook, instagram, twitter, youtube} | — | — | — |
| `themeColors` | {primary, secondary} | — | — | `#EF4444` / `#FFA500` |
| `openingHours` | {monday..sunday} | — | — | Per-day defaults |
| `openingHoursText` | String | — | — | Free-text override |
| `allowWebsiteOrders` | Boolean | — | — | `true` |
| `websiteSections` | Array of {title, subtitle, isActive, items → MenuItem[]} | — | — | — |

**subscriptionSchema (embedded, no `_id`):**

| Field | Type | Default | Notes |
|---|---|---|---|
| `plan` | String enum: `ESSENTIAL`, `PROFESSIONAL`, `ENTERPRISE` | `'ESSENTIAL'` | — |
| `status` | String enum: `TRIAL`, `ACTIVE`, `SUSPENDED`, `EXPIRED` | `'TRIAL'` | — |
| `trialStartsAt` | Date | — | Legacy |
| `trialEndsAt` | Date | — | Legacy |
| `expiresAt` | Date | — | Legacy |
| `freeTrialStartDate` | Date | — | New |
| `freeTrialEndDate` | Date | — | New |
| `subscriptionStartDate` | Date | — | New |
| `subscriptionEndDate` | Date | — | New |

---

### 5.3 Branch

**Collection:** `branches` | **File:** `models/Branch.js` | **Timestamps:** yes

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — | Indexed |
| `name` | String | yes | — | trim |
| `code` | String | — | `null` | trim |
| `address` | String | — | `''` | — |
| `contactPhone` | String | — | `''` | — |
| `contactEmail` | String | — | `''` | — |
| `openingHours` | Mixed | — | `{}` | — |
| `websiteOverrides` | Mixed | — | `{}` | — |
| `status` | String | — | `'active'` | enum: `active`, `inactive`, `closed_today` |
| `sortOrder` | Number | — | `0` | — |
| `showTablePos` | Boolean | — | `true` | — |
| `showWaiterPos` | Boolean | — | `true` | — |
| `showCustomerPos` | Boolean | — | `true` | — |
| `isDeleted` | Boolean | — | `false` | Indexed |
| `deletedAt` | Date | — | `null` | — |

---

### 5.4 Order

**Collection:** `orders` | **File:** `models/Order.js` | **Timestamps:** yes

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — | Indexed |
| `branch` | ObjectId → Branch | — | `null` | Indexed |
| `table` | ObjectId → Table | — | `null` | — |
| `tableNumber` | String | — | `''` | — |
| `tableName` | String | — | `''` | — |
| `createdBy` | ObjectId → User | — | `null` | — |
| `orderType` | String | yes | — | enum: `DINE_IN`, `TAKEAWAY`, `DELIVERY` |
| `paymentMethod` | String | — | `'PENDING'` | enum: `PENDING`, `CASH`, `CARD`, `ONLINE`, `OTHER` |
| `paymentAmountReceived` | Number | — | `null` | — |
| `paymentAmountReturned` | Number | — | `null` | — |
| `status` | String | — | `'NEW_ORDER'` | enum: `NEW_ORDER`, `PROCESSING`, `READY`, `DELIVERED`, `CANCELLED` |
| `source` | String | — | `'POS'` | enum: `POS`, `FOODPANDA`, `WEBSITE` |
| `externalOrderId` | String | — | `''` | Foodpanda order ref |
| `customerName` | String | — | `''` | — |
| `customerPhone` | String | — | `''` | — |
| `deliveryAddress` | String | — | `''` | — |
| `items` | Array of orderItemSchema | — | — | See below |
| `subtotal` | Number | yes | — | min: 0 |
| `discountAmount` | Number | yes | `0` | min: 0 |
| `appliedDeals` | Array of appliedDealSchema | — | — | See below |
| `customer` | ObjectId → Customer | — | `null` | — |
| `total` | Number | yes | — | min: 0 |
| `orderNumber` | String | yes | — | — |
| `ingredientCost` | Number | — | `0` | min: 0 |
| `profit` | Number | — | `0` | — |

**orderItemSchema (embedded, no `_id`):** `menuItem` (→ MenuItem), `name`, `quantity` (min 1), `unitPrice` (min 0), `lineTotal` (min 0)

**appliedDealSchema (embedded, no `_id`):** `deal` (→ Deal), `dealName`, `dealType`, `discountAmount` (min 0)

---

### 5.5 Category

**Collection:** `categories` | **File:** `models/Category.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `name` | String | yes | — |
| `description` | String | — | — |
| `isActive` | Boolean | — | `true` |

---

### 5.6 MenuItem

**Collection:** `menuitems` | **File:** `models/MenuItem.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `name` | String | yes | — |
| `description` | String | — | — |
| `price` | Number | yes | — |
| `category` | ObjectId → Category | yes | — |
| `available` | Boolean | — | `true` |
| `availableAtAllBranches` | Boolean | — | `true` |
| `showOnWebsite` | Boolean | — | `true` |
| `imageUrl` | String | — | — |
| `isFeatured` | Boolean | — | `false` |
| `isBestSeller` | Boolean | — | `false` |
| `isTrending` | Boolean | — | `false` |
| `isMustTry` | Boolean | — | `false` |
| `dietaryType` | String | — | `'non_veg'` |
| `inventoryConsumptions` | Array of {inventoryItem → InventoryItem, quantity} | — | — |

---

### 5.7 BranchMenuItem

**Collection:** `branchmenuitems` | **File:** `models/BranchMenuItem.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `branch` | ObjectId → Branch | yes | — |
| `menuItem` | ObjectId → MenuItem | yes | — |
| `available` | Boolean | — | `true` |
| `priceOverride` | Number | — | `null` |

---

### 5.8 InventoryItem

**Collection:** `inventoryitems` | **File:** `models/InventoryItem.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `name` | String | yes | — |
| `unit` | String | — | — |
| `currentStock` | Number | yes | `0` |
| `lowStockThreshold` | Number | — | `0` |
| `costPrice` | Number | — | `0` |

---

### 5.9 BranchInventory

**Collection:** `branchinventories` | **File:** `models/BranchInventory.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `branch` | ObjectId → Branch | yes | — |
| `inventoryItem` | ObjectId → InventoryItem | yes | — |
| `currentStock` | Number | yes | `0` |
| `lowStockThreshold` | Number | — | `0` |
| `costPrice` | Number | — | `0` |

---

### 5.10 Table

**Collection:** `tables` | **File:** `models/Table.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `name` | String | yes | — |
| `isAvailable` | Boolean | — | `true` |

---

### 5.11 Customer

**Collection:** `customers` | **File:** `models/Customer.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `name` | String | yes | — |
| `phone` | String | yes | — |
| `email` | String | — | `''` |
| `address` | String | — | `''` |
| `notes` | String | — | `''` |
| `totalOrders` | Number | — | `0` |
| `totalSpent` | Number | — | `0` |
| `lastOrderAt` | Date | — | `null` |

---

### 5.12 Deal

**Collection:** `deals` | **File:** `models/Deal.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branches` | [ObjectId → Branch] | — | — |
| `name` | String | yes | — |
| `description` | String | — | — |
| `dealType` | String | — | — |
| `discountPercentage` | Number | — | — |
| `discountAmount` | Number | — | — |
| `comboItems` | Array of {menuItem, name, quantity} | — | — |
| `comboPrice` | Number | — | — |
| `buyQuantity` / `getQuantity` | Number | — | — |
| `buyMenuItem` / `getMenuItem` | ObjectId → MenuItem | — | — |
| `minimumPurchaseAmount` | Number | — | — |
| `applicableMenuItems` | [ObjectId] | — | — |
| `applicableCategories` | [ObjectId] | — | — |
| `startDate` / `endDate` | Date | yes | — |
| `startTime` / `endTime` | String | — | — |
| `daysOfWeek` | [Number] | — | — |
| `maxUsagePerCustomer` / `maxTotalUsage` | Number | — | — |
| `currentUsageCount` | Number | — | `0` |
| `isActive` | Boolean | — | `true` |
| `priority` | Number | — | `0` |
| `imageUrl` / `badgeText` | String | — | — |
| `showOnWebsite` / `showOnPOS` | Boolean | — | `true` |
| `canStackWithOtherDeals` | Boolean | — | `false` |

**Deal types:** `PERCENTAGE_DISCOUNT`, `FIXED_DISCOUNT`, `COMBO`, `BUY_X_GET_Y`, `MINIMUM_PURCHASE`

---

### 5.13 DealUsage

**Collection:** `dealusages` | **File:** `models/DealUsage.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `deal` | ObjectId → Deal | yes | — |
| `customer` | ObjectId → Customer | yes | — |
| `order` | ObjectId → Order | yes | — |
| `usageCount` | Number | — | `1` |
| `discountApplied` | Number | yes | — |

---

### 5.14 Reservation

**Collection:** `reservations` | **File:** `models/Reservation.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `customer` | ObjectId → Customer | — | `null` |
| `customerName` | String | yes | — |
| `customerPhone` | String | yes | — |
| `customerEmail` | String | — | `''` |
| `date` | Date | yes | — |
| `time` | String | yes | — |
| `guestCount` | Number | — | `2` |
| `tableNumber` | String | — | `''` |
| `table` | ObjectId → Table | — | `null` |
| `status` | String | — | `'pending'` |
| `notes` / `specialRequests` | String | — | `''` |

**Statuses:** `pending`, `confirmed`, `seated`, `completed`, `cancelled`, `no_show`

---

### 5.15 PosDraft

**Collection:** `posdrafts` | **File:** `models/PosDraft.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `createdBy` | ObjectId → User | yes | — |
| `ref` | String | — | auto-generated 5-digit |
| `orderNumber` | String | — | `''` |
| `items` | Array of {menuItemId, name, price, quantity, imageUrl} | — | — |
| `orderType` | String | — | `'DINE_IN'` |
| `customerName` / `customerPhone` / `deliveryAddress` | String | — | `''` |
| `subtotal` / `total` | Number | yes | — |
| `discountAmount` | Number | — | `0` |
| `itemNotes` | Map of String | — | `{}` |
| `tableNumber` / `tableName` / `selectedWaiter` | String | — | `''` |

---

### 5.16 UserBranch

**Collection:** `userbranches` | **File:** `models/UserBranch.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `user` | ObjectId → User | yes | — |
| `branch` | ObjectId → Branch | yes | — |
| `role` | String | — | `'manager'` |

---

### 5.17 SubscriptionRequest

**Collection:** `subscriptionrequests` | **File:** `models/SubscriptionRequest.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `planType` | String | — | — |
| `durationInDays` | Number | yes | — |
| `paymentScreenshot` | String | — | — |
| `paymentMethod` | ObjectId → PaymentMethod | — | — |
| `paymentMethodName` | String | — | — |
| `status` | String | — | `'pending'` |
| `approvedAt` / `rejectedAt` | Date | — | — |

---

### 5.18 PaymentMethod

**Collection:** `paymentmethods` | **File:** `models/PaymentMethod.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `name` | String | yes | — |
| `fields` | Array of {label, value} | — | — |
| `isActive` | Boolean | — | `true` |

---

### 5.19 Integration

**Collection:** `integrations` | **File:** `models/Integration.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `platform` | String | — | — |
| `storeId` | String | — | `''` |
| `apiKey` / `apiSecret` | String | — | `''` |
| `isActive` | Boolean | — | `false` |
| `lastSyncAt` | Date | — | `null` |

---

### 5.20 DailyCurrency

**Collection:** `dailycurrencies` | **File:** `models/DailyCurrency.js` | **Timestamps:** yes

| Field | Type | Required | Default |
|---|---|---|---|
| `restaurant` | ObjectId → Restaurant | yes | — |
| `branch` | ObjectId → Branch | — | `null` |
| `date` | String (YYYY-MM-DD) | yes | — |
| `quantities` | Mixed | — | `{}` |

---

### 5.21 Lead

**Collection:** `leads` | **File:** `models/Lead.js` | **Timestamps:** yes

| Field | Type | Required |
|---|---|---|
| `name` | String | yes |
| `phone` | String | yes |
| `email` | String | yes |
| `message` | String | yes |

---

## 6. Indexes & Uniqueness Constraints

### Model-Defined Compound Indexes

| Collection | Index Fields | Unique | Sparse | Notes |
|---|---|---|---|---|
| `branches` | `{restaurant, code}` | yes | yes | Branch code per restaurant |
| `orders` | `{restaurant, branch, orderNumber}` | yes | — | Order number per branch |
| `categories` | `{restaurant, branch, name}` | yes | — | Category name per branch |
| `menuitems` | `{restaurant, branch, name}` | yes | — | Item name per branch |
| `tables` | `{restaurant, branch, name}` | yes | — | Table name per branch |
| `inventoryitems` | `{restaurant, branch, name}` | yes | — | Inventory item per branch |
| `branchmenuitems` | `{branch, menuItem}` | yes | — | One override per item per branch |
| `branchinventories` | `{branch, inventoryItem}` | yes | — | One record per item per branch |
| `userbranches` | `{user, branch}` | yes | — | One assignment per user per branch |
| `dailycurrencies` | `{restaurant, branch, date}` | yes | — | One currency record per day per branch |
| `integrations` | `{restaurant, platform}` | yes | — | One integration per platform per restaurant |
| `deals` | `{restaurant, isActive, startDate, endDate}` | — | — | Query optimization |
| `deals` | `{branches}` | — | — | Query optimization |
| `deals` | `{dealType}` | — | — | Query optimization |
| `dealusages` | `{deal, customer}` | — | — | Query optimization |
| `reservations` | `{restaurant, date}` | — | — | Query optimization |
| `reservations` | `{branch, date}` | — | — | Query optimization |
| `posdrafts` | `{restaurant, branch, createdAt}` | — | — | Query optimization |
| `posdrafts` | `{createdBy, createdAt}` | — | — | Query optimization |
| `customers` | `{restaurant, branch, phone}` | — | — | **Not unique** — see §21 |

### Single-Field Unique Indexes

| Collection | Field | Notes |
|---|---|---|
| `users` | `email` | Global uniqueness |
| `restaurants` | `website.subdomain` | Global uniqueness |
| `posdrafts` | `ref` | Sparse unique |

### On-Connect Index Migrations (run every server start)

| Collection | Action |
|---|---|
| `tables` | Drop `restaurant_1_branch_1_tableNumber_1` (legacy) |
| `orders` | Drop `orderNumber_1` (replaced by compound) |
| `categories` | Drop `name_1` and `restaurant_1_name_1`; create `restaurant_1_branch_1_name_1` unique if missing |

---

## 7. Relationships & Referential Integrity

### Entity-Relationship Diagram (Logical)

```
Restaurant (1) ──────── (*) Branch
     │                        │
     │                        ├──── (*) Order
     │                        ├──── (*) Category
     │                        ├──── (*) MenuItem
     │                        ├──── (*) Table
     │                        ├──── (*) Customer
     │                        ├──── (*) InventoryItem
     │                        ├──── (*) BranchMenuItem
     │                        ├──── (*) BranchInventory
     │                        ├──── (*) Reservation
     │                        ├──── (*) PosDraft
     │                        └──── (*) DailyCurrency
     │
     ├──── (*) User
     ├──── (*) Deal ─── (*) DealUsage
     ├──── (*) Integration
     └──── (*) SubscriptionRequest

User (1) ────── (*) UserBranch ────── (1) Branch
```

### Referential Integrity

MongoDB does not enforce foreign keys. All relationships use Mongoose `ref` for `.populate()` but **there is no cascade delete or orphan cleanup**. Deleting a Restaurant does not automatically delete its Branches, Orders, MenuItems, etc.

**Key risk areas:**
- Deleting a `Category` leaves `MenuItem.category` pointing to a non-existent document.
- Deleting a `Branch` leaves `Order.branch`, `UserBranch.branch`, etc. as dangling references.
- Deleting a `MenuItem` leaves `Order.items[].menuItem` as a dangling reference (partially mitigated by the `name` snapshot field).
- Deleting a `User` leaves `Order.createdBy`, `PosDraft.createdBy` as dangling references.

---

## 8. Authentication & Authorization Data

### Password Storage
- **Algorithm:** bcrypt with 10 salt rounds
- **Storage:** `User.password` field (hashed)
- **Min length:** 6 characters (schema constraint)

### Token Strategy
- **JWT** signed with `JWT_SECRET` environment variable
- Token contains `{ id: user._id }` (decoded in `protect` middleware)
- Frontend stores token in `localStorage` (`restaurantos_auth` key) and a `token` cookie
- Refresh tokens are supported via `/api/auth/refresh`

### OTP Storage
- Email verification and password reset OTPs are stored directly on the `User` document (`emailVerificationOtp`, `resetPasswordOtp`)
- OTP expiration tracked via corresponding `*Expires` Date fields
- OTPs are stored as plain strings (not hashed) — see §20

### Role-Based Access Control

| Role | Scope | Description |
|---|---|---|
| `super_admin` | Platform-wide | Can act as any restaurant tenant |
| `restaurant_admin` | Restaurant-wide | Owner; full access to all branches |
| `admin` | Restaurant-wide | Full access to all branches |
| `manager` | Branch-scoped | Default role |
| `product_manager` | Branch-scoped | Menu/inventory management |
| `cashier` | Branch-scoped | POS operations |
| `kitchen_staff` | Branch-scoped | Kitchen display |
| `order_taker` | Branch-scoped | Order entry |
| `staff` | — | Legacy role, still in enum |

### Branch Access Control
- `UserBranch` model maps users to branches with per-branch roles
- `resolveBranch` middleware validates `x-branch-id` header against `UserBranch` assignments
- `restaurant_admin`, `admin`, and `super_admin` bypass branch checks

---

## 9. Multi-Tenancy Model

The system uses **shared database, single collection** multi-tenancy:

- Every tenant-scoped collection includes a `restaurant` field (ObjectId) to partition data.
- Most collections also include a `branch` field for sub-tenant scoping.
- The `requireRestaurant` middleware resolves the tenant from either:
  - `req.user.restaurant` (for authenticated tenant users)
  - `x-tenant-slug` header (for super_admin impersonation)
- Cross-tenant protection: the middleware verifies `x-tenant-slug` matches the user's restaurant subdomain.

**Tenant isolation depends entirely on application-level query filtering.** There are no database-level access controls or row-level security.

---

## 10. Soft-Delete Patterns

| Entity | Mechanism | Recovery Window |
|---|---|---|
| Restaurant | `isDeleted` + `deletedAt` fields | 48 hours (enforced by UI) |
| Branch | `isDeleted` + `deletedAt` fields | 48 hours (enforced by UI) |

- Soft-deleted records are excluded via query filters (e.g., `{ isDeleted: false }`) in route handlers.
- Permanent delete endpoints exist for super_admin only.
- Orders, MenuItems, Categories, Users, Customers, etc. use **hard delete** — no recoverability.

---

## 11. Data Validation

### Backend (Mongoose Schema Level)
- `required` fields enforced at write time
- `enum` constraints on status/type fields
- `min` / `minlength` on numeric and string fields
- `unique` indexes prevent duplicates

### Backend (Application Level)
- No validation library (Zod, Joi, Yup) is used
- Route handlers perform ad-hoc checks before writes
- No centralized validation middleware

### Frontend (Client-Side)
- Manual `if (!field.trim())` checks in form submit handlers
- No schema validation library

---

## 12. Migration Scripts

Located in `restaurnat-os-backend/scripts/`:

| Script | Purpose | Reversible |
|---|---|---|
| `migrate-order-statuses.js` | Renames statuses: `UNPROCESSED→NEW_ORDER`, `PENDING→PROCESSING`, `COMPLETED→DELIVERED` | Manual |
| `fix-super-admin-role.js` | Sets a specific user's role to `super_admin` by email | Manual |
| `drop-order-number-unique-index.js` | Drops global `orderNumber_1` index in favor of compound index | No |
| `fix-category-index.js` | Drops `name_1`, `restaurant_1_name_1`; creates `restaurant_1_branch_1_name_1` | Manual |
| `fix-null-branch-categories.js` | Removes categories/items/inventory where `branch: null` (supports `--dry-run`) | No |
| `migrate-branches.js` | Creates a default "Main" branch for restaurants that have none | No |

Additionally, `config/db.js` runs index migrations on every server startup (see §6).

**Note:** There is no formal migration framework (like `migrate-mongo`). Migrations are ad-hoc Node.js scripts.

---

## 13. Real-Time Layer (Socket.IO)

- Socket.IO server attached to the same HTTP server as Express.
- **Authentication:** JWT verified on socket handshake; user and restaurant resolved from DB.
- **Room structure:** Clients join rooms based on `restaurantId` and optional `branchId` (via `utils/socketRooms.js`).
- Used for real-time order notifications (new orders, status changes push to connected POS/kitchen clients).

---

## 14. API Surface (CRUD Operations)

### Route Modules

| Route File | Mount Path | Middleware Chain |
|---|---|---|
| `authRoutes` | `/api/auth` | None (public) |
| `adminRoutes` | `/api/admin` | protect → requireRestaurant → checkSubscriptionStatus → resolveBranch |
| `posRoutes` | `/api/pos` | protect → requireRestaurant → checkSubscriptionStatus → resolveBranch |
| `superAdminRoutes` | `/api/super` | protect → requireRole('super_admin') |
| `customerRoutes` | `/api` | Mixed (some public, some protected) |
| `dealRoutes` | `/api/deals` | Mixed |
| `menuRoutes` | `/api/menu` | Mixed |
| `integrationRoutes` | `/api/integrations` | protect → requireRestaurant |
| `subscriptionRoutes` | `/api/subscription` | protect → requireRestaurant (partially) |
| `profileRoutes` | `/api/profile` | protect |
| `uploadRoutes` | `/api/upload` | protect |
| `contactRoutes` | `/api` | None (public) |

### Key CRUD Endpoints

| Domain | Create | Read | Update | Delete |
|---|---|---|---|---|
| Orders | POST `/api/pos/orders` | GET `/api/admin/orders` | PUT `/api/admin/orders/:id` | DELETE `/api/admin/orders/:id` |
| Categories | POST `/api/admin/categories` | GET `/api/admin/menu` | PUT `/api/admin/categories/:id` | DELETE `/api/admin/categories/:id` |
| Menu Items | POST `/api/admin/items` | GET `/api/admin/menu` | PUT `/api/admin/items/:id` | DELETE `/api/admin/items/:id` |
| Users | POST `/api/admin/users` | GET `/api/admin/users` | PUT `/api/admin/users/:id` | DELETE `/api/admin/users/:id` |
| Branches | POST `/api/admin/branches` | GET `/api/admin/branches` | PUT `/api/admin/branches/:id` | DELETE `/api/admin/branches/:id` |
| Tables | POST `/api/admin/tables` | GET `/api/admin/tables` | PUT `/api/admin/tables/:id` | DELETE `/api/admin/tables/:id` |
| Customers | POST `/api/admin/customers` | GET `/api/admin/customers` | PUT `/api/admin/customers/:id` | DELETE `/api/admin/customers/:id` |
| Inventory | POST `/api/admin/inventory` | GET `/api/admin/inventory` | PUT `/api/admin/inventory/:id` | DELETE `/api/admin/inventory/:id` |
| Deals | POST `/api/admin/deals` | GET `/api/admin/deals` | PUT `/api/admin/deals/:id` | DELETE `/api/admin/deals/:id` |
| Reservations | (via admin) | (via admin) | (via admin) | (via admin) |
| Restaurants | POST `/api/super/restaurants` | GET `/api/super/restaurants` | — | DELETE `/api/super/restaurants/:id` |

---

## 15. Seed Data & Fixtures

**None.** There are no seed scripts, fixture files, or factory functions for development or testing data. A `migrate-branches.js` script creates a default "Main" branch, but this is a one-time migration, not a seed.

---

## 16. Caching & Performance

| Area | Status |
|---|---|
| Application-level cache | **None** (no Redis, Memcached, or in-memory cache) |
| Database-level cache | MongoDB's built-in WiredTiger cache (not configured) |
| Connection pool | Mongoose defaults (typically 5 connections) |
| Query optimization | `.lean()` on read routes, `.select()` for field projection |
| Pagination | Implemented via `skip` / `limit` on list endpoints |
| Aggregation | Not used anywhere in the codebase |

---

## 17. Audit Logging & Change Tracking

**Not implemented.** There is no:
- Audit trail for data modifications
- Change history for orders, menu items, or any entity
- Login/logout event logging to database
- Admin action logging

The `POS_API_DOCUMENTATION.md` mentions audit trail as a planned future feature.

---

## 18. Transactions

**Not used.** No Mongoose sessions or MongoDB transactions exist anywhere in the codebase. Operations that logically require atomicity (e.g., creating an order + decrementing inventory + recording deal usage) are performed as separate, non-transactional writes.

---

## 19. Backup & Disaster Recovery

**No backup strategy is documented or implemented in the codebase.** Data protection relies entirely on MongoDB Atlas's built-in backup features (if enabled on the cluster).

---

## 20. Security Findings & Recommendations

### Critical

| # | Finding | Risk | Recommendation |
|---|---|---|---|
| S1 | **`.env.example` contains real credentials** (Cloudinary API key/secret, SMTP password) | Credential exposure if repo is public or shared | Replace with dummy values immediately; rotate exposed credentials |
| S2 | **OTPs stored in plaintext** on User document | An attacker with DB read access can use OTPs for account takeover | Hash OTPs before storage (same as passwords) |
| S3 | **Integration API keys/secrets stored in plaintext** (`Integration.apiKey`, `Integration.apiSecret`) | DB compromise exposes third-party credentials | Encrypt at rest using an application-level encryption key |
| S4 | **No rate limiting** on authentication endpoints (login, OTP verification, password reset) | Brute-force attacks | Add rate limiting middleware (e.g., `express-rate-limit`) |

### High

| # | Finding | Risk | Recommendation |
|---|---|---|---|
| S5 | **JWT secret in environment variable** with no rotation mechanism | Long-lived secret; if compromised, all tokens are forgeable | Implement key rotation; consider asymmetric signing (RS256) |
| S6 | **No password complexity requirements** beyond `minlength: 6` | Weak passwords | Enforce complexity (uppercase, number, special character) |
| S7 | **Tenant isolation is application-level only** | A bug in query filtering could leak data across tenants | Add automated tests for tenant isolation; consider database-level isolation |
| S8 | **CORS set to `*` by default** for Socket.IO | Any origin can connect to WebSocket | Restrict to known frontend origins |

### Medium

| # | Finding | Risk | Recommendation |
|---|---|---|---|
| S9 | **No input sanitization** for NoSQL injection (e.g., `{ "$gt": "" }` in query params) | NoSQL injection | Use `mongo-sanitize` or similar middleware |
| S10 | **Token stored in localStorage** | XSS can steal tokens | Consider `httpOnly` cookie storage |

---

## 21. Data Integrity Findings & Recommendations

| # | Finding | Risk | Recommendation |
|---|---|---|---|
| D1 | **No cascade delete** — deleting a Restaurant/Branch/Category leaves orphaned documents across collections | Data bloat; broken `.populate()` calls; phantom references in UI | Implement cascade delete hooks or scheduled cleanup jobs |
| D2 | **No transactions** for multi-document operations (order + inventory + deal usage) | Race conditions; partial writes on failure (e.g., order created but inventory not decremented) | Use MongoDB transactions for atomic multi-document operations |
| D3 | **Customer phone index is not unique** (`{restaurant, branch, phone}` non-unique) | Duplicate customer records per branch | Make index unique (or add upsert logic) |
| D4 | **Legacy `staff` role still in User enum** | Ambiguous role assignment | Remove or map to a current role |
| D5 | **Duplicate subscription date fields** (legacy `trialStartsAt`/`trialEndsAt`/`expiresAt` + new `freeTrialStartDate`/`freeTrialEndDate`/`subscriptionStartDate`/`subscriptionEndDate`) | Confusion over which fields are authoritative | Migrate to new fields and remove legacy fields |
| D6 | **`subtotal`, `total`, `profit` computed client-side** and stored as-is | Clients can submit incorrect totals | Recalculate on the server before persisting |
| D7 | **No schema validation library** (Zod/Joi) on the backend | Invalid data can bypass Mongoose schema-level checks (e.g., extra fields, type coercion) | Add a validation layer at the API boundary |
| D8 | **Order items store `menuItem` as optional** (default `null`) | Orders can exist without traceable menu item references | Make required or ensure name snapshots are always present |

---

## 22. Performance Findings & Recommendations

| # | Finding | Risk | Recommendation |
|---|---|---|---|
| P1 | **Default connection pool size** (~5 connections) | Under high load, requests queue waiting for a connection | Configure `mongoose.connect()` with `maxPoolSize: 20+` based on load |
| P2 | **Index migrations run on every server start** | Adds latency to startup; redundant after first run | Use a migration runner with state tracking (e.g., `migrate-mongo`) |
| P3 | **No aggregation pipelines** — reports built from full document fetches | Inefficient for dashboard summaries and sales reports | Use `$group`, `$match`, `$project` aggregation stages |
| P4 | **No caching layer** | Every request hits MongoDB | Add Redis for frequently-read data (menu, categories, restaurant settings) |
| P5 | **No pagination on some list endpoints** | Large datasets returned in full | Ensure all list endpoints support `skip`/`limit` with cursor-based pagination |
| P6 | **`.populate()` chains without field projection** | Over-fetching nested documents | Add `.select()` to `.populate()` calls |

---

## 23. Operational Findings & Recommendations

| # | Finding | Risk | Recommendation |
|---|---|---|---|
| O1 | **No formal migration framework** | Ad-hoc scripts with no versioning or state tracking | Adopt `migrate-mongo` or similar; version-control all migrations |
| O2 | **No seed/fixture data** | Developers must manually set up test data | Create seed scripts for development and CI |
| O3 | **No automated tests** for database operations | Regressions undetected | Add integration tests with an in-memory MongoDB (e.g., `mongodb-memory-server`) |
| O4 | **No database monitoring or alerting** in the application | Performance degradation goes unnoticed | Integrate APM (e.g., Datadog, New Relic) or MongoDB Atlas monitoring |
| O5 | **No backup documentation** | Data loss risk if Atlas backups are not configured | Document backup strategy; verify Atlas continuous backup is enabled |
| O6 | **No audit logging** | Cannot trace who changed what and when | Add an audit log collection or integrate a logging service |
| O7 | **Backend directory name has a typo** (`restaurnat-os-backend` vs `restaurant-os-backend`) | Confusion in documentation and scripts | Rename the directory |

---

## Summary Statistics

| Metric | Count |
|---|---|
| **Collections** | 21 |
| **Unique indexes** | 11 |
| **Non-unique compound indexes** | 7 |
| **ObjectId references (relationships)** | 34 |
| **Migration scripts** | 6 |
| **Embedded sub-schemas** | 6 |
| **User roles** | 9 (including 1 legacy) |
| **Order statuses** | 5 |
| **Deal types** | 5 |

---

*End of audit report.*
