const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const users = require('./data/users');
const authenticateToken = require('./middleware/auth');
const { JWT_SECRET, JWT_EXPIRES_IN, SALT_ROUNDS } = require('./config');

const app = express();

// Parse incoming JSON request bodies into req.body
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'JWT Auth API is running' });
});

// ---------------------------------------------------------------
// POST /register
// Body: { "username": "alice", "password": "password123" }
// ---------------------------------------------------------------
app.post('/register', async (req, res) => {
  // TODO 1: Read username and password from req.body

  // TODO 2: If username or password is missing -> respond 400 { message: '...' }

  // TODO 3: If a user with this username already exists in `users`
  //         -> respond 409 { message: '...' }

  // TODO 4: Hash the password with bcrypt.hash(password, SALT_ROUNDS)
  //         (remember: bcrypt.hash returns a Promise -> use await)

  // TODO 5: Create a user object { id, username, password: <hash> }
  //         and push it into the `users` array.
  //         Every user must get a unique id.

  // TODO 6: Respond 201 with:
  //         { message: '...', user: { id, username } }
  //         Do NOT send the password (or the hash) back!

  res.status(501).json({ message: 'POST /register not implemented yet' });
});

// ---------------------------------------------------------------
// POST /login
// Body: { "username": "alice", "password": "password123" }
// ---------------------------------------------------------------
app.post('/login', async (req, res) => {
  // TODO 1: Read username and password from req.body

  // TODO 2: If username or password is missing -> respond 400 { message: '...' }

  // TODO 3: Find the user in `users` by username.
  //         If not found -> respond 401 { message: 'Invalid username or password' }

  // TODO 4: Compare the plain password with the stored hash using
  //         bcrypt.compare(password, user.password)
  //         If it does not match -> respond 401 with the SAME message as above

  // TODO 5: Create a payload { id, username } (NEVER put the password in it)
  //         and sign it: jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

  // TODO 6: Respond 200 with { message: '...', token }

  res.status(501).json({ message: 'POST /login not implemented yet' });
});

// ---------------------------------------------------------------
// GET /profile  (protected)
// Header: Authorization: Bearer <token>
// ---------------------------------------------------------------
app.get('/profile', authenticateToken, (req, res) => {
  // TODO: By the time this runs, authenticateToken has already verified the
  //       token and set req.user.
  //       Respond 200 with { message: '...', user: { id, username } }

  res.status(501).json({ message: 'GET /profile not implemented yet' });
});

module.exports = app;
