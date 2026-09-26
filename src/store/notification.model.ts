/**
 * Notification Data Model & Type Definitions
 * Specification compliant with Section 5.6 of the assessment
 */

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
  readAt: string | null; // ISO 8601 string when read, null when unread
  createdAt: string;     // ISO 8601 string
}

export interface CreateNotificationDTO {
  userId: string;
  kind: string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
}

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  unread?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
