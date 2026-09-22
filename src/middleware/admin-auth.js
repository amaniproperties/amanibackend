import { env } from '../config/env.js';
import { fail } from '../utils/http.js';

export function requireAdmin(req, res, next) {
  if (!env.adminApiKey) {
    if (process.env.NODE_ENV === 'production') return fail(res, 503, 'Admin authentication is not configured');
    return next();
  }

  const suppliedKey = req.header('x-admin-api-key') || req.query.admin_key;

  if (suppliedKey !== env.adminApiKey) {
    return fail(res, 401, 'Unauthorized admin request');
  }

  return next();
}

