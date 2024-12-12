import { Question, QuestionSet } from 'nest-commander';

@QuestionSet({ name: 'sync-type' })
export class SyncTypeQuestionSet {
  @Question({
    message: 'What type of sync would you like to perform?',
    name: 'syncType',
    type: 'list',
    choices: ['pc', 'graphql'],
  })
  parseSyncType(value: string) {
    return value;
  }
}

@QuestionSet({ name: 'hash-graphql' })
export class SchemaHashQuestionSet {
  @Question({
    message: 'Enter the Git hash or tag for the GraphQL repo (default: main):',
    name: 'hash',
    default: 'main',
    type: 'input',
  })
  parseHash(value: string) {
    return value;
  }
}

@QuestionSet({ name: 'hash-pc' })
export class GuidewireHashQuestionSet {
  @Question({
    message: 'Enter the Git hash or tag for the PC repo (default: main):',
    name: 'hash',
    default: 'main',
    type: 'input',
  })
  parseHash(value: string) {
    return value;
  }
}
