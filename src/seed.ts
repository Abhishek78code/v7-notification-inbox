import { notificationService } from './services/notification.service';
import { inMemoryStore } from './store/in-memory.store';
import { logger } from './utils/logger';

/**
 * Demo Seed Script
 * Pre-populates the in-memory store with sample notifications for User Alice and User Bob.
 * Ideal for manual verification via Swagger UI or cURL.
 */
export async function seedDemoData(): Promise<void> {
  await inMemoryStore.clear();

  // Seed User Alice ("user-alice")
  const aliceNotifications = [
    {
      userId: 'user-alice',
      kind: 'file_uploaded',
      title: 'Dataset Upload Completed',
      body: 'Your dataset "medical_images_2026.zip" (1.4 GB) has been uploaded and scanned.',
      resourceType: 'dataset',
      resourceId: 'ds-101',
    },
    {
      userId: 'user-alice',
      kind: 'job_succeeded',
      title: 'Model Training Finished',
      body: 'ResNet50 training pipeline completed with 98.4% accuracy.',
      resourceType: 'training_job',
      resourceId: 'job-501',
    },
    {
      userId: 'user-alice',
      kind: 'billing_alert',
      title: 'Invoice Available',
      body: 'Your monthly usage invoice for September 2026 is ready for download.',
      resourceType: 'invoice',
      resourceId: 'inv-8802',
    },
    {
      userId: 'user-alice',
      kind: 'system_alert',
      title: 'Scheduled Maintenance Notice',
      body: 'Database maintenance is scheduled for Sunday at 02:00 UTC.',
    },
  ];

  // Seed User Bob ("user-bob")
  const bobNotifications = [
    {
      userId: 'user-bob',
      kind: 'job_failed',
      title: 'Batch Inference Failed',
      body: 'Out of memory error encountered during batch segmentation step 4.',
      resourceType: 'inference_job',
      resourceId: 'inf-902',
    },
    {
      userId: 'user-bob',
      kind: 'member_invited',
      title: 'Team Member Joined',
      body: 'Charlie has accepted your invitation to join Team Vision.',
    },
  ];

  console.log('🌱 Seeding demo notifications...');

  for (const n of aliceNotifications) {
    const created = await notificationService.createNotification(n);
    console.log(` Created for [Alice]: "${created.title}" (ID: ${created.id})`);
  }

  for (const n of bobNotifications) {
    const created = await notificationService.createNotification(n);
    console.log(` Created for [Bob]:   "${created.title}" (ID: ${created.id})`);
  }

  logger.info('Demo seed completed successfully');
  console.log('✅ Demo seed complete! Run tests or start server to interact.\n');
}

// Allow direct execution
if (require.main === module) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
