# Sthirvaa Farms Shopping Module Documentation

## Overview

The shopping module for Sthirvaa Farms provides a complete e-commerce solution for selling:
- **Dairy Products**: Milk, Curd, Paneer, Ghee, Butter, Beverages
- **Fresh Vegetables**: Cucumber, Capsicum, Mushroom, Tomato, Onion, Bell Peppers
- **Divine Products**: Incense, Camphor, Dhoop, Spiritual Items, Crystals

---

## 📁 Module Structure

```
/shopping
├── ShoppingPage.tsx           # Main product catalog & shopping interface
├── ProductManagementPage.tsx  # Admin product management
├── OrdersPage.tsx             # Order tracking & history
└── README.md                  # This file
```

---

## ✨ Key Features

### 1. **Shopping Page** (`ShoppingPage.tsx`)
- **Product Catalog**: Browse all products by category
- **Category Filtering**: Dairy, Vegetables, Divine Products
- **Search Functionality**: Real-time product search
- **Sorting Options**:
  - Price (Low to High)
  - Price (High to Low)
  - Highest Rated
- **Shopping Cart**: Add/remove items, quantity adjustment
- **Favorites**: Mark products as favorites
- **Product Cards**: Display with ratings, reviews, descriptions
- **Cart Summary**: Real-time total calculation
- **Stats Dashboard**: Quick overview of cart, items, favorites, total

### 2. **Product Management** (`ProductManagementPage.tsx`)
- **Add Products**: Full product creation form
- **Edit Products**: Modify existing product details
- **Delete Products**: Remove products from catalog
- **Inventory Control**: Mark products as in/out of stock
- **Rating System**: Manage product ratings and reviews
- **Tags**: Add searchable tags to products
- **Category Management**: Organize by category and subcategory

### 3. **Orders Page** (`OrdersPage.tsx`)
- **Order History**: View all past orders
- **Order Tracking**: Real-time status updates
- **Order Timeline**: Visual progress indicator
- **Price Breakdown**: Detailed cost calculation
- **Delivery Information**: Address and contact details
- **Order Filtering**: Filter by status (pending, shipped, delivered, etc.)
- **Order Details Modal**: Comprehensive order information
- **Invoice Download**: Generate and download invoices
- **Statistics**: Total orders, spending, delivery status

---

## 🛍️ Product Categories & Examples

### Dairy & Milk (🥛)
```
- A2 Milk (1L) - ₹65
- Curd (500g) - ₹45
- Paneer (200g) - ₹120
- Ghee (250ml) - ₹380
- Butter (100g) - ₹140
- Lassi (500ml) - ₹50
```

### Fresh Vegetables (🥬)
```
- Cucumber (500g) - ₹25
- Capsicum Mix (250g) - ₹35
- Mushroom (250g) - ₹60
- Tomato Bundle (1kg) - ₹40
- Onion (1kg) - ₹30
- Bell Pepper Combo (500g) - ₹45
```

### Divine Products (🔥)
```
- Gulab Incense (50) - ₹120
- Camphor Tablets (100g) - ₹150
- Dhoop Stick (40) - ₹180
- Karungali Maalai - ₹450
- Crystal Ball (40mm) - ₹350
- Dhoopam Bundle Pack - ₹320
```

---

## 🔧 Installation & Setup

### 1. Copy Files to Project
```bash
# Copy all three main pages to your app directory
cp ShoppingPage.tsx /src/app/(dashboard)/shop/page.tsx
cp ProductManagementPage.tsx /src/app/(dashboard)/admin/products/page.tsx
cp OrdersPage.tsx /src/app/(dashboard)/orders/page.tsx
```

### 2. Update Next.js Routes
In your app router configuration, add:
```typescript
// app/shop/page.tsx → Shopping catalog
// app/admin/products/page.tsx → Product management
// app/orders/page.tsx → Order tracking
```

### 3. Add to Navigation
Update your main navigation to include:
```typescript
{
  href: '/shop',
  label: 'Shop',
  icon: ShoppingCart
},
{
  href: '/admin/products',
  label: 'Manage Products',
  icon: Package
},
{
  href: '/orders',
  label: 'My Orders',
  icon: ClipboardList
}
```

---

## 📊 API Integration

