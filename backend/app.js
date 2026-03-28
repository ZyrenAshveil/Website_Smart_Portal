const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const accessRoutes = require('./routes/accessRoutes');
const { verifyEntry } = require('./controllers/accessController');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/capture', express.static(path.join(__dirname, 'capture')));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Smart Gate backend is running' });
});

app.post('/verify-entry', verifyEntry);
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api', accessRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
