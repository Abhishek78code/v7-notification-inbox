import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

// Enforce authentication across all notification endpoints
router.use(authenticateUser);

/**
 * GET /notifications
 * List notifications with pagination and filtering
 */
router.get('/', notificationController.list);

/**
 * POST /notifications/read-all
 * Mark all notifications for the authenticated user as read
 * NOTE: Placed before /:id routes to avoid route collision with parameter matching
 */
router.post('/read-all', notificationController.markAllAsRead);

/**
 * POST /notifications/:id/read
 * Mark a single notification as read (returns 404 for other user's notification)
 */
router.post('/:id/read', notificationController.markAsRead);

/**
 * GET /notifications/:id (Bonus Endpoint)
 * Retrieve a specific notification by ID (returns 404 for other user's notification)
 */
router.get('/:id', notificationController.getById);

export default router;
