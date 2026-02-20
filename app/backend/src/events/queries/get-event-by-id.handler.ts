import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventReadModel } from '../entities/event-read.entity';

export class GetEventByIdQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetEventByIdQuery)
export class GetEventByIdHandler implements IQueryHandler<GetEventByIdQuery> {
  constructor(
    @InjectRepository(EventReadModel)
    private readonly eventReadModelRepository: Repository<EventReadModel>,
  ) {}

  async execute(query: GetEventByIdQuery): Promise<EventReadModel> {
    const { id } = query;
    const event = await this.eventReadModelRepository.findOne({
      where: { id, isDeleted: false },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    return event;
  }
}
