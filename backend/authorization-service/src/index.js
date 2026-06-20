require('dotenv').config({ path: require('path').resolve(__dirname, '../../..', '.env') });

const express = require('express');
const authorizationRoutes = require('./routes/authorization');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use('/api/authorization', authorizationRoutes);

app.listen(PORT, () => {
  console.log(`Authorization-Service läuft auf Port ${PORT}`);
});
