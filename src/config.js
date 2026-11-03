// Central configuration for the app.
// In a real project these values come from environment variables (.env file).
module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'lab19_super_secret_key',
  JWT_EXPIRES_IN: '1h',
  SALT_ROUNDS: 10,
};