### Backend Endpoints Required

#### Shopping Endpoints
```typescript
GET /api/products
  └─ Returns list of all products
  └─ Query: ?category=dairy&search=milk

GET /api/products/:id
  └─ Returns single product details

POST /api/cart
  └─ Create new cart session
  └─ Body: { items: CartItem[] }

PUT /api/cart/:id
  └─ Update cart items
```

#### Product Management Endpoints
```typescript
GET /api/products
  └─ Returns all products (admin view)

POST /api/products
  └─ Create new product
  └─ Body: { Product }

PUT /api/products/:id
  └─ Update product
  └─ Body: { Product }

DELETE /api/products/:id
  └─ Delete product
```

#### Order Endpoints
```typescript
GET /api/orders
  └─ Returns user's orders
  └─ Query: ?status=delivered

GET /api/orders/:id
  └─ Returns order details

POST /api/orders
  └─ Create new order
  └─ Body: { items: CartItem[], deliveryAddress: Address }

PUT /api/orders/:id/status
  └─ Update order status (admin)
  └─ Body: { status: OrderStatus }
```

---

## 🎨 Styling & Customization

### Design System Used
- **Colors**: Purple/Violet primary, Green for success, Red for divine
- **Typography**: Black bold fonts for headings, medium for body
- **Spacing**: Consistent 12px base unit
- **Borders**: Soft gray borders with rounded corners (12px-24px)
- **Shadows**: Subtle shadows for depth

### CSS Variables (from main app)
```css
--brand: #7c3aed (Purple)
--brand-dark: #6d28d9
--surface: #f8fafc (Light gray)
--text: #1e293b (Dark)
--text3: #94a3b8 (Light gray text)
--border-custom: #e2e8f0
```

### Customization Examples

#### Change Primary Color
```typescript
// Replace all instances of 'bg-brand' with your color
className="bg-blue-600 hover:bg-blue-700"
```

#### Modify Product Icons
```typescript
{product.category === 'dairy' && '🥛'}
// Change to any emoji or custom icon
```

#### Adjust Grid Layout
```typescript
{/* Change grid columns in ProductCard grid */}
className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
```

---

## 🔐 Security Considerations

### Important Security Notes

1. **Authentication**
   - Ensure user is authenticated before showing orders
   - Validate user ownership of orders before displaying details

2. **Admin Routes**
   - Protect product management with admin role check
   - Verify admin privileges on backend

3. **Cart & Checkout**
   - Validate product prices on backend before processing
   - Implement CSRF protection for form submissions
   - Use HTTPS for all transactions

4. **Data Validation**
   ```typescript
   // Example: Validate price before submission
   if (product.price < 0 || product.price > 100000) {
     throw new Error('Invalid price');
   }
   ```

---

## 📱 Responsive Design

All components are fully responsive:
- **Mobile** (< 768px): Stacked layout, full-width inputs
- **Tablet** (768px - 1024px): 2-column grids, side navigation hidden
- **Desktop** (> 1024px): 3-4 column grids, sticky sidebar

Example breakpoints used:
```typescript
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
//       Mobile    Tablet       Desktop
```

---

## 🎯 State Management

### Using React Hooks
The module uses React hooks for state management:

```typescript
// Cart state
const [cart, setCart] = useState<CartItem[]>([]);

// Favorites
const [favorites, setFavorites] = useState<number[]>([]);

// UI states
const [showCart, setShowCart] = useState(false);
const [activeCategory, setActiveCategory] = useState('dairy');
```

### For Larger Apps: Integration with Pinia

If you're using Pinia (as in your main app):

```typescript
import { useShopStore } from '@/stores/shop.store';

export default function ShoppingPage() {
  const store = useShopStore();
  const { cart, favorites, addToCart, removeFromCart } = store;
  // ...
}
```

---

## 💳 Checkout Implementation

### Current Status
The module includes cart management and order display. To implement checkout:

1. **Add Checkout Page**
```typescript
// src/app/(dashboard)/checkout/page.tsx
export default function CheckoutPage() {
  // Delivery address form
  // Payment gateway integration (Razorpay, Stripe, etc.)
  // Order confirmation
}
```

