import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventWriteModel } from '../entities/event-write.entity';
import { EventReadModel } from '../entities/event-read.entity';
import { UpdateEventCommand } from './update-event.command';
import { EventSourcingService } from '../services/event-sourcing.service';
import { ConcurrencyService } from '../services/concurrency.service';
import { EventAction } from '../entities/event-version.entity';

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    @InjectRepository(EventWriteModel)
    private readonly writeModelRepository: Repository<EventWriteModel>,
    @InjectRepository(EventReadModel)
    private readonly readModelRepository: Repository<EventReadModel>,
    private readonly eventBus: EventBus,
    private readonly eventSourcingService: EventSourcingService,
    private readonly concurrencyService: ConcurrencyService,
  ) {}

  async execute(command: UpdateEventCommand): Promise<EventWriteModel> {
    const { id, dto, userId, userName } = command;
    
    // Get existing event
    const existingEvent = await this.writeModelRepository.findOne({ where: { id } });
    if (!existingEvent) {
      throw new Error('Event not found');
    }

    // Validate concurrency if token provided
    if (dto.concurrencyToken && existingEvent.concurrencyToken) {
      this.concurrencyService.validateConcurrencyToken(
        existingEvent.concurrencyToken,
        dto.concurrencyToken,
      );
    }

    // Update write model
    Object.assign(existingEvent, dto);
    delete existingEvent.concurrencyToken; // Remove from update data
    
    // Generate new concurrency token
    existingEvent.concurrencyToken = this.concurrencyService.updateConcurrencyToken(existingEvent.concurrencyToken || '');
    
    const updatedEvent = await this.writeModelRepository.save(existingEvent);
    
    // Update read model
    const readModel = await this.readModelRepository.findOne({ where: { id } });
    if (readModel) {
      Object.assign(readModel, {
        ...updatedEvent,
        version: updatedEvent.version,
        lastActivityAt: new Date(),
      });
      await this.readModelRepository.save(readModel);
    }

    // Record event sourcing
    await this.eventSourcingService.recordEvent(
      id,
      EventAction.UPDATED,
      dto,
      userId,
      userName,
      updatedEvent.version,
      updatedEvent.concurrencyToken,
    );

    return updatedEvent;
  }
}