import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from '../../src/services/notification.service';
import { InMemoryNotificationStore } from '../../src/store/in-memory.store';
import { NotFoundError, ValidationError, TooManyRequestsError } from '../../src/utils/errors';

describe('NotificationService (Unit Tests)', () => {
  let store: InMemoryNotificationStore;
  let service: NotificationService;

  beforeEach(async () => {
    store = new InMemoryNotificationStore();
    service = new NotificationService({ store, rateLimitMaxRequests: 10, rateLimitWindowMs: 1000 });
    await store.clear();
  });

  describe('createNotification (Internal Service Function)', () => {
    it('successfully creates a notification with valid payload', async () => {
      const payload = {
        userId: 'user-alice',
        kind: 'job_succeeded',
        title: 'Training Complete',
        body: 'Model YOLOv8 trained in 45m',
        resourceType: 'training_job',
        resourceId: 'job-123',
      };

      const notification = await service.createNotification(payload);

      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(typeof notification.id).toBe('string');
      expect(notification.userId).toBe('user-alice');
      expect(notification.kind).toBe('job_succeeded');
      expect(notification.title).toBe('Training Complete');
      expect(notification.body).toBe('Model YOLOv8 trained in 45m');
      expect(notification.resourceType).toBe('training_job');
      expect(notification.resourceId).toBe('job-123');
      expect(notification.readAt).toBeNull();
      expect(notification.createdAt).toBeDefined();
      expect(new Date(notification.createdAt).getTime()).not.toBeNaN();
    });

    it('successfully creates notification without optional resourceType and resourceId', async () => {
      const payload = {
        userId: 'user-alice',
        kind: 'system_alert',
        title: 'System Notice',
        body: 'Scheduled update tonight',
      };

      const notification = await service.createNotification(payload);

      expect(notification.resourceType).toBeUndefined();
      expect(notification.resourceId).toBeUndefined();
      expect(notification.readAt).toBeNull();
    });

    it('rejects an invalid createNotification payload (missing required fields)', async () => {
      // @ts-expect-error Testing missing title and body
      await expect(service.createNotification({ userId: 'user-alice', kind: 'job' })).rejects.toThrow(
        ValidationError
      );
    });

    it('rejects payload with empty or whitespace-only title', async () => {
      await expect(
        service.createNotification({
          userId: 'user-alice',
          kind: 'job',
          title: '   ',
          body: 'Some body text',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects payload with empty or whitespace-only userId', async () => {
      await expect(
        service.createNotification({
          userId: '   ',
          kind: 'job',
          title: 'Title',
          body: 'Body',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects payload with empty or whitespace-only body', async () => {
      await expect(
        service.createNotification({
          userId: 'user-alice',
          kind: 'job',
          title: 'Title',
          body: '   ',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('enforces internal rate limiting on createNotification', async () => {
      // Configured max is 10 in beforeEach
      for (let i = 0; i < 10; i++) {
        await service.createNotification({
          userId: 'user-spam',
          kind: 'alert',
          title: `Alert ${i}`,
          body: 'Spam body',
        });
      }

      // 11th request should trigger rate limit error
      await expect(
        service.createNotification({
          userId: 'user-spam',
          kind: 'alert',
          title: 'Alert 11',
          body: 'Spam body',
        })
      ).rejects.toThrow(TooManyRequestsError);
    });
  });

  describe('listNotifications (User Scoping, Pagination, Sorting & Filtering)', () => {
    beforeEach(async () => {
      // Seed user-alice with 5 notifications at 100ms intervals to guarantee distinct createdAt timestamps
      for (let i = 1; i <= 5; i++) {
        const notif = await service.createNotification({
          userId: 'user-alice',
          kind: 'task',
          title: `Alice Task ${i}`,
          body: `Body ${i}`,
        });
        // Artificially space out timestamps to ensure deterministic sorting order
        notif.createdAt = new Date(Date.now() + i * 1000).toISOString();
        await store.update(notif);
      }

      // Seed user-bob with 3 notifications
      for (let i = 1; i <= 3; i++) {
        await service.createNotification({
          userId: 'user-bob',
          kind: 'task',
          title: `Bob Task ${i}`,
          body: `Bob Body ${i}`,
        });
      }
    });

    it("list returns only current user's notifications (User A never sees User B's rows)", async () => {
      const aliceResult = await service.listNotifications('user-alice', {});
      expect(aliceResult.data.length).toBe(5);
      aliceResult.data.forEach((item) => expect(item.userId).toBe('user-alice'));

      const bobResult = await service.listNotifications('user-bob', {});
      expect(bobResult.data.length).toBe(3);
      bobResult.data.forEach((item) => expect(item.userId).toBe('user-bob'));
    });

    it('results must be sorted newest first', async () => {
      const result = await service.listNotifications('user-alice', { limit: 10 });
      expect(result.data.length).toBe(5);

      // Verify strict descending order
      for (let i = 0; i < result.data.length - 1; i++) {
        const current = new Date(result.data[i].createdAt).getTime();
        const next = new Date(result.data[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
      expect(result.data[0].title).toBe('Alice Task 5');
    });

    it('paginates correctly and returns pagination metadata', async () => {
      const page1 = await service.listNotifications('user-alice', { page: 1, limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.pagination.total).toBe(5);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.limit).toBe(2);
      expect(page1.pagination.hasNextPage).toBe(true);
      expect(page1.pagination.hasPrevPage).toBe(false);

      const page2 = await service.listNotifications('user-alice', { page: 2, limit: 2 });
      expect(page2.data.length).toBe(2);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);
      expect(page2.pagination.hasNextPage).toBe(true);
      expect(page2.pagination.hasPrevPage).toBe(true);

      const page3 = await service.listNotifications('user-alice', { page: 3, limit: 2 });
      expect(page3.data.length).toBe(1);
      expect(page3.pagination.hasNextPage).toBe(false);
      expect(page3.pagination.hasPrevPage).toBe(true);
    });

    it('limit must be capped at 50, even if a higher value is requested', async () => {
      const result = await service.listNotifications('user-alice', { limit: 100 });
      expect(result.pagination.limit).toBe(50);
    });

    it('unread=true correctly hides already-read rows', async () => {
      // Mark first two notifications for alice as read
      const allAlice = await store.findByUserId('user-alice');
      allAlice[0].readAt = new Date().toISOString();
      allAlice[1].readAt = new Date().toISOString();
      await store.update(allAlice[0]);
      await store.update(allAlice[1]);

      // Unfiltered list returns all 5
      const unfiltered = await service.listNotifications('user-alice', {});
      expect(unfiltered.data.length).toBe(5);

      // Filtered list returns only 3 unread
      const unreadOnly = await service.listNotifications('user-alice', { unread: true });
      expect(unreadOnly.data.length).toBe(3);
      unreadOnly.data.forEach((item) => expect(item.readAt).toBeNull());
    });
  });

  describe('markAsRead (Single Notification)', () => {
    it('marks notification as read if it belongs to calling user', async () => {
      const notification = await service.createNotification({
        userId: 'user-alice',
        kind: 'file_uploaded',
        title: 'Upload complete',
        body: 'File data.csv uploaded',
      });

      expect(notification.readAt).toBeNull();

      const updated = await service.markAsRead('user-alice', notification.id);
      expect(updated.readAt).not.toBeNull();
      expect(typeof updated.readAt).toBe('string');

      // Verify in store
      const stored = await store.findById(notification.id);
      expect(stored?.readAt).toBe(updated.readAt);
    });

    it("marking another user's notification as read returns a 404 (NotFoundError)", async () => {
      // Create notification belonging to Bob
      const bobNotif = await service.createNotification({
        userId: 'user-bob',
        kind: 'alert',
        title: 'Bob Secret Alert',
        body: 'Sensitive internal details',
      });

      // Alice attempts to mark Bob's notification as read
      await expect(service.markAsRead('user-alice', bobNotif.id)).rejects.toThrow(NotFoundError);

      // Verify Bob's notification is still unread!
      const stored = await store.findById(bobNotif.id);
      expect(stored?.readAt).toBeNull();
    });

    it('marking non-existent notification ID returns a 404', async () => {
      await expect(service.markAsRead('user-alice', 'non-existent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('markAllAsRead (Bulk Update Scoping)', () => {
    it('"Mark all as read" does not change another user unread count', async () => {
      // Alice has 3 unread
      await service.createNotification({ userId: 'user-alice', kind: 'k1', title: 'A1', body: 'B1' });
      await service.createNotification({ userId: 'user-alice', kind: 'k2', title: 'A2', body: 'B2' });
      await service.createNotification({ userId: 'user-alice', kind: 'k3', title: 'A3', body: 'B3' });

      // Bob has 2 unread
      await service.createNotification({ userId: 'user-bob', kind: 'k1', title: 'B1', body: 'BB1' });
      await service.createNotification({ userId: 'user-bob', kind: 'k2', title: 'B2', body: 'BB2' });

      // Alice marks all as read
      const result = await service.markAllAsRead('user-alice');
      expect(result.updatedCount).toBe(3);

      // Verify Alice has 0 unread
      const aliceUnread = await service.listNotifications('user-alice', { unread: true });
      expect(aliceUnread.data.length).toBe(0);

      // Verify Bob's unread count is completely untouched (still 2)
      const bobUnread = await service.listNotifications('user-bob', { unread: true });
      expect(bobUnread.data.length).toBe(2);
      bobUnread.data.forEach((item) => expect(item.readAt).toBeNull());
    });
  });

  describe('getNotificationById (Bonus)', () => {
    it('returns notification if owned by current user', async () => {
      const notif = await service.createNotification({
        userId: 'user-alice',
        kind: 'kind',
        title: 'Title',
        body: 'Body',
      });

      const found = await service.getNotificationById('user-alice', notif.id);
      expect(found.id).toBe(notif.id);
    });

    it("returns 404 for another user's notification ID", async () => {
      const bobNotif = await service.createNotification({
        userId: 'user-bob',
        kind: 'kind',
        title: 'Title',
        body: 'Body',
      });

      await expect(service.getNotificationById('user-alice', bobNotif.id)).rejects.toThrow(NotFoundError);
    });
  });
});
