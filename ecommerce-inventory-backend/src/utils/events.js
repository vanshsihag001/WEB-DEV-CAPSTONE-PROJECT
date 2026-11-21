const { EventEmitter } = require('events');

/**
 * Application-wide event bus (EventEmitter).
 * Purpose: decouple business logic (placing orders, changing stock) from side effects
 * (real-time notifications, logging). Controllers only emit events; listeners decide what to do.
 *
 * Events:
 *   order.placed         { order }
 *   order.statusChanged  { order, previousStatus, actorId }
 *   stock.low            { product }
 */
class AppEvents extends EventEmitter {}
module.exports = new AppEvents();
