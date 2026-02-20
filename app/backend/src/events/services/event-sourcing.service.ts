import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventVersion, EventAction } from '../entities/event-version.entity';

@Injectable()
export class EventSourcingService {
  private readonly logger = new Logger(EventSourcingService.name);

  constructor(
    @InjectRepository(EventVersion)
    private readonly eventVersionRepository: Repository<EventVersion>,
  ) {}

  async recordEvent(
    eventId: string,
    action: EventAction,
    payload: Record<string, any>,
    userId: string,
    userName?: string,
    version?: number,
    concurrencyToken?: string,
  ): Promise<EventVersion> {
    const eventVersion = new EventVersion();
    eventVersion.eventId = eventId;
    eventVersion.action = action;
    eventVersion.payload = payload;
    eventVersion.userId = userId;
    eventVersion.userName = userName;
    eventVersion.version = version || 1;
    eventVersion.concurrencyToken = concurrencyToken || this.generateConcurrencyToken();

    const savedEvent = await this.eventVersionRepository.save(eventVersion);
    this.logger.log(`Recorded event ${action} for event ${eventId} by user ${userId}`);
    
    return savedEvent;
  }

  async getEventHistory(eventId: string): Promise<EventVersion[]> {
    return await this.eventVersionRepository.find({
      where: { eventId },
      order: { timestamp: 'ASC' },
    });
  }

  async getVersion(eventId: string, version: number): Promise<EventVersion | null> {
    return await this.eventVersionRepository.findOne({
      where: { eventId, version },
    });
  }

  private generateConcurrencyToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}