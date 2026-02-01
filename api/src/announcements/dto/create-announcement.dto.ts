import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNotEmpty()
  @IsUUID()
  classroomId: string;
}
