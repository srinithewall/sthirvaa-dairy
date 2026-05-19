import rawChangelog from './changelog.json';

export interface ChangelogEntry {
  version: string;
  date: string;
  commit: string;
  status?: string;
  changes: string[];
}

export const changelogData: ChangelogEntry[] = rawChangelog as ChangelogEntry[];
