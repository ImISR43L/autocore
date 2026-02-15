import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  @IsNotEmpty()
  classroomId: string;

  @IsOptional()
  @IsArray()
  attachments?: any[];
}
