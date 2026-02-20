import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { EventWriteModel } from '../entities/event-write.entity';
import { EventReadModel } from '../entities/event-read.entity';
import { EventVersion, EventAction } from '../entities/event-version.entity';
import { CreateEventCommand } from './create-event.command';
import { EventCreatedEvent } from '../events/event-created.event';
import { EventSourcingService } from '../services/event-sourcing.service';
import { ConcurrencyService } from '../services/concurrency.service';

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    @InjectRepository(EventWriteModel)
    private readonly writeModelRepository: Repository<EventWriteModel>,
    @InjectRepository(EventReadModel)
    private readonly readModelRepository: Repository<EventReadModel>,
    private readonly eventBus: EventBus,
    private readonly eventSourcingService: EventSourcingService,
    private readonly concurrencyService: ConcurrencyService,
  ) {}

  async execute(command: CreateEventCommand): Promise<EventWriteModel> {
    const { dto, userId, userName } = command;
    
    // Create write model
    const writeModel = new EventWriteModel();
    Object.assign(writeModel, dto);
    
    // Generate ID if not provided
    if (!writeModel.id) {
      writeModel.id = randomUUID();
    }
    
    // Set organizer ID
    writeModel.organizerId = userId;
    
    // Generate concurrency token
    writeModel.concurrencyToken = this.concurrencyService.generateToken();
    
    // Save to write model
    const savedWriteModel = await this.writeModelRepository.save(writeModel);
    
    // Create and save read model
    const readModel = new EventReadModel();
    Object.assign(readModel, {
      ...savedWriteModel,
      organizerName: userName || 'Unknown',
      registeredCount: 0,
      attendanceCount: 0,
      version: 1,
      lastActivityAt: new Date(),
    });
    
    await this.readModelRepository.save(readModel);
    
    // Record event sourcing
    await this.eventSourcingService.recordEvent(
      savedWriteModel.id,
      EventAction.CREATED,
      { ...dto, organizerName: userName },
      userId,
      userName,
      1,
      savedWriteModel.concurrencyToken,
    );
    
    // Publish domain event
    this.eventBus.publish(
      new EventCreatedEvent(
        savedWriteModel.id,
        savedWriteModel.title,
        savedWriteModel.organizerId,
        savedWriteModel.startDate,
      ),
    );
    
    return savedWriteModel;
  }
}