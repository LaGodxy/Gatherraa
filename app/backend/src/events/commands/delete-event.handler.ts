import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventWriteModel } from '../entities/event-write.entity';
import { EventReadModel } from '../entities/event-read.entity';
import { DeleteEventCommand } from './delete-event.command';
import { EventSourcingService } from '../services/event-sourcing.service';
import { ConcurrencyService } from '../services/concurrency.service';
import { EventAction } from '../entities/event-version.entity';

@CommandHandler(DeleteEventCommand)
export class DeleteEventHandler implements ICommandHandler<DeleteEventCommand> {
  constructor(
    @InjectRepository(EventWriteModel)
    private readonly writeModelRepository: Repository<EventWriteModel>,
    @InjectRepository(EventReadModel)
    private readonly readModelRepository: Repository<EventReadModel>,
    private readonly eventSourcingService: EventSourcingService,
    private readonly concurrencyService: ConcurrencyService,
  ) {}

  async execute(command: DeleteEventCommand): Promise<void> {
    const { id, userId, userName } = command;
    
    // Get existing event
    const existingEvent = await this.writeModelRepository.findOne({ where: { id } });
    if (!existingEvent) {
      throw new Error('Event not found');
    }

    // Soft delete write model
    existingEvent.isDeleted = true;
    existingEvent.concurrencyToken = this.concurrencyService.updateConcurrencyToken(existingEvent.concurrencyToken || '');
    await this.writeModelRepository.save(existingEvent);
    
    // Soft delete read model
    const readModel = await this.readModelRepository.findOne({ where: { id } });
    if (readModel) {
      readModel.isDeleted = true;
      readModel.lastActivityAt = new Date();
      await this.readModelRepository.save(readModel);
    }

    // Record event sourcing
    await this.eventSourcingService.recordEvent(
      id,
      EventAction.DELETED,
      { deletedAt: new Date() },
      userId,
      userName,
      existingEvent.version,
      existingEvent.concurrencyToken,
    );
  }
}