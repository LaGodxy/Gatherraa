import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { IsString, IsNumber, IsDate, IsEnum, IsObject } from 'class-validator';

export enum EventAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('event_versions')
export class EventVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  eventId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  @IsEnum(EventAction)
  action: EventAction;

  @Column({ type: 'simple-json' })
  @IsObject()
  payload: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  @IsObject()
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsString()
  userName?: string;

  @Column({ type: 'int' })
  @Index()
  version: number;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  concurrencyToken: string;

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}