2. **Payment Integration** (Recommended: Razorpay for India)
```typescript
const loadScript = (src) => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.onload = () => resolve(true);
    script.src = src;
    document.body.appendChild(script);
  });
};

const handlePayment = async () => {
  const res = await loadScript(
    "https://checkout.razorpay.com/v1/checkout.js"
  );
  
  const options = {
    key: process.env.RAZORPAY_KEY,
    amount: cartTotal * 100,
    currency: "INR",
    // ...
  };
  
  const rzp = new window.Razorpay(options);
  rzp.open();
};
```

---

## 🧪 Testing

### Example Test Cases

```typescript
// Test: Add to cart
test('should add product to cart', () => {
  const { getByText } = render(<ProductCard product={mockProduct} />);
  fireEvent.click(getByText('Add to Cart'));
  expect(cart).toContain(mockProduct);
});

// Test: Search functionality
test('should filter products by search query', () => {
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes('milk')
  );
  expect(filtered).toHaveLength(1);
});

// Test: Order total calculation
test('should calculate correct total with tax', () => {
  const subtotal = 100;
  const tax = 18;
  const total = subtotal + tax;
  expect(total).toBe(118);
});
```

---

## 📈 Performance Optimization

### Current Optimizations
- ✅ Memoized computations with `useMemo`
- ✅ Lazy-loaded components
- ✅ Optimized re-renders with proper dependencies

### Further Improvements
```typescript
// Use React.memo for product cards
const ProductCard = React.memo(function ProductCard(props) {
  return (/* ... */);
});

// Implement virtual scrolling for large product lists
import { FixedSizeList } from 'react-window';

// Image optimization
import Image from 'next/image';
<Image src={url} alt={name} width={400} height={400} />
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Cart not updating
- **Issue**: Items added but cart count not changing
- **Solution**: Check that cart state is being updated correctly in `handleAddToCart`
- **Code**: Ensure `setCart` is called with new array reference

#### 2. Filters not working
- **Issue**: Category filter not showing correct products
- **Solution**: Verify product category names match filter values
- **Code**: Add console.log to check filtered results

#### 3. Modal not closing
- **Issue**: Cart or detail modal stuck open
- **Solution**: Ensure `onClose` callback is properly wired
- **Code**: Add onClick handler to overlay background

#### 4. API calls failing
- **Issue**: Products not loading from backend
- **Solution**: 
  - Check API endpoint URLs
  - Verify CORS configuration
  - Check network tab in browser DevTools
  - Ensure API returns correct data format

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks
1. **Monthly**: Review product inventory accuracy
2. **Weekly**: Monitor order processing times
3. **Daily**: Check customer support messages

### Database Schema (Recommended)

```sql
-- Products table
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  subcategory VARCHAR(50),
  price DECIMAL(10, 2),
  unit VARCHAR(50),
  description TEXT,
  in_stock BOOLEAN,
  rating FLOAT,
  reviews INT,
  created_at TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
  id VARCHAR(20) PRIMARY KEY,
  user_id INT,
  items JSON,
  total DECIMAL(10, 2),
  status VARCHAR(20),
  delivery_address JSON,
  created_at TIMESTAMP
);

-- Cart table
CREATE TABLE cart_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  product_id INT,
  quantity INT,
  added_at TIMESTAMP
);
```

---

## 🚀 Future Enhancements

- [ ] Subscription service for regular deliveries
- [ ] Loyalty points system
- [ ] Product reviews and ratings from customers
- [ ] Wishlist functionality
- [ ] Payment gateway integration
- [ ] Real-time inventory tracking
- [ ] SMS/Email order notifications
- [ ] Admin dashboard with sales analytics
- [ ] Multi-location delivery support
- [ ] Seasonal product promotions

---

## 📄 License & Credits

Developed for Sthirvaa Farms - Premium Dairy & Spiritual Products Platform

Design System: Custom Tailwind CSS with consistent brand colors
Icons: Lucide React Icons
Components: React 18+ with TypeScript

---

## Version History

**v1.0.0** (Current)
- ✅ Product catalog with categories
- ✅ Shopping cart functionality
- ✅ Product management (admin)
- ✅ Order tracking
- ✅ Search and filter
- ✅ Favorites system
- ✅ Responsive design

---

For additional support or questions, please contact the development team.
