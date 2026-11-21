const { io } = require('socket.io-client');
(async () => {
  const r = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seller1@shop.com', password: 'Password123' }),
  });
  const { data } = await r.json();
  const s = io('http://localhost:5000', { auth: { token: data.accessToken } });
  ['connected', 'order:new', 'order:status', 'stock:low']
    .forEach((e) => s.on(e, (d) => console.log(new Date().toLocaleTimeString(), e, JSON.stringify(d))));
})();