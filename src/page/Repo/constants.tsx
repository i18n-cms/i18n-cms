import { CELL_HEIGHT } from '../../constants';

export const CELL_PROPS = {
  flex: 1,
  padding: '0 12px',
  minWidth: '400px',
  maxWidth: '100%',
  backgroundColor: 'var(--chakra-colors-chakra-body-bg)',
  alignItems: 'center',
  height: '100%',
  borderBottomWidth: 1,
  wordBreak: 'break-word'
} as const;

export const ROW_PROPS = {
  height: `${CELL_HEIGHT}px`,
  backgroundColor: 'var(--chakra-colors-chakra-body-bg)',
  alignItems: 'center',
  width: '100%',
  minWidth: 'fit-content'
} as const;

export const LIST_PADDING_BOTTOM = 24;
export const SIDEBAR_WIDTH = 280;

export const SETUP_CONFIG_COMMIT_MESSAGE = 'Setup i18n-cms config';
