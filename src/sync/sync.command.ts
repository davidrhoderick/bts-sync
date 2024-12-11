import {
  Command,
  CommandRunner,
  InquirerService,
  Option,
} from 'nest-commander';
import { RepoService } from './repo.service';
import { generate } from '@graphql-codegen/cli';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Inject, Logger } from '@nestjs/common';
import openapiTS from 'openapi-typescript';
import {
  createPrinter,
  EmitHint,
  ScriptKind,
  ScriptTarget,
  createSourceFile,
} from 'typescript';
import ora from 'ora';
import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files';

@Command({ name: 'bts-sync', options: { isDefault: true } })
export class SyncCommand extends CommandRunner {
  private readonly logger = new Logger(SyncCommand.name);

  private schemaDir = './schema-repo';
  private guidewireDir = './guidewire-repo';

  private schemaRepoService: RepoService;
  private guidewireRepoService: RepoService;

  constructor(
    @Inject('config') private readonly config: any,
    @Inject('REPO_SERVICE_FACTORY')
    private readonly repoServiceFactory: {
      create: (url: string, folder: string, nickname: string) => RepoService;
    },
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
      options.schemaHash || (await this.promptForHash('schema'));
    const guidewireHash =
      options.guidewireHash ||
      (syncType === 'backend' ? await this.promptForHash('Guidewire') : null);

    // Initialize the repo services
    this.schemaRepoService = this.repoServiceFactory.create(
      schemaRepo,
      this.schemaDir,
      'Schema Repository',
    );
    this.guidewireRepoService = this.repoServiceFactory.create(
      guidewireRepo,
      this.guidewireDir,
      'Guidewire Repository',
    );

    this.schemaRepoService.cleanup();
    this.guidewireRepoService.cleanup();

    if (syncType === 'frontend') {
      await this.syncFrontend(schemaHash);
    } else if (syncType === 'backend') {
      await this.syncBackend(schemaHash, guidewireHash);
    } else {
      this.logger.error('Invalid sync type. Use "frontend" or "backend".');
    }
  }

  private async syncFrontend(schemaHash: string | null) {
    await this.schemaRepoService.cloneAndCheckout(schemaHash);

    this.logger.log('Scaffolding operations folder...');
    this.scaffoldFrontend();

    await this.generateReactApolloClientTypes();

    this.schemaRepoService.cleanup();
  }

  private async syncBackend(
    schemaHash: string | null,
    guidewireHash: string | null,
  ) {
    await this.schemaRepoService.cloneAndCheckout(schemaHash);

    await this.guidewireRepoService.cloneAndCheckout(guidewireHash);

    await this.generateGuidewireTypes();

    await this.generateGraphQLTypesWithServerPreset();

    this.schemaRepoService.cleanup();
    this.guidewireRepoService.cleanup();
  }

  private async promptForSyncType(): Promise<string> {
    const { syncType } = await this.inquirer.ask('sync-type', undefined);
    return syncType;
  }

  private scaffoldFrontend() {
    const srcDir = './src';
    const graphqlDir = join(srcDir, 'graphql');
    const documentsDir = join(graphqlDir, 'documents');

    [srcDir, graphqlDir, documentsDir].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.logger.log(`Created: ${dir}`);
      }
    });
  }

  private async generateReactApolloClientTypes() {
    const outputPath = './src/graphql/generated.ts';
    const spinner = ora(
      'Running GraphQL Codegen for React Apollo client types...',
    ).start();

    try {
      await generate({
        schema: join(this.schemaDir, 'schema.graphql'),
        documents: './src/graphql/documents/**/*.graphql',
        generates: {
          [outputPath]: {
            plugins: [
              'typescript',
              'typescript-operations',
              {
                'typescript-react-apollo': {
                  withHooks: true,
                  withHOC: false,
                  withComponent: false,
                },
              },
            ],
          },
        },
      });
      spinner.succeed(`Generated React Apollo client types at: ${outputPath}`);
    } catch (error) {
      spinner.fail('Failed to generate React Apollo client types.');
      throw error;
    }
  }

  private async generateGraphQLTypesWithServerPreset() {
    const outputPath = './src/generated';
    const spinner = ora(
      'Running GraphQL Codegen with server preset...',
    ).start();

    try {
      await generate({
        schema: join(this.schemaDir, '**/schema.graphql'),
        generates: {
          [outputPath]: defineConfig({
            resolverGeneration: 'disabled',
          }),
        },
      });
      spinner.succeed(
        `Generated GraphQL server types and resolvers at: ${outputPath}`,
      );
    } catch (error) {
      spinner.fail('Failed to generate GraphQL server types.');
      throw error;
    }
  }

  private async generateGuidewireTypes() {
    const spinner = ora('Generating Guidewire types...').start();

    try {
      const swaggerPath = join(this.guidewireDir, 'openapi/swagger.json');
      const outputFolder = './src/generated';
      const outputPath = join(outputFolder, 'guidewire-types.ts');

      // Read OpenAPI spec
      const openAPISpec = readFileSync(swaggerPath, 'utf-8');

      // Generate TypeScript types
      const nodes = await openapiTS(openAPISpec);

      const printer = createPrinter();
      const file = createSourceFile(
        'openapi-types.ts',
        '',
        ScriptTarget.Latest,
        false,
        ScriptKind.TS,
      );

      const types = nodes
        .map((node) => printer.printNode(EmitHint.Unspecified, node, file))
        .join('\n');

      if (!existsSync(outputFolder)) mkdirSync(outputFolder);

      // Write the generated types to file
      writeFileSync(outputPath, types);
      spinner.succeed(`Generated Guidewire types at: ${outputPath}`);
    } catch (error) {
      spinner.fail('Failed to generate Guidewire types.');
      throw error;
    }
  }

  private async promptForHash(repoName: string): Promise<string | null> {
    const { hash } = await this.inquirer.ask(`hash-${repoName}`, undefined);
    return hash || null;
  }
}
