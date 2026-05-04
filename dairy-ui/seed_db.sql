-- Clear existing data
DELETE FROM subscription_plan_items;
DELETE FROM subscription_plans;
DELETE FROM products;

-- Reset auto-increment
ALTER TABLE products AUTO_INCREMENT = 1;
ALTER TABLE subscription_plans AUTO_INCREMENT = 1;
ALTER TABLE subscription_plan_items AUTO_INCREMENT = 1;

-- Insert Products
INSERT INTO products (name, category, subcategory, price, unit, description, image_url, in_stock, rating, reviews) VALUES
('Sthirvaa A2 Gir Milk', 'dairy', 'Milk', 90, '1 Litre', 'Pure A2 milk from our Gir cows.', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400', 1, 5.0, 0),
('Organic Buffalo Curd', 'dairy', 'Curd', 65, '500g', 'Thick, creamy curd made from buffalo milk.', 'https://images.unsplash.com/photo-1628045610815-37cb420ba679?w=400', 1, 5.0, 0),
('Desi Cow Ghee', 'dairy', 'Ghee', 850, '500ml', 'Bilona method handmade ghee.', 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400', 1, 5.0, 0),
('Farm Fresh Eggs', 'dairy', 'Eggs', 120, '12 pcs', 'Free-range organic brown eggs.', 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400', 1, 5.0, 0),
('Premium Paneer', 'dairy', 'Paneer', 140, '250g', 'Soft, fresh paneer made daily.', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc0?w=400', 1, 5.0, 0),
('Fresh Chicken', 'meat', 'Chicken', 280, '1 kg', 'Tender, fresh chicken cut to order.', 'https://images.unsplash.com/photo-1587593810167-a84920ea0881?w=400', 1, 5.0, 0),
('Organic Tomatoes', 'vegetables', 'Veggies', 40, '1 kg', 'Pesticide-free red tomatoes.', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400', 1, 5.0, 0),
('Divine Pooja Pack', 'divine', 'Divine', 250, '1 Pack', 'Complete pooja essentials kit.', 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=400', 1, 5.0, 0);

-- Insert Subscription Plans (using actual DB columns: included_savings, original_price)
INSERT INTO subscription_plans (name, slug, tagline, monthly_price, price_per_month, badge_text, image_url, display_order, is_active, included_savings, original_price, created_at, updated_at) VALUES
('Essential Dairy Pack', 'essential-dairy-pack', '1 Litre Pure Milk Daily + 500ml Ghee', 1999, 1999, '₹66/day', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600', 1, 1, '460', 2459, NOW(), NOW()),
('Protein Pack', 'protein-pack', '1 Litre Milk Daily + 96 Eggs/month', 2499, 2499, '₹83/day', 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=600', 2, 1, '740', 3239, NOW(), NOW());

-- Insert Subscription Plan Items
INSERT INTO subscription_plan_items (plan_id, description, label, qty, unit, frequency, mrp, selling_price, created_at) VALUES
(1, '1 Litre Pure Milk Daily', 'Milk', 1, 'Litre', 'DAILY', 90, 66, NOW()),
(1, '500ml Ghee', 'Ghee', 500, 'ml', 'MONTHLY', 850, 850, NOW()),
(2, '1 Litre Milk Daily', 'Milk', 1, 'Litre', 'DAILY', 90, 83, NOW()),
(2, '96 Eggs/month', 'Eggs', 96, 'pcs', 'MONTHLY', 960, 960, NOW());
