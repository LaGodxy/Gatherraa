import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventReadModel } from '../entities/event-read.entity';

@Injectable()
export class MaterializedViewService {
  private readonly logger = new Logger(MaterializedViewService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EventReadModel)
    private readonly eventReadModelRepository: Repository<EventReadModel>,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshEventStatistics(): Promise<void> {
    this.logger.log('Refreshing event statistics materialized view...');
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update registered count statistics
      await queryRunner.query(`
        UPDATE events_read er
        SET registeredCount = (
          SELECT COUNT(*) 
          FROM registrations r 
          WHERE r.eventId = er.id 
          AND r.status = 'confirmed'
        )
        WHERE er.isDeleted = false
      `);

      // Update attendance count statistics
      await queryRunner.query(`
        UPDATE events_read er
        SET attendanceCount = (
          SELECT COUNT(*) 
          FROM attendances a 
          WHERE a.eventId = er.id 
          AND a.status = 'attended'
        )
        WHERE er.isDeleted = false
      `);

      // Update last activity timestamp
      await queryRunner.query(`
        UPDATE events_read er
        SET lastActivityAt = (
          SELECT MAX(created_at) 
          FROM (
            SELECT created_at FROM registrations WHERE eventId = er.id
            UNION ALL
            SELECT created_at FROM attendances WHERE eventId = er.id
            UNION ALL
            SELECT created_at FROM event_feedback WHERE eventId = er.id
          ) AS activities
        )
        WHERE er.isDeleted = false
      `);

      await queryRunner.commitTransaction();
      this.logger.log('Event statistics refresh completed successfully');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to refresh event statistics:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async refreshEventStatisticsForEvent(eventId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update registered count for specific event
      await queryRunner.query(`
        UPDATE events_read er
        SET registeredCount = (
          SELECT COUNT(*) 
          FROM registrations r 
          WHERE r.eventId = ? 
          AND r.status = 'confirmed'
        )
        WHERE er.id = ?
      `, [eventId, eventId]);

      // Update attendance count for specific event
      await queryRunner.query(`
        UPDATE events_read er
        SET attendanceCount = (
          SELECT COUNT(*) 
          FROM attendances a 
          WHERE a.eventId = ? 
          AND a.status = 'attended'
        )
        WHERE er.id = ?
      `, [eventId, eventId]);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to refresh statistics for event ${eventId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getEventStatistics(eventId: string): Promise<any> {
    const result = await this.dataSource.query(`
      SELECT 
        er.id,
        er.title,
        er.registeredCount,
        er.attendanceCount,
        er.capacity,
        ROUND((er.registeredCount * 100.0 / er.capacity), 2) as registrationRate,
        ROUND((er.attendanceCount * 100.0 / er.registeredCount), 2) as attendanceRate,
        er.lastActivityAt
      FROM events_read er
      WHERE er.id = ?
    `, [eventId]);

    return result[0] || null;
  }

  async getTopEventsByRegistration(limit: number = 10): Promise<any[]> {
    return await this.dataSource.query(`
      SELECT 
        er.id,
        er.title,
        er.organizerName,
        er.registeredCount,
        er.capacity,
        er.startDate,
        er.endDate
      FROM events_read er
      WHERE er.isDeleted = false 
      AND er.status = 'published'
      ORDER BY er.registeredCount DESC
      LIMIT ?
    `, [limit]);
  }
}