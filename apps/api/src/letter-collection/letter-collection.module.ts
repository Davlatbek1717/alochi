import { Module } from '@nestjs/common';
import { LetterCollectionService } from './letter-collection.service';
import { LetterCollectionController } from './letter-collection.controller';

@Module({
  providers: [LetterCollectionService],
  controllers: [LetterCollectionController],
  exports: [LetterCollectionService],
})
export class LetterCollectionModule {}
