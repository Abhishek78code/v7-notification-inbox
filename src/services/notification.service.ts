import { randomUUID } from 'crypto';
import {
  NotificationRecord,
  CreateNotificationDTO,
  ListNotificationsQuery,
  PaginatedResult,
} from '../store/notification.model';
import { InMemoryNotificationStore, inMemoryStore } from '../store/in-memory.store';
import { NotFoundError, ValidationError, TooManyRequestsError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface NotificationServiceOptions {
  store?: InMemoryNotificationStore;
  rateLimitMaxRequests?: number;
  rateLimitWindowMs?: number;
}

/**
 * Service Layer for Notification Operations.
 * Contains all business logic, authorization scoping, input validation, and pagination rules.
 * Controllers remain thin by delegating all logic here.
 */
export class NotificationService {
  private store: InMemoryNotificationStore;
  
  // Rate limiting tracker for internal createNotification calls
  private createRateLimits: Map<string, { count: number; windowStart: number }> = new Map();
  private readonly rateLimitMax: number;
  private readonly rateLimitWindowMs: number;

  constructor(options?: NotificationServiceOptions) {
    this.store = options?.store || inMemoryStore;
    this.rateLimitMax = options?.rateLimitMaxRequests ?? 100; // max 100 creations per window
    this.rateLimitWindowMs = options?.rateLimitWindowMs ?? 60 * 1000; // 1 minute window
  }

  /**
   * Internal Service Function — Not exposed as a public HTTP endpoint.
   * Invoked by background jobs or system events.
   * Validates input payload and enforces rate limiting.
   */
  public async createNotification(dto: CreateNotificationDTO): Promise<NotificationRecord> {
    // 1. Input Validation
    this.validateCreatePayload(dto);

    // 2. Rate Limiting on creation (per userId)
    this.checkCreateRateLimit(dto.userId);

    // 3. Construct Notification Record
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      id: randomUUID(),
      userId: dto.userId.trim(),
      kind: dto.kind.trim(),
      title: dto.title.trim(),
      body: dto.body.trim(),
      resourceType: dto.resourceType ? dto.resourceType.trim() : undefined,
      resourceId: dto.resourceId ? dto.resourceId.trim() : undefined,
      readAt: null, // New notifications are unread by definition
      createdAt: now,
    };

    // 4. Save to In-Memory Store
    const saved = await this.store.create(record);
    logger.info('Notification created', {
      notificationId: saved.id,
      userId: saved.userId,
      kind: saved.kind,
    });

    return saved;
  }

  /**
   * Validates create payload fields
   */
  private validateCreatePayload(dto: CreateNotificationDTO): void {
    if (!dto || typeof dto !== 'object') {
      throw new ValidationError('Payload must be a non-null object');
    }

    const errors: string[] = [];

    if (!dto.userId || typeof dto.userId !== 'string' || dto.userId.trim().length === 0) {
      errors.push('userId is required and must be a non-empty string');
    }

    if (!dto.kind || typeof dto.kind !== 'string' || dto.kind.trim().length === 0) {
      errors.push('kind is required and must be a non-empty string');
    }

    if (!dto.title || typeof dto.title !== 'string' || dto.title.trim().length === 0) {
      errors.push('title is required and cannot be empty');
    }

    if (!dto.body || typeof dto.body !== 'string' || dto.body.trim().length === 0) {
      errors.push('body is required and cannot be empty');
    }

    if (dto.resourceType !== undefined && (typeof dto.resourceType !== 'string' || dto.resourceType.trim().length === 0)) {
      errors.push('resourceType must be a non-empty string if provided');
    }

    if (dto.resourceId !== undefined && (typeof dto.resourceId !== 'string' || dto.resourceId.trim().length === 0)) {
      errors.push('resourceId must be a non-empty string if provided');
    }

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join('; ')}`, { errors });
    }
  }

  /**
   * Internal rate limiter to prevent spamming creation
   */
  private checkCreateRateLimit(userId: string): void {
    const now = Date.now();
    const entry = this.createRateLimits.get(userId);

    if (!entry || now - entry.windowStart > this.rateLimitWindowMs) {
      this.createRateLimits.set(userId, { count: 1, windowStart: now });
      return;
    }

    if (entry.count >= this.rateLimitMax) {
      logger.warn('Create rate limit exceeded for user', { userId });
      throw new TooManyRequestsError(
        `Rate limit exceeded: maximum ${this.rateLimitMax} notifications per ${this.rateLimitWindowMs / 1000}s allowed`
      );
    }

    entry.count += 1;
  }

  /**
   * List notifications for a specific user with mandatory pagination and sorting.
   * Strictly user-scoped: user A can never see user B's records.
   */
  public async listNotifications(
    userId: string,
    query: ListNotificationsQuery
  ): Promise<PaginatedResult<NotificationRecord>> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId is required for listing notifications');
    }

    const cleanUserId = userId.trim();

    // 1. Sanitize & clamp pagination parameters
    let page = Math.floor(Number(query.page));
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    let limit = Math.floor(Number(query.limit));
    if (isNaN(limit) || limit < 1) {
      limit = 10; // Default limit
    }
    // Cap limit at 50 to prevent DoS from excessive page sizes
    if (limit > 50) {
      limit = 50;
    }

    // 2. Fetch records strictly for this user (User isolation)
    let records = await this.store.findByUserId(cleanUserId);

    // 3. Filter by unread state if unread=true
    if (query.unread === true) {
      records = records.filter((item) => item.readAt === null);
    }

    // 4. Sort newest first (createdAt descending)
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 5. Mandatory pagination calculation
    const total = records.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = records.slice(startIndex, startIndex + limit);

    return {
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Mark a single notification as read.
   * Security / IDOR defense:
   * If the notification does not exist OR belongs to another user,
   * returns a 404 in both cases to avoid leaking data existence.
   */
  public async markAsRead(userId: string, notificationId: string): Promise<NotificationRecord> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId is required');
    }
    if (!notificationId || typeof notificationId !== 'string' || notificationId.trim().length === 0) {
      throw new ValidationError('notificationId is required');
    }

    const cleanUserId = userId.trim();
    const cleanId = notificationId.trim();

    const record = await this.store.findById(cleanId);

    // Return 404 if record doesn't exist OR belongs to a different user
    if (!record || record.userId !== cleanUserId) {
      logger.warn('Unauthorized or non-existent notification access attempt', {
        attemptedId: cleanId,
        requestingUser: cleanUserId,
        existsForAnotherUser: !!record,
      });
      throw new NotFoundError('Notification not found');
    }

    // If already marked as read, return as idempotent operation
    if (record.readAt === null) {
      record.readAt = new Date().toISOString();
      await this.store.update(record);
      logger.info('Notification marked as read', { notificationId: cleanId, userId: cleanUserId });
    }

    return record;
  }

  /**
   * Mark all notifications belonging to the current user as read.
   * Strictly affects only the caller's notifications.
   */
  public async markAllAsRead(userId: string): Promise<{ updatedCount: number; message: string }> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId is required');
    }

    const cleanUserId = userId.trim();
    const userRecords = await this.store.findByUserId(cleanUserId);
    const now = new Date().toISOString();
    const toUpdate: NotificationRecord[] = [];

    for (const record of userRecords) {
      if (record.readAt === null) {
        record.readAt = now;
        toUpdate.push(record);
      }
    }

    if (toUpdate.length > 0) {
      await this.store.updateMany(toUpdate);
    }

    logger.info('Marked all notifications as read for user', {
      userId: cleanUserId,
      updatedCount: toUpdate.length,
    });

    return {
      updatedCount: toUpdate.length,
      message: `Successfully marked ${toUpdate.length} notification(s) as read`,
    };
  }

  /**
   * Retrieve single notification by ID
   * Enforces tenant isolation: returns 404 for non-existent IDs or IDs belonging to another user.
   */
  public async getNotificationById(userId: string, notificationId: string): Promise<NotificationRecord> {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId is required');
    }
    if (!notificationId || typeof notificationId !== 'string' || notificationId.trim().length === 0) {
      throw new ValidationError('notificationId is required');
    }

    const cleanUserId = userId.trim();
    const cleanId = notificationId.trim();

    const record = await this.store.findById(cleanId);

    // Strict isolation: Return 404 if notification doesn't exist OR belongs to another user
    if (!record || record.userId !== cleanUserId) {
      throw new NotFoundError('Notification not found');
    }

    return record;
  }
}

export const notificationService = new NotificationService();
