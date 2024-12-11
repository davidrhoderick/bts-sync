import { Question, QuestionSet } from 'nest-commander';

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
