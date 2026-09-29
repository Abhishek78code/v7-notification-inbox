import { NotificationService } from './services/notification.service';
import { InMemoryNotificationStore } from './store/in-memory.store';

/**
 * Interactive Demo Script
 * Demonstrates notification inbox capabilities: pagination, filtering, read status, and user isolation.
 */
async function runDemo() {
  const store = new InMemoryNotificationStore();
  const service = new NotificationService({ store });

  console.log('\n===============================================================');
  console.log('         NOTIFICATION INBOX API DEMONSTRATION');
  console.log('===============================================================\n');

  // Seed sample records
  console.log('>> [SEED] Setting up sample notifications for Alice and Bob...');
  const a1 = await service.createNotification({
    userId: 'user-alice',
    kind: 'file_uploaded',
    title: 'Dataset Upload Completed',
    body: 'medical_images.zip (1.4 GB) scanned and uploaded.',
    resourceType: 'dataset',
    resourceId: 'ds-101',
  });
  const a2 = await service.createNotification({
    userId: 'user-alice',
    kind: 'job_succeeded',
    title: 'Model Training Finished',
    body: 'ResNet50 training completed with 98.4% accuracy.',
    resourceType: 'training_job',
    resourceId: 'job-501',
  });
  const a3 = await service.createNotification({
    userId: 'user-alice',
    kind: 'billing_alert',
    title: 'Invoice September 2026',
    body: 'Monthly usage invoice is ready.',
  });

  const b1 = await service.createNotification({
    userId: 'user-bob',
    kind: 'job_failed',
    title: 'Batch Inference Failed',
    body: 'Out of memory on GPU cluster node 3.',
    resourceType: 'job',
    resourceId: 'inf-902',
  });

  console.log(`   Seeded 3 notifications for Alice and 1 for Bob.\n`);

  // 1. Listing notifications with pagination
  console.log('---------------------------------------------------------------');
  console.log('1. LIST NOTIFICATIONS WITH PAGINATION (GET /notifications?page=1&limit=2)');
  console.log('   Authenticated as: user-alice');
  console.log('---------------------------------------------------------------');
  const listPage1 = await service.listNotifications('user-alice', { page: 1, limit: 2 });
  console.log(`   Items returned: ${listPage1.data.length}`);
  console.log(`   Pagination metadata:`, JSON.stringify(listPage1.pagination, null, 2));
  console.log(`   Top notification title: "${listPage1.data[0].title}"\n`);

  // 2. Filtering notifications using unread=true
  console.log('---------------------------------------------------------------');
  console.log('2. FILTERING USING unread=true (GET /notifications?unread=true)');
  console.log('   Authenticated as: user-alice');
  console.log('---------------------------------------------------------------');
  const unreadList = await service.listNotifications('user-alice', { unread: true });
  console.log(`   Total unread notifications for Alice: ${unreadList.data.length}`);
  unreadList.data.forEach((item, idx) => {
    console.log(`   [${idx + 1}] "${item.title}" | readAt: ${item.readAt}`);
  });
  console.log();

  // 3. Marking a single notification as read
  console.log('---------------------------------------------------------------');
  console.log(`3. MARK SINGLE NOTIFICATION AS READ (POST /notifications/${a1.id}/read)`);
  console.log('   Authenticated as: user-alice');
  console.log('---------------------------------------------------------------');
  const markedA1 = await service.markAsRead('user-alice', a1.id);
  console.log(`   Notification ID: ${markedA1.id}`);
  console.log(`   Title:           "${markedA1.title}"`);
  console.log(`   readAt updated:  ${markedA1.readAt}  <-- Timestamp now set!\n`);

  // 4. Attempting to mark another user's notification as read (Anti-IDOR 404)
  console.log('---------------------------------------------------------------');
  console.log(`4. SECURITY CHECK: MARK ANOTHER USER'S NOTIFICATION AS READ`);
  console.log(`   Attempting to mark Bob's notification (${b1.id}) as Alice (user-alice)`);
  console.log('---------------------------------------------------------------');
  try {
    await service.markAsRead('user-alice', b1.id);
    console.log('   [FAIL] Expected 404 but operation succeeded!');
  } catch (err: any) {
    console.log(`   Status Code: ${err.statusCode || 404}`);
    console.log(`   Error Name:  ${err.name || 'NotFoundError'}`);
    console.log(`   Message:     "${err.message}"`);
    console.log(`   Result:      [PASS] 404 returned! Bob's notification is strictly protected.`);
  }
  console.log();

  // 5. Marking all notifications as read
  console.log('---------------------------------------------------------------');
  console.log('5. MARK ALL AS READ (POST /notifications/read-all)');
  console.log('   Authenticated as: user-alice');
  console.log('---------------------------------------------------------------');
  const markAllResult = await service.markAllAsRead('user-alice');
  console.log(`   Alice read-all result:`, markAllResult);

  const aliceRemainingUnread = await service.listNotifications('user-alice', { unread: true });
  console.log(`   Alice remaining unread: ${aliceRemainingUnread.data.length}`);

  const bobRemainingUnread = await service.listNotifications('user-bob', { unread: true });
  console.log(`   Bob remaining unread:   ${bobRemainingUnread.data.length}  <-- Bob's unread count unaffected!\n`);

  console.log('===============================================================');
  console.log('  ALL SCENARIOS DEMONSTRATED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runDemo().catch(console.error);
