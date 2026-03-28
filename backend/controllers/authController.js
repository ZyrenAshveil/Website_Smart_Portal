const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createMysqlConnection } = require('../config/database');
const env = require('../config/env');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    env.jwtSecret,
    { expiresIn: '12h' }
  );
}

async function register(req, res, next) {
  let connection;

  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    }

    connection = await createMysqlConnection();
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Username or email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      'INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, NOW())',
      [username, email, hashedPassword]
    );

    const user = { id: result.insertId, username, email };
    const token = signToken(user);

    return res.status(201).json({ success: true, token, user });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function login(req, res, next) {
  let connection;

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    connection = await createMysqlConnection();
    const [rows] = await connection.execute(
      'SELECT id, username, email, password FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

module.exports = {
  register,
  login
};
