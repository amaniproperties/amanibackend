import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requireAdmin } from './middleware/admin-auth.js';
import { supabaseAdmin } from './db/supabase-admin.js';
import siteRoutes from './routes/site.routes.js';
import adminRoutes from './routes/admin.routes.js';
import adminLiveRoutes from './routes/admin-live.routes.js';

const app = express();

app.disable('x-powered-by');
const allowedOrigins = env.corsOrigins;
app.use(cors({
  origin(origin, callback) {
    if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('properties')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'amani-backend',
        port: env.port,
        database: 'connected',
        properties_count: count || 0,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: 'Amani backend is running but the database connection check failed',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

app.use('/api/site', siteRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);
app.get('/api/it', requireAdmin, (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Amani IT API',
      status: 'ok',
      source: 'Amani database base tables',
      endpoints: ['/resources', '/integrity', '/analytics', '/:resource', '/:resource/:id']
    }
  });
});
app.use('/api/it', requireAdmin, adminLiveRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((error, _req, res, _next) => {
  console.error('Amani backend error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? undefined : error.message
  });
});

const server = app.listen(env.port, () => {
  console.log(`Amani backend listening on http://localhost:${env.port}`);
  console.log(`Health: http://localhost:${env.port}/health`);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${env.port} is already in use. Stop the existing process or change PORT in E:\\amani-backend\\.env.`);
  } else if (error?.code === 'EACCES') {
    console.error(`Windows denied access to port ${env.port}. Choose a different PORT in E:\\amani-backend\\.env.`);
  } else {
    console.error('Amani backend failed to start:', error);
  }
  process.exitCode = 1;
});
