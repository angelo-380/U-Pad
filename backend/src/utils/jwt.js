import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_upad_fallback_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Genera un token JWT firmado con los datos del usuario.
 * @param {Object} payload { id, email, rol, organizacionId }
 * @returns {string} Token JWT
 */
export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verifica y decodifica un token JWT.
 * @param {string} token
 * @returns {Object} Payload decodificado
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
