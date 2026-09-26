import { app } from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server successfully started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    swaggerDocs: `http://localhost:${PORT}/api-docs`,
    healthCheck: `http://localhost:${PORT}/health`,
  });
  console.log(`\n======================================================`);
  console.log(`🚀 Notification Inbox API is running on port ${PORT}`);
  console.log(`📖 Swagger API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`💚 Health Check:     http://localhost:${PORT}/health`);
  console.log(`======================================================\n`);
});

// Graceful shutdown handling
function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
