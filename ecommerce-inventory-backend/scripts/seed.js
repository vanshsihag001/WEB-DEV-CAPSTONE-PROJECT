/* Seed script:  npm run seed   |   npm run seed:destroy  */
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');

const PASSWORD = 'Password123';

(async () => {
  await connectDB();
  await Promise.all([User.deleteMany(), Category.deleteMany(), Product.deleteMany(), Cart.deleteMany(), Order.deleteMany()]);
  if (process.argv.includes('--destroy')) { console.log('All data removed'); return process.exit(0); }

  const [admin, seller1, seller2, cust1, cust2] = await Promise.all([
    User.create({ name: 'Admin User', email: 'admin@shop.com', password: PASSWORD, role: 'admin' }),
    User.create({ name: 'TechWorld Seller', email: 'seller1@shop.com', password: PASSWORD, role: 'seller' }),
    User.create({ name: 'Fashion Hub Seller', email: 'seller2@shop.com', password: PASSWORD, role: 'seller' }),
    User.create({ name: 'Asha Customer', email: 'customer1@shop.com', password: PASSWORD, role: 'customer' }),
    User.create({ name: 'Ravi Customer', email: 'customer2@shop.com', password: PASSWORD, role: 'customer' }),
  ]);

  const cats = await Category.create([
    { name: 'Electronics', description: 'Gadgets and devices' },
    { name: 'Fashion', description: 'Clothing and accessories' },
    { name: 'Books', description: 'Printed and digital books' },
    { name: 'Home & Kitchen', description: 'Appliances and decor' },
  ]);
  const [electronics, fashion, books, home] = cats;

  await Product.create([
    { name: 'Wireless Bluetooth Headphones', description: 'Noise cancelling over-ear headphones', price: 2499, category: electronics._id, seller: seller1._id, stock: 40 },
    { name: 'Smartphone 128GB', description: '6.5 inch AMOLED display smartphone', price: 15999, category: electronics._id, seller: seller1._id, stock: 15, lowStockThreshold: 5 },
    { name: 'USB-C Fast Charger 65W', description: 'GaN fast charger for laptops and phones', price: 1299, category: electronics._id, seller: seller1._id, stock: 4, lowStockThreshold: 5 },
    { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with blue switches', price: 3499, category: electronics._id, seller: seller1._id, stock: 25 },
    { name: 'Limited Edition Smartwatch', description: 'Only a few units available (good for concurrency tests)', price: 7999, category: electronics._id, seller: seller1._id, stock: 3, lowStockThreshold: 2 },
    { name: 'Cotton T-Shirt', description: 'Comfortable 100% cotton t-shirt', price: 499, category: fashion._id, seller: seller2._id, stock: 120 },
    { name: 'Denim Jacket', description: 'Classic blue denim jacket', price: 2199, category: fashion._id, seller: seller2._id, stock: 30 },
    { name: 'Running Shoes', description: 'Lightweight running shoes', price: 2999, category: fashion._id, seller: seller2._id, stock: 8 },
    { name: 'Node.js Design Patterns', description: 'Book on backend architecture with Node.js', price: 899, category: books._id, seller: seller2._id, stock: 50 },
    { name: 'Non-stick Cookware Set', description: '5 piece non-stick cookware set', price: 1999, category: home._id, seller: seller1._id, stock: 18 },
  ]);

  console.log('Seed complete. All accounts use password:', PASSWORD);
  console.table([admin, seller1, seller2, cust1, cust2].map((u) => ({ role: u.role, email: u.email })));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
