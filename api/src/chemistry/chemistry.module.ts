import { Module } from '@nestjs/common';
import { ChemistryService } from './chemistry.service';

@Module({
  providers: [ChemistryService],
  exports: [ChemistryService], // Exportamos para que o SubmissionsModule possa usá-lo
})
export class ChemistryModule {}
