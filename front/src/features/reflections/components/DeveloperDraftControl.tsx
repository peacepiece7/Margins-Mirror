import {
  DeveloperDraftControl as SharedDeveloperDraftControl,
  type DeveloperDraftControlProps,
} from '@/components/developer-draft-control';

import { reflectionsApi } from '../api';

export function DeveloperDraftControl(props: Omit<DeveloperDraftControlProps, 'generate'>) {
  return <SharedDeveloperDraftControl {...props} generate={reflectionsApi.developerDraft} />;
}
