import {
  Command,
  CommandRunner,
  InquirerService,
  Option,
} from 'nest-commander';
import { RepoService } from './repo.service';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { buildSchema, printSchema } from 'graphql';
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
import * as ora from 'ora';

@Command({ name: 'bts-sync', options: { isDefault: true } })
export class SyncCommand extends CommandRunner {
  private readonly logger = new Logger(SyncCommand.name);

  private graphQLDir = './graphql-repo';
  private pcDir = './pc-repo';

  private graphQLRepoService: RepoService;
  private pcRepoService: RepoService;

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
    description: 'Specify the type of sync: pc or graphql',
  })
  parseSyncType(value: string): string {
    if (!['pc', 'graphql'].includes(value)) {
      throw new Error(
        'Invalid sync type. Valid options are "pc" or "graphql".',
      );
    }
    return value;
  }

  async run(inputs: string[], options: Record<string, any>) {
    let syncType = options.syncType || this.config.defaultSyncType;
    if (!syncType) {
      syncType = await this.promptForSyncType();
    }

    const graphQLRepo = options.graphQLRepo || this.config.graphQLRepo;
    const pcRepo = options.pcRepo || this.config.pcRepo;

    const graphQLHash =
      options.graphQLHash ||
      (syncType === 'graphql' ? await this.promptForHash('graphql') : null);
    const pcHash =
      options.pcHash ||
      (syncType === 'pc' ? await this.promptForHash('pc') : null);

    // Initialize the repo services
    this.graphQLRepoService = this.repoServiceFactory.create(
      graphQLRepo,
      this.graphQLDir,
      'GraphQL',
    );
    this.pcRepoService = this.repoServiceFactory.create(
      pcRepo,
      this.pcDir,
      'PC',
    );

    // Delete any repos left over so we can clone them without error now
    this.graphQLRepoService.cleanup();
    this.pcRepoService.cleanup();

    if (syncType === 'pc') {
      await this.syncPC(pcHash);
    } else if (syncType === 'graphql') {
      await this.syncGraphQL(graphQLHash);
    } else {
      this.logger.error('Invalid sync type. Use "pc" or "graphql".');
    }
  }

  private async syncGraphQL(graphQLHash: string | null) {
    await this.graphQLRepoService.cloneAndCheckout(graphQLHash);

    const spinner = ora('Stitching schemas together...').start();

    try {
      const schemaDir = join(this.graphQLDir, 'src/schema');
      const outputDir = './src/generated';

      if (!existsSync(outputDir)) mkdirSync(outputDir);

      const outputPath = join(outputDir, 'schema.graphql');

      const schemas = this.readSchemasFromDirectory(schemaDir);

      writeFileSync(outputPath, printSchema(buildSchema(schemas.join('\n'))));

      spinner.succeed(`Stitched schema written to: ${outputPath}`);
    } catch (error) {
      spinner.fail('Failed to stitch schemas together.');
      throw error;
    } finally {
      this.graphQLRepoService.cleanup();
    }
  }

  private readSchemasFromDirectory(directory: string): string[] {
    if (!existsSync(directory)) {
      this.logger.warn(`Directory not found: ${directory}`);
      return [];
    }

    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory())
        return readdirSync(fullPath)
          .filter((file) => file.endsWith('.graphql'))
          .map((file) => readFileSync(join(fullPath, file), 'utf-8'));
      else if (entry.isFile() && entry.name.endsWith('.graphql'))
        return [readFileSync(fullPath, 'utf-8')];

      return [];
    });
  }

  private async syncPC(pcHash: string | null) {
    await this.pcRepoService.cloneAndCheckout(pcHash);

    await this.generatePCTypes();

    this.pcRepoService.cleanup();
  }

  private async promptForSyncType(): Promise<string> {
    const { syncType } = await this.inquirer.ask('sync-type', undefined);
    return syncType;
  }

  private async generatePCTypes() {
    const spinner = ora('Generating PC types...').start();

    try {
      const swaggerPath = join(this.pcDir, 'openapi/doc.json');
      const outputFolder = './src/generated';
      const outputPath = join(outputFolder, 'pc-types.ts');

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
      spinner.succeed(`Generated PC types at: ${outputPath}`);
    } catch (error) {
      spinner.fail('Failed to generate PC types.');
      throw error;
    }
  }

  private async promptForHash(repoName: string): Promise<string | null> {
    const { hash } = await this.inquirer.ask(`hash-${repoName}`, undefined);
    return hash || null;
  }
}
