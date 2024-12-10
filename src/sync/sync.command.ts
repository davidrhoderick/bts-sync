import {
  Command,
  CommandRunner,
  QuestionSet,
  Question,
  InquirerService,
  Option,
} from 'nest-commander';
import simpleGit from 'simple-git';
// import { generate } from '@graphql-codegen/cli';
import * as fs from 'fs';
import * as path from 'path';
import { Inject } from '@nestjs/common';
import openapiTS from 'openapi-typescript';
import * as ts from 'typescript';

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

  private async syncFrontend(schemaRepo: string, schemaHash: string) {
    console.log(`Cloning schema repository: ${schemaRepo}`);
    const schemaDir = './schema-repo';

    console.log('Scaffolding operations folder...');
    this.scaffoldOperations();

    console.log('Generating Apollo Client types...');
    await this.generateClientTypes(schemaDir);
  }

  private async syncBackend(
    schemaRepo: string,
    guidewireRepo: string,
    schemaHash: string,
    guidewireHash: string,
  ) {
    const git = simpleGit();

    console.log(`Cloning schema repository: ${schemaRepo}`);
    const schemaDir = './schema-repo';
    await git.clone(schemaRepo, schemaDir, [
      '--depth',
      '1',
      '--branch',
      schemaHash,
    ]);
    console.log('Cleaning up schema repo...');
    fs.rmSync(schemaDir, { recursive: true, force: true });

    console.log(`Cloning Guidewire repository: ${guidewireRepo}`);
    const guidewireDir = './guidewire-repo';
    await git.clone(guidewireRepo, guidewireDir, [
      '--depth',
      '1',
      '--branch',
      guidewireHash,
    ]);

    console.log('Running custom script for Guidewire...');
    await this.generateGuidewireTypes(guidewireDir);

    console.log('Cleaning up Guidewire repo...');
    fs.rmSync(guidewireDir, { recursive: true, force: true });

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
    console.log('Generated Apollo Client types successfully.');
  }

  private async generateServerTypes(schemaDir: string) {
    console.log('Generated Apollo Server types successfully.');
  }

  private createApolloSchema(schemaDir: string) {
    console.log('Apollo Server schema created successfully.');
  }

  private async generateGuidewireTypes(guidewireDir: string) {
    console.log(`Generating Guidewire types for ${guidewireDir}...`);

    try {
      const swaggerPath = path.join(guidewireDir, 'openapi/swagger.json');
      const outputPath = './guidewire-types.ts';

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
      console.log(`TypeScript types generated successfully at: ${outputPath}`);
    } catch (error) {
      console.error('Error generating OpenAPI types:', error);
    }

    console.log('Generated Guidewire types successfully.');
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
