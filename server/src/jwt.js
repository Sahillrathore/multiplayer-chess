const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES } = require("./config");

const sign = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
const verify = (token) => jwt.verify(token, JWT_SECRET);

module.exports = { sign, verify };
