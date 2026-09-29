import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import notificationRoutes from './routes/notification.routes';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { createRateLimiter } from './middleware/rate-limiter.middleware';
import { swaggerDocument } from './docs/swagger';
import { NotFoundError } from './utils/errors';

export function createApp(): Application {
  const app = express();

  // Core Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Structured Logging Middleware
  app.use(requestLogger);

  // Global API Rate Limiter (120 req / minute per IP / x-user-id)
  app.use(createRateLimiter(60 * 1000, 120));

  // Interactive OpenAPI / Swagger Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'Notification Inbox API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Root redirect/welcome
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
      message: 'V7 Notification Inbox API is running.',
      docs: '/api-docs',
      health: '/health',
    });
  });

  // Mount API Domain Routes
  app.use('/notifications', notificationRoutes);

  // Catch-all for undefined routes
  app.use((req: Request, res: Response, next) => {
    next(new NotFoundError(`Resource not found on path ${req.originalUrl}`));
  });

  // Centralized Error Handler (must be the last middleware)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
