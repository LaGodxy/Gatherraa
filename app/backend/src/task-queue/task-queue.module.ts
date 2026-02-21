// Task Queue module
// Provides distributed task processing using BullMQ with Redis

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TaskQueueService } from './services/task-queue.service';
import { EmailProcessor } from './processors/email.processor';
import { ImageProcessor } from './processors/image.processor';
import { BlockchainProcessor } from './processors/blockchain.processor';
import { ScheduledTaskProcessor } from './processors/scheduled-task.processor';
import { TaskQueueController } from './task-queue.controller';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB') || 0,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          enableOfflineQueue: true,
        },
        settings: {
          // Global job settings
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
          },
          removeOnFail: false, // Keep failed jobs for analysis
        },
      }),
    }),
    // Register named queues
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'image-processing' },
      { name: 'blockchain-events' },
      { name: 'scheduled-tasks' },
      { name: 'notifications' },
      { name: 'analytics' },
      { name: 'dead-letter' },
    ),
  ],
  providers: [
    TaskQueueService,
    EmailProcessor,
    ImageProcessor,
    BlockchainProcessor,
    ScheduledTaskProcessor,
  ],
  controllers: [TaskQueueController],
  exports: [TaskQueueService, BullModule],
})
export class TaskQueueModule {}
