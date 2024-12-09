import { Module } from '@nestjs/common';
import {
  GuidewireHashQuestionSet,
  SchemaHashQuestionSet,
  SyncCommand,
} from './sync/sync.command';

const ConfigProvider = {
  provide: 'config',
  useValue: {
    defaultSyncType: 'frontend',
    schemaRepo: 'https://github.com/your-org/schema-repo.git',
    guidewireRepo: 'https://github.com/your-org/guidewire-repo.git',
  },
};

@Module({
  providers: [
    SyncCommand,
    SchemaHashQuestionSet,
    GuidewireHashQuestionSet,
    ConfigProvider, // Add the config provider
  ],
})
export class AppModule {}
