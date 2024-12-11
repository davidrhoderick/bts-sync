import { Injectable, Logger } from '@nestjs/common';
import simpleGit, { SimpleGit } from 'simple-git';
import { rmSync } from 'fs';
import { join } from 'path';

@Injectable()
export class RepoService {
  private readonly logger = new Logger(RepoService.name);
  private git: SimpleGit;

  constructor(
    private readonly repoUrl: string,
    private readonly folder: string,
    private readonly nickname: string,
  ) {
    this.git = simpleGit();
  }

  async cloneAndCheckout(hash?: string | null): Promise<void> {
    this.logger.log(`Cloning ${this.nickname}...`);
    await this.git.clone(this.repoUrl, this.folder);

    const repoGit = simpleGit(this.folder);
    if (hash) {
      this.logger.log(`Checking out hash: ${hash}`);
      await repoGit.checkout(hash);
    }
  }

  async getLatestCommitHash(): Promise<string> {
    this.logger.log(`Fetching latest commit hash for ${this.nickname}...`);
    const repoGit = simpleGit(this.folder);
    const log = await repoGit.log(['-1']);
    return log.latest?.hash || '';
  }

  cleanup(): void {
    this.logger.log(`Cleaning up ${this.nickname} directory...`);
    rmSync(this.folder, { recursive: true, force: true });
  }

  getFolderPath(): string {
    return join(process.cwd(), this.folder);
  }
}
