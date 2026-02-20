import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, BulkCreateEventsDto, EventQueryDto } from './dto/event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createEvent(@Body() dto: CreateEventDto, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.createEvent(dto, userId, userName);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.updateEvent(id, dto, userId, userName);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(@Param('id') id: string, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.deleteEvent(id, userId, userName);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  async bulkCreateEvents(@Body() dto: BulkCreateEventsDto, @Query('userId') userId: string, @Query('userName') userName?: string) {
    return await this.eventsService.bulkCreateEvents(dto, userId, userName);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getEventById(@Param('id') id: string) {
    return await this.eventsService.getEventById(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getEvents(@Query() query: EventQueryDto) {
    return await this.eventsService.getEvents(query);
  }

  @Get('organizer/:organizerId')
  @UseGuards(JwtAuthGuard)
  async getEventsByOrganizer(@Param('organizerId') organizerId: string, @Query() query: EventQueryDto) {
    return await this.eventsService.getEventsByOrganizer(organizerId, query);
  }
}