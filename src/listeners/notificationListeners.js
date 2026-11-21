const events = require('../utils/events');
const { emitToUser, emitToRole } = require('../utils/socket');

/**
 * Registers EventEmitter listeners that push real-time notifications through Socket.IO.
 *  order.placed        -> seller gets 'order:new', customer gets 'order:placed'
 *  order.statusChanged -> customer (and seller/admin) get 'order:status'
 *  stock.low           -> seller + admins get 'stock:low'
 */
module.exports = function registerListeners() {
  events.on('order.placed', ({ order }) => {
    const summary = { orderId: order._id, orderNumber: order.orderNumber, totalAmount: order.totalAmount, itemCount: order.items.length, status: order.status };
    emitToUser(order.seller, 'order:new', { message: `New order ${order.orderNumber}`, ...summary });
    emitToUser(order.customer, 'order:placed', { message: `Your order ${order.orderNumber} was placed`, ...summary });
    emitToRole('admin', 'order:new', summary);
    console.log(`[event] order.placed ${order.orderNumber}`);
  });

  events.on('order.statusChanged', ({ order, previousStatus }) => {
    const payload = {
      orderId: order._id, orderNumber: order.orderNumber, previousStatus, status: order.status,
      message: `Order ${order.orderNumber} is now ${order.status}`,
    };
    emitToUser(order.customer, 'order:status', payload);
    emitToUser(order.seller, 'order:status', payload);
    console.log(`[event] order.statusChanged ${order.orderNumber}: ${previousStatus} -> ${order.status}`);
  });

  events.on('stock.low', ({ product }) => {
    const payload = {
      productId: product._id, name: product.name, stock: product.stock, threshold: product.lowStockThreshold,
      message: product.stock === 0 ? `${product.name} is OUT OF STOCK` : `Low stock: ${product.name} (${product.stock} left)`,
    };
    emitToUser(product.seller, 'stock:low', payload);
    emitToRole('admin', 'stock:low', payload);
    console.log(`[event] stock.low ${product.name} -> ${product.stock}`);
  });
};
