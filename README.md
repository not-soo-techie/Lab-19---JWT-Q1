# Lab 19 – Q1: Token Based Authentication with JWT

## Objective

Build a small **Express.js** API that lets a user:

1. **Register** with a username and password (the password is **hashed** with `bcrypt` and stored in an in‑memory array).
2. **Log in** with those credentials and receive a **JSON Web Token (JWT)** in the response body.
3. Use that token as a **Bearer token** in the `Authorization` header to access a **protected route**.

By the end of this exercise you should understand the full lifecycle of token based authentication — from an incoming `POST` request to a verified, authenticated request.

---

## Background: How token based authentication works

```
 ┌────────┐   1. POST /register {username, password}          ┌────────┐
 │        │ ────────────────────────────────────────────────▶ │        │  hash password (bcrypt)
 │        │   201 { user: {id, username} }                    │        │  store in users[]
 │        │ ◀──────────────────────────────────────────────── │        │
 │        │                                                   │        │
 │ Client │   2. POST /login {username, password}             │ Server │  find user, bcrypt.compare
 │        │ ────────────────────────────────────────────────▶ │        │  jwt.sign({id, username})
 │        │   200 { token: "eyJhbGciOi..." }                  │        │
 │        │ ◀──────────────────────────────────────────────── │        │
 │        │                                                   │        │
 │        │   3. GET /profile                                 │        │  middleware:
 │        │      Authorization: Bearer eyJhbGciOi...          │        │  jwt.verify(token)
 │        │ ────────────────────────────────────────────────▶ │        │  req.user = payload
 │        │   200 { user: {id, username} }                    │        │
 │        │ ◀──────────────────────────────────────────────── │        │
 └────────┘                                                   └────────┘
```

**Key ideas**

| Concept | Why it matters |
|---|---|
| **Hashing (bcrypt)** | We never store plain‑text passwords. `bcrypt.hash()` turns `password123` into something like `$2a$10$N9qo8uLO...`. On login, `bcrypt.compare()` checks a plain password against the hash. |
| **JWT** | A signed string with three parts: `header.payload.signature`. The server signs it with a **secret**; anyone can *read* the payload, but nobody can *change* it without the secret. |
| **Stateless** | The server does not store sessions. Every request carries the token and the server just verifies the signature. |
| **Bearer token** | The client sends the token in the header: `Authorization: Bearer <token>`. |
| **Expiry (`exp`)** | Tokens should not live forever. We use `expiresIn: '1h'`. |

> ⚠️ The JWT payload is only **Base64URL encoded, not encrypted**. Never put passwords or other secrets in it.

---

## Project Structure

```
Q1/
├── package.json
├── README.md
├── src/
│   ├── app.js              ← 📝 TODO: /register, /login, /profile routes
│   ├── server.js           ← starts the server (do not change)
│   ├── config.js           ← JWT_SECRET, JWT_EXPIRES_IN, SALT_ROUNDS (do not change)
│   ├── data/
│   │   └── users.js        ← the in-memory users array (do not change)
│   └── middleware/
│       └── auth.js         ← 📝 TODO: authenticateToken middleware
└── tests/
    └── auth.test.js        ← automated tests (do not change)
```

You only need to edit **`src/app.js`** and **`src/middleware/auth.js`**. Each file contains numbered `TODO` comments that walk you through the steps.

---

## Setup

```bash
npm install        # install dependencies
npm run dev        # start the server with auto-reload on http://localhost:3000
npm test           # run the test suite
```

Packages already included:

