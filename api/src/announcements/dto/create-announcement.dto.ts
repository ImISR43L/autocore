import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @IsNotEmpty()
  classroomId: number;
}
