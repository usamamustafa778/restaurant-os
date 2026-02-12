# POS Transactions & Drafts API Documentation

## Overview
This document outlines the backend API requirements for the POS (Point of Sale) Transactions and Drafts feature. The system allows cashiers to view previous sales transactions, save orders as drafts, and manage both through a unified interface.

---

## API Endpoints

### 1. Transactions (Previous Sales)

#### GET /api/pos/transactions
Retrieve all completed sales transactions for the current user/branch.

**Headers:**
```
Authorization: Bearer {token}
x-tenant-slug: {tenantSlug}
x-branch-id: {branchId} (optional)
```

**Query Parameters:**
- `from` (optional): Start date (ISO 8601 format)
- `to` (optional): End date (ISO 8601 format)
- `status` (optional): Filter by status (e.g., "COMPLETED", "CANCELLED")

**Response:** `200 OK`
```json
[
  {
    "id": "trans_123",
    "_id": "trans_123",
    "ref": "23588",
    "orderNumber": "ORD-001",
    "items": [
      {
        "menuItemId": "item_1",
        "name": "Grilled Chicken",
        "price": 49.00,
        "quantity": 2,
        "imageUrl": "https://..."
      }
    ],
    "orderType": "DINE_IN",
    "paymentMethod": "CASH",
    "customerName": "Sue Allen",
    "customerPhone": "+1234567890",
    "deliveryAddress": "",
    "subtotal": 98.00,
    "total": 115.64,
    "discountAmount": 0,
    "tax": 17.64,
    "itemNotes": {},
    "tableNumber": "4",
    "selectedWaiter": "waiter_1",
    "status": "COMPLETED",
    "branchId": "branch_123",
    "restaurantId": "restaurant_123",
    "userId": "user_123",
    "createdAt": "2025-11-01T10:30:00Z",
    "updatedAt": "2025-11-01T10:30:00Z"
  }
]
```

---

#### GET /api/pos/transactions/:id
Retrieve a specific transaction by ID.

**Headers:** Same as above

**Response:** `200 OK`
```json
{
  "id": "trans_123",
  "ref": "23588",
  "orderNumber": "ORD-001",
  "items": [...],
  "orderType": "DINE_IN",
  "customerName": "Sue Allen",
  "total": 115.64,
  ...
}
```

---

#### DELETE /api/pos/transactions/:id
Delete a transaction (soft delete recommended).

**Headers:** Same as above

**Response:** `204 No Content` or
```json
{
  "message": "Transaction deleted successfully"
}
```

**Note:** Consider implementing soft delete by adding a `deletedAt` timestamp instead of permanently removing records.

---

### 2. Drafts (Pending Orders)

#### GET /api/pos/drafts
Retrieve all draft orders for the current user/branch.

**Headers:**
```
Authorization: Bearer {token}
x-tenant-slug: {tenantSlug}
x-branch-id: {branchId} (optional)
```

**Response:** `200 OK`
```json
[
  {
    "id": "draft_456",
    "_id": "draft_456",
    "ref": "23587",
    "orderNumber": null,
    "items": [
      {
        "menuItemId": "item_2",
        "name": "Chicken Taco",
        "price": 33.00,
        "quantity": 2,
        "imageUrl": "https://..."
      }
    ],
    "orderType": "TAKEAWAY",
    "customerName": "Frank Barrett",
    "customerPhone": "+1234567890",
    "deliveryAddress": "",
    "subtotal": 66.00,
    "total": 78.00,
    "discountAmount": 0,
    "itemNotes": {
      "item_2": "No onions"
    },
    "tableNumber": "",
    "selectedWaiter": "",
    "branchId": "branch_123",
    "restaurantId": "restaurant_123",
    "userId": "user_123",
    "createdAt": "2025-11-01T09:15:00Z",
    "updatedAt": "2025-11-01T09:15:00Z"
  }
]
```

---

#### POST /api/pos/drafts
Create a new draft order.

**Headers:** Same as above

**Request Body:**
```json
{
  "items": [
    {
      "menuItemId": "item_1",
      "name": "Grilled Chicken",
      "price": 49.00,
      "quantity": 2,
      "imageUrl": "https://..."
    }
  ],
  "orderType": "DINE_IN",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "deliveryAddress": "",
  "subtotal": 98.00,
  "total": 115.64,
  "discountAmount": 0,
  "itemNotes": {
    "item_1": "Extra sauce"
  },
  "tableNumber": "4",
  "selectedWaiter": "waiter_1",
  "branchId": "branch_123"
}
```

