import { Module } from '@nestjs/common';
import { HtmlValidatorService } from './html-validator.service';
import { HtmlExecutorService } from './html-executor.service';

@Module({
  providers: [HtmlValidatorService, HtmlExecutorService],
  exports: [HtmlValidatorService, HtmlExecutorService],
})
export class HtmlModule {}
