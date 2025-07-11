const express = require('express');
const morgan = require('morgan');
const app = express();

app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 5002;

app.get('/', (req, res) => res.send('✅ Beckn BAP is live'));

const routes = [
  'on_search', 'on_select', 'on_init', 'on_confirm',
  'on_status', 'on_track', 'on_cancel', 'on_support'
];

routes.forEach(route => {
  app.post(`/${route}`, (req, res) => {
    console.log(`[${route}]`, JSON.stringify(req.body, null, 2));
    res.status(200).send({ ack: { status: 'ACK' } });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 BAP network listening on port ${PORT}`);
});