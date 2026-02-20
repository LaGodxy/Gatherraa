import { ICommand } from '@nestjs/cqrs';
import { BulkCreateEventsDto } from '../dto/event.dto';

export class BulkCreateEventsCommand implements ICommand {
  constructor(
    public readonly dto: BulkCreateEventsDto,
    public readonly userId: string,
    public readonly userName?: string,
  ) {}
}