- [`express`](https://expressjs.com/) – web framework
- [`bcryptjs`](https://www.npmjs.com/package/bcryptjs) – password hashing
- [`jsonwebtoken`](https://www.npmjs.com/package/jsonwebtoken) – create / verify JWTs
- [`jest`](https://jestjs.io/) + [`supertest`](https://www.npmjs.com/package/supertest) – testing

---

## Tasks

### Task 1 – `POST /register`

Register a new user.

**Request body**
```json
{ "username": "alice", "password": "password123" }
```

**Steps**
1. Read `username` and `password` from `req.body`.
2. If either is missing → **400**.
3. If a user with the same `username` already exists in `users` → **409**.
4. Hash the password using `await bcrypt.hash(password, SALT_ROUNDS)`.
5. Create `{ id, username, password: hashedPassword }` and `push` it into `users`. Every user needs a **unique** `id`.
6. Respond **201** — **without** the password.

**Responses**

| Status | When | Body |
|---|---|---|
| `201` | Success | `{ "message": "User registered successfully", "user": { "id": 1, "username": "alice" } }` |
| `400` | Missing username or password | `{ "message": "Username and password are required" }` |
| `409` | Username already taken | `{ "message": "Username already exists" }` |

---

### Task 2 – `POST /login`

Authenticate a user and return a JWT.

**Request body**
```json
{ "username": "alice", "password": "password123" }
```

**Steps**
1. Read `username` and `password` from `req.body`.
2. If either is missing → **400**.
3. Find the user by `username`. Not found → **401**.
4. Compare passwords with `await bcrypt.compare(password, user.password)`. No match → **401**.
5. Create a payload `{ id, username }` and sign it:
   ```js
   jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
   ```
6. Respond **200** with the token in the body.

> 💡 **Security tip:** Use the **same** error message for "user not found" and "wrong password" (e.g. `Invalid username or password`). Otherwise an attacker can find out which usernames exist. A test checks this.

**Responses**

| Status | When | Body |
|---|---|---|
| `200` | Success | `{ "message": "Login successful", "token": "<jwt>" }` |
| `400` | Missing username or password | `{ "message": "Username and password are required" }` |
| `401` | Unknown user **or** wrong password | `{ "message": "Invalid username or password" }` |

---

### Task 3 – `authenticateToken` middleware (`src/middleware/auth.js`)

This middleware runs **before** any protected route handler.

**Steps**
1. Read `req.headers['authorization']`. Missing → **401**.
2. The header must look like `Bearer <token>`. Split it on the space; if the first part is not exactly `Bearer` or the token is empty → **401**.
3. Verify the token with `jwt.verify(token, JWT_SECRET)` inside a `try/catch`. It throws if the token is tampered with, signed with another secret, expired or malformed → **403**.
4. On success, set `req.user = decoded` and call `next()`.

**Responses**

| Status | When | Body |
|---|---|---|
| `401` | No `Authorization` header | `{ "message": "Access denied. No token provided" }` |
| `401` | Header is not `Bearer <token>` | `{ "message": "Invalid authorization format. Use: Bearer <token>" }` |
| `403` | Token invalid, tampered or expired | `{ "message": "Invalid or expired token" }` |

> **401 vs 403** – In this lab, `401 Unauthorized` means *"you did not send credentials"* and `403 Forbidden` means *"you sent a token, but it is not valid"*.

---

### Task 4 – `GET /profile` (protected)

**Request header**
```
Authorization: Bearer <token from /login>
```

The route is already wired with the middleware: `app.get('/profile', authenticateToken, ...)`.
Use `req.user` (set by the middleware) to respond:

| Status | Body |
|---|---|
| `200` | `{ "message": "Profile fetched successfully", "user": { "id": 1, "username": "alice" } }` |

---

## Testing Your Solution

### Automated tests

```bash
npm test
```

All tests fail at the start. Each task you finish turns more of them green. The suite has **25 tests**:

| # | Area | What is checked |
|---|---|---|
| 1–8 | `POST /register` | 201 response, no password leaked, stored in `users`, **password is a bcrypt hash**, unique ids, 400 on missing fields, 409 on duplicate |
| 9–16 | `POST /login` | 200 + token, token is a valid JWT signed with `JWT_SECRET`, payload has `id`/`username` but **no password**, has `exp`, 401 on wrong password / unknown user, same error message for both, 400 on missing fields |
| 17–23 | `GET /profile` | 200 with valid Bearer token, 401 with no header / wrong scheme / empty token, 403 for tampered, wrong‑secret, expired and garbage tokens |
| 24–25 | Full flow | register → login → profile, and different users get their own identity |

To run only one group:
```bash
npx jest -t "POST /register"
npx jest -t "POST /login"
npx jest -t "GET /profile"
```

### Manual testing (curl / Postman / Thunder Client)

```bash
# 1. Register
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'

# 2. Login – copy the token from the response
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'

# 3. Access the protected route
curl http://localhost:3000/profile \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>"

# 4. Try without a token (should be 401)
curl -i http://localhost:3000/profile
```

💡 Paste your token into [jwt.io](https://jwt.io) to see its header and payload. You will see that **anyone can read it**, which is why the password must never be in it.

> Users are stored in memory, so restarting the server (or a nodemon reload) **wipes all users**. Register again after every restart.

---

## Hints

- Remember `app.use(express.json())`, otherwise `req.body` is `undefined` (already done for you).
- `bcrypt.hash` and `bcrypt.compare` return **Promises**, so use `await` inside an `async` route handler.
- `return` after sending a response (`return res.status(400).json(...)`) so the rest of the handler does not run.
- `Array.prototype.find()` is handy for looking up a user by username.
- `jwt.verify` **throws** on failure, so it does not return `null`. Use `try/catch`.

---

## Bonus Challenges (not tested)

1. Move `JWT_SECRET` into a `.env` file and load it with `dotenv`.
2. Add a minimum password length rule (e.g. 6 characters) on register.
3. Add a second protected route, e.g. `GET /dashboard`, that reuses the same middleware.
4. In `/profile`, look the user up in `users` by `req.user.id` and return **404** if they no longer exist.

---

## Submission Checklist

- [ ] `npm test` shows **25 passed**
- [ ] Passwords in `users` are hashed (never plain text)
- [ ] No password or hash in any response or JWT payload
- [ ] Protected route works with `Authorization: Bearer <token>`
