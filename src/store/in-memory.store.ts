import { NotificationRecord } from './notification.model';

/**
 * In-Memory Data Store for Notifications
 * Encapsulates all data persistence operations.
 * Designed with asynchronous signatures to mirror real production database repositories.
 */
export class InMemoryNotificationStore {
  // Primary index by notification ID for O(1) direct lookups
  private notifications: Map<string, NotificationRecord> = new Map();

  /**
   * Save a new notification record to memory
   */
  public async create(record: NotificationRecord): Promise<NotificationRecord> {
    // Clone to prevent external mutation
    const copy = { ...record };
    this.notifications.set(record.id, copy);
    return { ...copy };
  }

  /**
   * Find a notification by its unique ID
   */
  public async findById(id: string): Promise<NotificationRecord | null> {
    const record = this.notifications.get(id);
    if (!record) return null;
    return { ...record };
  }

  /**
   * Find all notifications belonging to a specific user
   */
  public async findByUserId(userId: string): Promise<NotificationRecord[]> {
    const results: NotificationRecord[] = [];
    for (const record of this.notifications.values()) {
      if (record.userId === userId) {
        results.push({ ...record });
      }
    }
    return results;
  }

  /**
   * Update an existing notification record
   */
  public async update(record: NotificationRecord): Promise<NotificationRecord> {
    const copy = { ...record };
    this.notifications.set(record.id, copy);
    return { ...copy };
  }

  /**
   * Batch update multiple notification records (e.g. mark-all-as-read)
   */
  public async updateMany(records: NotificationRecord[]): Promise<void> {
    for (const record of records) {
      this.notifications.set(record.id, { ...record });
    }
  }

  /**
   * Get total count across all records (for telemetry / debugging)
   */
  public async count(): Promise<number> {
    return this.notifications.size;
  }

  /**
   * Clear all records (useful for test isolation)
   */
  public async clear(): Promise<void> {
    this.notifications.clear();
  }
}

// Singleton instance for the application runtime
export const inMemoryStore = new InMemoryNotificationStore();