**Response:** `201 Created`
```json
{
  "id": "draft_789",
  "ref": "23589",
  "items": [...],
  "orderType": "DINE_IN",
  "customerName": "John Doe",
  "total": 115.64,
  "createdAt": "2025-11-01T11:00:00Z",
  ...
}
```

---

#### GET /api/pos/drafts/:id
Retrieve a specific draft by ID.

**Headers:** Same as above

**Response:** `200 OK`
```json
{
  "id": "draft_456",
  "ref": "23587",
  "items": [...],
  "orderType": "TAKEAWAY",
  "customerName": "Frank Barrett",
  "total": 78.00,
  ...
}
```

---

#### PUT /api/pos/drafts/:id
Update an existing draft.

**Headers:** Same as above

**Request Body:** Same structure as POST /api/pos/drafts

**Response:** `200 OK`
```json
{
  "id": "draft_456",
  "ref": "23587",
  "items": [...],
  "orderType": "TAKEAWAY",
  "customerName": "Frank Barrett",
  "total": 78.00,
  "updatedAt": "2025-11-01T11:30:00Z",
  ...
}
```

---

#### DELETE /api/pos/drafts/:id
Delete a draft order.

**Headers:** Same as above

**Response:** `204 No Content` or
```json
{
  "message": "Draft deleted successfully"
}
```

---

## Database Schema

### Transaction Schema (MongoDB Example)

```javascript
const posTransactionSchema = new Schema({
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true
  },
  branchId: {
    type: Schema.Types.ObjectId,
    ref: 'Branch',
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ref: {
    type: String,
    unique: true,
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  items: [{
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    imageUrl: String
  }],
  orderType: {
    type: String,
    enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'TABLE'],
    default: 'DINE_IN',
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['CASH', 'CARD', 'UPI', 'OTHER'],
    default: 'CASH',
    required: true
  },
  customerName: String,
  customerPhone: String,
  deliveryAddress: String,
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  itemNotes: {
    type: Map,
    of: String
  },
  tableNumber: String,
  selectedWaiter: String,
  status: {
    type: String,
    enum: ['COMPLETED', 'CANCELLED', 'REFUNDED'],
    default: 'COMPLETED'
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes
posTransactionSchema.index({ restaurantId: 1, createdAt: -1 });
posTransactionSchema.index({ branchId: 1, createdAt: -1 });
posTransactionSchema.index({ ref: 1 });
posTransactionSchema.index({ orderNumber: 1 });

// Auto-generate ref number
posTransactionSchema.pre('save', async function(next) {
  if (!this.ref) {
    this.ref = await generateUniqueTransactionRef();
  }
  next();
});
```

---

### Draft Schema (MongoDB Example)

```javascript
const posDraftSchema = new Schema({
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true
  },
  branchId: {
    type: Schema.Types.ObjectId,
    ref: 'Branch',
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ref: {
    type: String,
    unique: true,
    required: true
  },
  orderNumber: String,
  items: [{
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    imageUrl: String
  }],
  orderType: {
    type: String,
    enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'TABLE'],
    default: 'DINE_IN'
  },
  customerName: String,
  customerPhone: String,
  deliveryAddress: String,
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  itemNotes: {
    type: Map,
    of: String
  },
  tableNumber: String,
  selectedWaiter: String
}, {
  timestamps: true
});

// Indexes
posDraftSchema.index({ restaurantId: 1, createdAt: -1 });
posDraftSchema.index({ branchId: 1, createdAt: -1 });
posDraftSchema.index({ ref: 1 });

// Auto-generate ref number
posDraftSchema.pre('save', async function(next) {
  if (!this.ref) {
    this.ref = await generateUniqueDraftRef();
  }
  next();
});
```

---

## Reference Number Generation

### Implementation Example

```javascript
async function generateUniqueTransactionRef() {
  const prefix = "T";
  let ref;
  let exists = true;
  
  while (exists) {
    const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit number
    ref = `${prefix}${randomNum}`;
    exists = await PosTransaction.exists({ ref });
  }
  
  return ref;
}

async function generateUniqueDraftRef() {
  const prefix = "D";
  let ref;
  let exists = true;
  
  while (exists) {
    const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit number
    ref = `${prefix}${randomNum}`;
    exists = await PosDraft.exists({ ref });
  }
  
  return ref;
}
```

---

## Security & Authorization

### Authentication
- All endpoints require valid JWT token in Authorization header
- Token must contain `userId`, `restaurantId`, and `role`

