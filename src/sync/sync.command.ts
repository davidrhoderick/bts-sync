import {
  Command,
  CommandRunner,
  QuestionSet,
  Question,
  InquirerService,
  Option,
} from 'nest-commander';
import simpleGit from 'simple-git';
import { generate } from '@graphql-codegen/cli';
import * as fs from 'fs';
import * as path from 'path';
import { Inject, Logger } from '@nestjs/common';
import openapiTS from 'openapi-typescript';
import * as ts from 'typescript';
import ora from 'ora';

@Command({ name: 'bts-sync', options: { isDefault: true } })
export class SyncCommand extends CommandRunner {
  private readonly logger = new Logger(SyncCommand.name);

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
    let syncType = options.syncType || this.config.defaultSyncType;
    if (!syncType) {
      syncType = await this.promptForSyncType();
    }

    const schemaRepo = options.schemaRepo || this.config.schemaRepo;
    const guidewireRepo = options.guidewireRepo || this.config.guidewireRepo;

    const schemaHash =
      options.schemaHash ||
      (await this.promptForHash('schema')) ||
      (await this.getLatestCommitHash(schemaRepo));
    const guidewireHash =
      options.guidewireHash ||
      (syncType === 'backend' ? await this.promptForHash('Guidewire') : null) ||
      (await this.getLatestCommitHash(guidewireRepo));

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
      this.logger.error('Invalid sync type. Use "frontend" or "backend".');
    }
  }

  private async syncFrontend(schemaRepo: string, schemaHash: string) {
    const spinner = ora('Cloning schema repository...').start();
    const schemaDir = './schema-repo';
    try {
      await simpleGit().clone(schemaDir, schemaDir, [
        '--depth',
        '1',
        '--branch',
        'main',
      ]);
      await simpleGit(schemaDir).checkout(schemaHash);
      spinner.succeed('Cloned schema repository.');

      this.logger.log('Scaffolding operations folder...');
      this.scaffoldOperations();

      this.logger.log('Generating Apollo Client types...');
      await this.generateClientTypes(schemaDir);
    } catch (error) {
      spinner.fail('Failed to clone schema repository.');
      this.logger.error(error);
    } finally {
      fs.rmSync(schemaDir, { recursive: true, force: true });
    }
  }

  private async syncBackend(
    schemaRepo: string,
    guidewireRepo: string,
    schemaHash: string,
    guidewireHash: string,
  ) {
    const spinner = ora('Cloning repositories...').start();
    const schemaDir = './schema-repo';
    const guidewireDir = './guidewire-repo';

    try {
      await simpleGit().clone(schemaRepo, schemaDir, [
        '--depth',
        '1',
        '--branch',
        'main',
      ]);
      await simpleGit(schemaDir).checkout(schemaHash);
      this.logger.log('Cloned schema repository.');

      await simpleGit().clone(guidewireRepo, guidewireDir, [
        '--depth',
        '1',
        '--branch',
        'main',
      ]);
      await simpleGit(guidewireDir).checkout(guidewireHash);
      this.logger.log('Cloned Guidewire repository.');

      spinner.succeed('Repositories cloned.');

      this.logger.log('Generating Guidewire types...');
      await this.generateGuidewireTypes(guidewireDir);

      this.logger.log('Generating GraphQL server types...');
      await this.generateGraphQLTypes(schemaDir);
    } catch (error) {
      spinner.fail('Failed to clone repositories.');
      this.logger.error(error);
    } finally {
      fs.rmSync(schemaDir, { recursive: true, force: true });
      fs.rmSync(guidewireDir, { recursive: true, force: true });
    }
  }

  private async promptForSyncType(): Promise<string> {
    const { syncType } = await this.inquirer.ask('sync-type', undefined);
    return syncType;
  }

  private scaffoldOperations() {
    const operationsDir = './operations';
    const queriesDir = path.join(operationsDir, 'queries');
    const mutationsDir = path.join(operationsDir, 'mutations');

    [operationsDir, queriesDir, mutationsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created: ${dir}`);
      }
    });
  }

  private async generateClientTypes(schemaDir: string) {
    const outputPath = './generated/graphql-types.ts';
    this.logger.log(`Running GraphQL Codegen in ${schemaDir}...`);

    await generate({
      schema: path.join(schemaDir, 'schema.graphql'),
      documents: './operations/**/*.graphql',
      generates: {
        [outputPath]: {
          plugins: ['typescript', 'typescript-operations'],
        },
      },
    });

    this.logger.log(`Generated GraphQL client types at: ${outputPath}`);
  }

  private async generateGraphQLTypes(schemaDir: string) {
    const outputPath = './generated/graphql-types.ts';

    this.logger.log('Running GraphQL Codegen to generate server types...');

    await generate({
      schema: path.join(schemaDir, 'src/schema.graphql'),
      generates: {
        [outputPath]: {
          plugins: ['typescript'],
        },
      },
    });

    this.logger.log(`Generated GraphQL server types at: ${outputPath}`);
  }

  private async generateGuidewireTypes(guidewireDir: string) {
    this.logger.log(`Generating Guidewire types for ${guidewireDir}...`);

    try {
      const swaggerPath = path.join(guidewireDir, 'openapi/swagger.json');
      const outputPath = './generated/guidewire-types.ts';

      // Read OpenAPI spec
      const openAPISpec = fs.readFileSync(swaggerPath, 'utf-8');

      // Generate TypeScript types
      const nodes = await openapiTS(openAPISpec);

      const printer = ts.createPrinter();
      const file = ts.createSourceFile(
        'openapi-types.ts',
        '',
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TS,
      );

      const types = nodes
        .map((node) => printer.printNode(ts.EmitHint.Unspecified, node, file))
        .join('\n');

      // Write the generated types to file
      fs.writeFileSync(outputPath, types);
      this.logger.log(
        `TypeScript types generated successfully at: ${outputPath}`,
      );
    } catch (error) {
      this.logger.error('Error generating OpenAPI types:', error);
    }
  }

  private async getLatestCommitHash(repoUrl: string): Promise<string | null> {
    try {
      const git = simpleGit();
      const result = await git.listRemote([repoUrl, 'main']);
      const latestCommit = result.split('\n')[0]?.split('\t')[0];
      return latestCommit || null;
    } catch (error) {
      this.logger.warn(
        `Could not fetch latest commit hash for ${repoUrl}:`,
        error,
      );
      return null;
    }
  }

  private async promptForHash(repoName: string): Promise<string> {
    const { hash } = await this.inquirer.ask(`hash-${repoName}`, undefined);
    return hash;
  }
}

@QuestionSet({ name: 'sync-type' })
export class SyncTypeQuestionSet {
  @Question({
    message: 'What type of sync would you like to perform?',
    name: 'syncType',
    type: 'list',
    choices: ['frontend', 'backend'],
  })
  parseSyncType(value: string) {
    return value;
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
