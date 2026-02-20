import { ICommand } from '@nestjs/cqrs';
import { CreateEventDto } from '../dto/event.dto';

export class CreateEventCommand implements ICommand {
  constructor(
    public readonly dto: CreateEventDto,
    public readonly userId: string,
    public readonly userName?: string,
  ) {}
}