import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateEventCommand } from './commands/create-event.command';
import { UpdateEventCommand } from './commands/update-event.command';
import { DeleteEventCommand } from './commands/delete-event.command';
import { BulkCreateEventsCommand } from './commands/bulk-create-events.command';
import { CreateEventDto, UpdateEventDto, BulkCreateEventsDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async createEvent(dto: CreateEventDto, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new CreateEventCommand(dto, userId, userName),
    );
  }

  async updateEvent(id: string, dto: UpdateEventDto, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new UpdateEventCommand(id, dto, userId, userName),
    );
  }

  async deleteEvent(id: string, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new DeleteEventCommand(id, userId, userName),
    );
  }

  async bulkCreateEvents(dto: BulkCreateEventsDto, userId: string, userName?: string) {
    return await this.commandBus.execute(
      new BulkCreateEventsCommand(dto, userId, userName),
    );
  }

  async getEventById(id: string) {
    // This will be implemented with query handlers
    return { message: 'Query handler not implemented yet' };
  }

  async getEvents(query: any) {
    // This will be implemented with query handlers
    return { message: 'Query handler not implemented yet' };
  }

  async getEventsByOrganizer(organizerId: string, query: any) {
    // This will be implemented with query handlers
    return { message: 'Query handler not implemented yet' };
  }
}
