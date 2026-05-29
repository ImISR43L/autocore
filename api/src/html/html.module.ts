import { Module } from '@nestjs/common';
import { HtmlValidatorService } from './html-validator.service';

@Module({
  providers: [HtmlValidatorService],
  exports: [HtmlValidatorService],
})
export class HtmlModule {}
