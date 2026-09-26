import { Request, Response, NextFunction } from 'express';
import { NotificationService, notificationService } from '../services/notification.service';

/**
 * Notification Controller
 * Thin HTTP presentation layer.
 * Strictly extracts request data, invokes the service layer, and formats the HTTP response.
 * All authorization, validation, scoping, and business rules remain in the Service Layer.
 */
export class NotificationController {
  private service: NotificationService;

  constructor(service: NotificationService = notificationService) {
    this.service = service;
  }

  /**
   * GET /notifications
   * List notifications for authenticated user with pagination and optional unread filter
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const unread = req.query.unread === 'true' ? true : undefined;

      const result = await this.service.listNotifications(userId, {
        page,
        limit,
        unread,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /notifications/:id/read
   * Mark a single notification as read
   */
  public markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const updated = await this.service.markAsRead(userId, id);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /notifications/read-all
   * Mark all notifications belonging to current user as read
   */
  public markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const result = await this.service.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: result.message,
        updatedCount: result.updatedCount,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /notifications/:id (Bonus)
   * Get single notification by ID (enforces 404 for other users' notifications)
   */
  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const notification = await this.service.getNotificationById(userId, id);

      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
