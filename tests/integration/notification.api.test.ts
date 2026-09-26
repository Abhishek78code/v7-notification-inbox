import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { inMemoryStore } from '../../src/store/in-memory.store';
import { notificationService } from '../../src/services/notification.service';

describe('Notification Inbox API (Integration Tests)', () => {
  beforeEach(async () => {
    await inMemoryStore.clear();
  });

  describe('Authentication & Security Headers (Section 5.1)', () => {
    it('returns 401 Unauthorized when x-user-id header is missing', async () => {
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain("Missing or invalid 'x-user-id' header");
    });

    it('returns 401 Unauthorized when x-user-id header is whitespace only', async () => {
      const res = await request(app)
        .get('/notifications')
        .set('x-user-id', '   ');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /notifications (Listing, Pagination, Filtering, Sorting - Section 5.2)', () => {
    beforeEach(async () => {
      // Seed Alice with 4 notifications
      for (let i = 1; i <= 4; i++) {
        const notif = await notificationService.createNotification({
          userId: 'user-alice',
          kind: 'upload',
          title: `Alice Note ${i}`,
          body: `File ${i} uploaded`,
        });
        // Distribute timestamps for deterministic sorting check
        notif.createdAt = new Date(Date.now() + i * 1000).toISOString();
        await inMemoryStore.update(notif);
      }

      // Seed Bob with 2 notifications
      for (let i = 1; i <= 2; i++) {
        await notificationService.createNotification({
          userId: 'user-bob',
          kind: 'job',
          title: `Bob Job ${i}`,
          body: `Job ${i} completed`,
        });
      }
    });

    it("returns only current user's notifications (User A never sees User B's rows)", async () => {
      const res = await request(app)
        .get('/notifications')
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
      res.body.data.forEach((item: { userId: string }) => {
        expect(item.userId).toBe('user-alice');
      });

      const bobRes = await request(app)
        .get('/notifications')
        .set('x-user-id', 'user-bob');

      expect(bobRes.status).toBe(200);
      expect(bobRes.body.data.length).toBe(2);
      bobRes.body.data.forEach((item: { userId: string }) => {
        expect(item.userId).toBe('user-bob');
      });
    });

    it('sorts results newest first', async () => {
      const res = await request(app)
        .get('/notifications')
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(200);
      expect(res.body.data[0].title).toBe('Alice Note 4');
      expect(res.body.data[3].title).toBe('Alice Note 1');
    });

    it('supports pagination with page and limit query params', async () => {
      const res = await request(app)
        .get('/notifications?page=1&limit=2')
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 4,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      });

      const page2Res = await request(app)
        .get('/notifications?page=2&limit=2')
        .set('x-user-id', 'user-alice');

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data.length).toBe(2);
      expect(page2Res.body.pagination.hasNextPage).toBe(false);
      expect(page2Res.body.pagination.hasPrevPage).toBe(true);
    });

    it('caps limit at 50 even if a higher value is requested', async () => {
      const res = await request(app)
        .get('/notifications?limit=100')
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(50);
    });

    it('unread=true correctly hides already-read rows', async () => {
      // Mark one notification for Alice as read
      const listRes = await request(app)
        .get('/notifications')
        .set('x-user-id', 'user-alice');
      const targetId = listRes.body.data[0].id;

      await request(app)
        .post(`/notifications/${targetId}/read`)
        .set('x-user-id', 'user-alice');

      // Now query with unread=true
      const filteredRes = await request(app)
        .get('/notifications?unread=true')
        .set('x-user-id', 'user-alice');

      expect(filteredRes.status).toBe(200);
      expect(filteredRes.body.data.length).toBe(3);
      filteredRes.body.data.forEach((item: { readAt: string | null; id: string }) => {
        expect(item.readAt).toBeNull();
        expect(item.id).not.toBe(targetId);
      });
    });
  });

  describe('POST /notifications/:id/read (Mark as Read & Anti-IDOR - Section 5.3)', () => {
    it('marks notification as read if it exists and belongs to current user', async () => {
      const notif = await notificationService.createNotification({
        userId: 'user-alice',
        kind: 'alert',
        title: 'Security Alert',
        body: 'New login detected',
      });

      const res = await request(app)
        .post(`/notifications/${notif.id}/read`)
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it("returns 404 when attempting to mark another user's notification as read (Anti-IDOR)", async () => {
      const bobNotif = await notificationService.createNotification({
        userId: 'user-bob',
        kind: 'billing',
        title: 'Bob Invoice',
        body: 'Amount due: $500',
      });

      // User Alice tries to mark Bob's notification as read
      const res = await request(app)
        .post(`/notifications/${bobNotif.id}/read`)
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NotFound');
      expect(res.body.message).toBe('Notification not found');

      // Verify Bob's notification is still unread
      const bobStored = await inMemoryStore.findById(bobNotif.id);
      expect(bobStored?.readAt).toBeNull();
    });

    it('returns 404 when notification does not exist', async () => {
      const res = await request(app)
        .post('/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Notification not found');
    });
  });

  describe('POST /notifications/read-all (Section 5.4)', () => {
    it('marks all current user notifications as read without touching another user count', async () => {
      // Alice has 3 unread
      await notificationService.createNotification({ userId: 'user-alice', kind: 'k', title: 'A1', body: 'B' });
      await notificationService.createNotification({ userId: 'user-alice', kind: 'k', title: 'A2', body: 'B' });
      await notificationService.createNotification({ userId: 'user-alice', kind: 'k', title: 'A3', body: 'B' });

      // Bob has 2 unread
      await notificationService.createNotification({ userId: 'user-bob', kind: 'k', title: 'B1', body: 'B' });
      await notificationService.createNotification({ userId: 'user-bob', kind: 'k', title: 'B2', body: 'B' });

      // Alice triggers read-all
      const res = await request(app)
        .post('/notifications/read-all')
        .set('x-user-id', 'user-alice');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updatedCount).toBe(3);

      // Verify Alice has 0 unread
      const aliceCheck = await request(app)
        .get('/notifications?unread=true')
        .set('x-user-id', 'user-alice');
      expect(aliceCheck.body.data.length).toBe(0);

      // Verify Bob STILL has 2 unread notifications
      const bobCheck = await request(app)
        .get('/notifications?unread=true')
        .set('x-user-id', 'user-bob');
      expect(bobCheck.body.data.length).toBe(2);
    });
  });

  describe('Bonus Endpoints & Infrastructure', () => {
    it('GET /notifications/:id returns 200 for owned notification and 404 for other user', async () => {
      const aliceNotif = await notificationService.createNotification({
        userId: 'user-alice',
        kind: 'alert',
        title: 'Alice Special Note',
        body: 'Details here',
      });

      // Alice can fetch it
      const successRes = await request(app)
        .get(`/notifications/${aliceNotif.id}`)
        .set('x-user-id', 'user-alice');

      expect(successRes.status).toBe(200);
      expect(successRes.body.data.id).toBe(aliceNotif.id);

      // Bob receives 404 when trying to fetch Alice's notification
      const unauthorizedRes = await request(app)
        .get(`/notifications/${aliceNotif.id}`)
        .set('x-user-id', 'user-bob');

      expect(unauthorizedRes.status).toBe(404);
      expect(unauthorizedRes.body.error).toBe('NotFound');
    });

    it('GET /health returns 200 OK with service status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api-docs returns Swagger UI', async () => {
      const res = await request(app).get('/api-docs/');
      expect([200, 301, 302]).toContain(res.status);
    });
  });
});
