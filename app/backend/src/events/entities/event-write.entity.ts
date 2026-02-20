import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, VersionColumn, Index } from 'typeorm';
import { IsString, IsNumber, IsBoolean, IsDate, IsOptional, IsEnum, IsObject } from 'class-validator';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum EventType {
  CONFERENCE = 'conference',
  WORKSHOP = 'workshop',
  MEETUP = 'meetup',
  WEBINAR = 'webinar',
  NETWORKING = 'networking',
}

@Entity('events_write')
export class EventWriteModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  @IsEnum(EventType)
  type: EventType;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  category: string;

  @Column({ type: 'datetime' })
  @Index()
  startDate: Date;

  @Column({ type: 'datetime' })
  @Index()
  endDate: Date;

  @Column({ type: 'varchar', length: 200 })
  location: string;

  @Column({ type: 'simple-json', nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  organizerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @IsOptional()
  @IsNumber()
  price?: number;

  @Column({ type: 'int', default: 100 })
  @IsNumber()
  capacity: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  @IsEnum(EventStatus)
  status: EventStatus;

  @Column({ type: 'boolean', default: true })
  @Index()
  isPublic: boolean;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @Column({ type: 'simple-json', nullable: true })
  @IsOptional()
  @IsObject()
  tags?: string[];

  @Column({ default: false })
  @Index()
  isDeleted: boolean;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  concurrencyToken?: string;
}
