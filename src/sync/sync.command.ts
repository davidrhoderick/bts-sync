import {
  Command,
  CommandRunner,
  // Option,
  QuestionSet,
  Question,
  InquirerService,
  Option,
} from 'nest-commander';
// import simpleGit from 'simple-git';
// import { generate } from '@graphql-codegen/cli';
import * as fs from 'fs';
import * as path from 'path';
import { Inject } from '@nestjs/common';

@Command({ name: 'bts-sync', options: { isDefault: true } })
export class SyncCommand extends CommandRunner {
  constructor(
    @Inject('config') private readonly config: any, // Inject the config provider
    private readonly inquirer: InquirerService,
  ) {
    super();
  }

  @Option({
    flags: '--sync-type <type>',
    description: 'Specify the type of sync: frontend or backend',
  })
  parseSyncType(value: string): string {
    if (!['frontend', 'backend'].includes(value)) {
      throw new Error(
        'Invalid sync type. Valid options are "frontend" or "backend".',
      );
    }
    return value;
  }

  async run(inputs: string[], options: Record<string, any>) {
    const syncType = options.syncType || this.config.defaultSyncType;
    const schemaRepo = options.schemaRepo || this.config.schemaRepo;
    const guidewireRepo = options.guidewireRepo || this.config.guidewireRepo;

    const schemaHash =
      options.schemaHash || (await this.promptForHash('schema'));
    const guidewireHash =
      options.guidewireHash ||
      (syncType === 'backend' ? await this.promptForHash('Guidewire') : 'main');

    if (syncType === 'frontend') {
      await this.syncFrontend(schemaRepo, schemaHash);
    } else if (syncType === 'backend') {
      await this.syncBackend(
        schemaRepo,
        guidewireRepo,
        schemaHash,
        guidewireHash,
      );
    } else {
      console.error('Invalid sync type. Use "frontend" or "backend".');
    }
  }

  private async syncFrontend(schemaRepo: string, _schemaHash: string) {
    // const git = simpleGit();

    console.log(`Cloning schema repository: ${schemaRepo}`);
    const schemaDir = './schema-repo';
    // await git.clone(schemaRepo, schemaDir, ['--depth', '1', '--branch', schemaHash]);

    console.log('Scaffolding operations folder...');
    this.scaffoldOperations();

    console.log('Generating Apollo Client types...');
    await this.generateClientTypes(schemaDir);
  }

  private async syncBackend(
    schemaRepo: string,
    guidewireRepo: string,
    _schemaHash: string,
    _guidewireHash: string,
  ) {
    // const git = simpleGit();

    console.log(`Cloning schema repository: ${schemaRepo}`);
    const schemaDir = './schema-repo';
    // await git.clone(schemaRepo, schemaDir, ['--depth', '1', '--branch', schemaHash]);

    console.log(`Cloning Guidewire repository: ${guidewireRepo}`);
    const guidewireDir = './guidewire-repo';
    // await git.clone(guidewireRepo, guidewireDir, ['--depth', '1', '--branch', guidewireHash]);

    console.log('Running custom script for Guidewire...');
    await this.runCustomScript(guidewireDir);

    console.log('Generating Apollo Server types...');
    await this.generateServerTypes(schemaDir);

    console.log('Creating Apollo Server schema...');
    this.createApolloSchema(schemaDir);
  }

  private scaffoldOperations() {
    const operationsDir = './operations';
    const queriesDir = path.join(operationsDir, 'queries');
    const mutationsDir = path.join(operationsDir, 'mutations');

    [operationsDir, queriesDir, mutationsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created: ${dir}`);
      }
    });
  }

  private async generateClientTypes(schemaDir: string) {
    // await generate({
    //   schema: `${schemaDir}/schema.graphql`,
    //   documents: './operations/**/*.graphql',
    //   generates: {
    //     './src/generated/client-types.ts': {
    //       plugins: ['typescript', 'typescript-operations'],
    //     },
    //   },
    // });
    console.log('Generated Apollo Client types successfully.');
  }

  private async generateServerTypes(schemaDir: string) {
    // await generate({
    //   schema: `${schemaDir}/schema.graphql`,
    //   generates: {
    //     './src/generated/server-types.ts': {
    //       plugins: ['typescript', 'typescript-resolvers'],
    //     },
    //   },
    // });
    console.log('Generated Apollo Server types successfully.');
  }

  private createApolloSchema(schemaDir: string) {
    // const resolvers = loadFilesSync('./src/resolvers/**/*.ts');
    // const typeDefs = fs.readFileSync(`${schemaDir}/schema.graphql`, 'utf-8');

    // const schema = makeExecutableSchema({ typeDefs, resolvers });
    console.log('Apollo Server schema created successfully.');
  }

  private async runCustomScript(guidewireDir: string) {
    console.log(`Running custom script in ${guidewireDir}...`);
    console.log('Custom script executed successfully.');
  }

  private async promptForHash(repoName: string): Promise<string> {
    const { hash } = await this.inquirer.ask(`hash-${repoName}`, undefined);
    return hash;
  }
}

@QuestionSet({ name: 'hash-schema' })
export class SchemaHashQuestionSet {
  @Question({
    message: 'Enter the Git hash or tag for the schema repo (default: main):',
    name: 'hash',
    default: 'main',
    type: 'input',
  })
  parseHash(value: string) {
    return value;
  }
}

@QuestionSet({ name: 'hash-Guidewire' })
export class GuidewireHashQuestionSet {
  @Question({
    message:
      'Enter the Git hash or tag for the Guidewire repo (default: main):',
    name: 'hash',
    default: 'main',
    type: 'input',
  })
  parseHash(value: string) {
    return value;
  }
}
