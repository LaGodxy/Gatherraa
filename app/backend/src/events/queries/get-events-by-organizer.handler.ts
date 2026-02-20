import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventReadModel } from '../entities/event-read.entity';

export class GetEventsByOrganizerQuery {
  constructor(
    public readonly organizerId: string,
    public readonly filters: any,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}

@QueryHandler(GetEventsByOrganizerQuery)
export class GetEventsByOrganizerHandler implements IQueryHandler<GetEventsByOrganizerQuery> {
  constructor(
    @InjectRepository(EventReadModel)
    private readonly eventReadModelRepository: Repository<EventReadModel>,
  ) {}

  async execute(query: GetEventsByOrganizerQuery): Promise<{ events: EventReadModel[]; total: number }> {
    const { organizerId, filters, limit, offset } = query;
    
    const queryBuilder = this.eventReadModelRepository.createQueryBuilder('event');
    
    queryBuilder.where('event.organizerId = :organizerId', { organizerId })
                .andWhere('event.isDeleted = :isDeleted', { isDeleted: false });
    
    // Apply additional filters
    if (filters.status) {
      queryBuilder.andWhere('event.status = :status', { status: filters.status });
    }
    
    if (filters.type) {
      queryBuilder.andWhere('event.type = :type', { type: filters.type });
    }
    
    if (filters.isPublic !== undefined) {
      queryBuilder.andWhere('event.isPublic = :isPublic', { isPublic: filters.isPublic });
    }
    
    // Apply pagination
    queryBuilder.skip(offset).take(limit);
    
    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    queryBuilder.orderBy(`event.${sortBy}`, sortOrder);
    
    const [events, total] = await queryBuilder.getManyAndCount();
    
    return { events, total };
  }
}
