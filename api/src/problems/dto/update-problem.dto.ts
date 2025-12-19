// api/src/problems/dto/update-problem.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProblemDto } from './create-problem.dto';

export class UpdateProblemDto extends PartialType(CreateProblemDto) {}
