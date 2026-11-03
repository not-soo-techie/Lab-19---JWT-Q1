// In-memory "database".
// Every registered user is pushed into this array as:
//   { id: Number, username: String, password: String (bcrypt hash) }
//
// NOTE: Data is lost whenever the server restarts. We will replace this
// with a real database in a later lab.
const users = [];

module.exports = users;
