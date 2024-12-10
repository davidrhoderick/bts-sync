import { Module } from '@nestjs/common';
import {
  GuidewireHashQuestionSet,
  SchemaHashQuestionSet,
  SyncCommand,
} from './sync/sync.command';

const ConfigProvider = {
  provide: 'config',
  useValue: {
    schemaRepo: 'git@github.com:davidrhoderick/bts-schema.git',
    guidewireRepo: 'git@github.com:davidrhoderick/bts-rest.git',
  },
};

@Module({
  providers: [
    SyncCommand,
    SchemaHashQuestionSet,
    GuidewireHashQuestionSet,
    ConfigProvider,
  ],
})
export class AppModule {}