### Authorization Rules
1. **Tenant Isolation**: Users can only access transactions/drafts from their own restaurant
2. **Branch Filtering**: If `x-branch-id` header is present, filter results by branch
3. **Role-Based Access**:
   - `CASHIER`: Can create, read, update, delete their own drafts and transactions
   - `MANAGER`: Can view all transactions/drafts in their branch
   - `OWNER`: Can view all transactions/drafts across all branches
   - `SUPER_ADMIN`: Can view all transactions/drafts (not recommended for production)

### Validation
- Validate all numeric fields (prices, quantities, totals)
- Ensure `items` array is not empty
- Verify referenced `menuItemId` exists and is active
- Check `branchId` belongs to the restaurant
- Sanitize all string inputs

---

## Business Logic

### When Creating a Transaction
1. Validate all menu items exist and are available
2. Verify prices match current menu prices (or allow override with note)
3. Calculate subtotal = sum(item.price × item.quantity)
4. Apply discount if provided
5. Calculate tax based on restaurant settings
6. Calculate total = subtotal - discount + tax
7. Generate unique reference number
8. Save to database with timestamp

### When Creating a Draft
1. Save order without payment processing
2. Allow partial information (customer details optional)
3. Generate unique reference number
4. Store all cart information including notes

### When Loading a Draft
1. Verify all menu items are still available
2. Check if prices have changed (notify user if needed)
3. Restore all saved information to cart
4. Clear draft after successful order placement (optional)

---

## Error Handling

### Common Error Responses

**401 Unauthorized**
```json
{
  "message": "Authentication required"
}
```

**403 Forbidden**
```json
{
  "message": "You don't have permission to access this resource"
}
```

**404 Not Found**
```json
{
  "message": "Transaction not found"
}
```

**400 Bad Request**
```json
{
  "message": "Invalid request data",
  "errors": [
    {
      "field": "items",
      "message": "Items array cannot be empty"
    }
  ]
}
```

**500 Internal Server Error**
```json
{
  "message": "An error occurred while processing your request"
}
```

---

## Performance Considerations

1. **Indexing**: Add indexes on:
   - `restaurantId` + `createdAt` (for listing)
   - `branchId` + `createdAt` (for branch-filtered listing)
   - `ref` (for quick lookups)
   - `userId` (for user-specific queries)

2. **Pagination**: Implement pagination for large result sets
   ```
   GET /api/pos/transactions?page=1&limit=50
   ```

3. **Caching**: Consider caching frequently accessed data

4. **Query Optimization**:
   - Use lean queries for list views
   - Populate only necessary fields
   - Limit result size

---

## Testing Checklist

### Transactions API
- [ ] GET all transactions returns correct data
- [ ] GET filtered by date range works
- [ ] GET specific transaction returns correct data
- [ ] DELETE transaction works and respects permissions
- [ ] Transactions are properly filtered by branch
- [ ] Pagination works correctly

### Drafts API
- [ ] GET all drafts returns correct data
- [ ] POST creates draft with unique ref
- [ ] PUT updates existing draft
- [ ] DELETE removes draft
- [ ] GET specific draft returns correct data
- [ ] Loading draft into cart works correctly

### Security
- [ ] Unauthenticated requests are rejected
- [ ] Users can only access their own restaurant data
- [ ] Branch filtering works correctly
- [ ] Role-based access control is enforced

### Edge Cases
- [ ] Empty items array is rejected
- [ ] Invalid menu item IDs are handled
- [ ] Duplicate ref numbers are prevented
- [ ] Large numbers don't cause overflow
- [ ] Special characters in notes are handled

---

## Migration Guide

If you have existing orders data:

1. **Create new collections**: `posTransactions` and `posDrafts`
2. **Migrate existing orders** to transactions collection
3. **Generate ref numbers** for existing records
4. **Add indexes** as specified above
5. **Update API routes** to use new endpoints
6. **Test thoroughly** before deploying to production

---

## Future Enhancements

1. **Bulk Operations**: Implement bulk delete for transactions
2. **Export**: Add CSV/Excel export functionality
3. **Analytics**: Add sales analytics endpoints
4. **Notifications**: Real-time notifications for new orders
5. **Webhooks**: Trigger webhooks on transaction completion
6. **Audit Trail**: Track all changes to transactions/drafts

---

## Support

For questions or issues, please contact the development team or refer to the main API documentation.

**Last Updated**: February 13, 2026
**Version**: 1.0.0
