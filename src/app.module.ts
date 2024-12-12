import { Module } from '@nestjs/common';
import { SyncCommand } from './sync/sync.command';
import {
  GuidewireHashQuestionSet,
  SchemaHashQuestionSet,
  SyncTypeQuestionSet,
} from './sync/questions';
import { RepoService } from './sync/repo.service';

const ConfigProvider = {
  provide: 'config',
  useValue: {
    graphQLRepo: 'git@github.com:davidrhoderick/bts-apollo-server.git',
    pcRepo: 'git@github.com:davidrhoderick/bts-rest.git',
  },
};

@Module({
  providers: [
    {
      provide: 'REPO_SERVICE_FACTORY',
      useFactory: () => ({
        create: (repoUrl: string, folder: string, nickname: string) =>
          new RepoService(repoUrl, folder, nickname),
      }),
    },
    SyncCommand,
    SyncTypeQuestionSet,
    SchemaHashQuestionSet,
    GuidewireHashQuestionSet,
    ConfigProvider,
  ],
})
export class AppModule {}
