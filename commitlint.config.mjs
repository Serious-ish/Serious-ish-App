// Commit and pull request title format (Conventional Commits).
// Pull requests are squash-merged, so the PR title becomes the commit subject on main.
//
//   <type>(<scope>): <summary in imperative mood>
//
//   <body: what changed and why>
//
//   Refs: SI-<n>

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['mobile', 'moderation', 'shared', 'design-tokens', 'supabase', 'ci', 'repo', 'deps'],
    ],
    'header-max-length': [2, 'always', 72],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
};
