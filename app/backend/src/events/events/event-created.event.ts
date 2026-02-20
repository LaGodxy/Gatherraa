import { IEvent } from '@nestjs/cqrs';

export class EventCreatedEvent implements IEvent {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly organizerId: string,
    public readonly startDate: Date,
  ) {}
}