import { ICommand } from '@nestjs/cqrs';

export class UpdateEventCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly dto: any,
    public readonly userId: string,
    public readonly userName?: string,
    public readonly expectedVersion?: number,
  ) {}
}