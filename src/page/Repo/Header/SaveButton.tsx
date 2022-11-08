import { memo, useCallback, useEffect } from 'react';
import { Button, useToast } from '@chakra-ui/react';
import { Prompt } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  useAppDispatch,
  useAppSelector,
  useAppStore
} from '../../../redux/store';

import { isDataChangedSelector } from '../hooks/useSaveEditing';

import { setSaveModalOpen } from '../../../redux/editingRepoSlice';
import { duplicatedKeySelector } from '../../../redux/selector';

const SaveButton = () => {
  const { t } = useTranslation();
  const { t: repoT } = useTranslation('repo');
  const toast = useToast();

  const dispatch = useAppDispatch();
  const { getState } = useAppStore();
  const isDataChanged = useAppSelector(isDataChangedSelector);

  const openSaveModal = useCallback(() => {
    const state = getState();
    const { namespaces } = state.EditingRepoReducer;
    for (const namespace of namespaces) {
      if (Object.keys(duplicatedKeySelector(state, namespace)).length > 0) {
        toast({
          title: repoT('Please remove all duplicated key'),
          status: 'error'
        });
        return;
      }
    }

    dispatch(setSaveModalOpen(true));
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      const confirmationMessage = repoT(
        'Changes you made may not be saved. Ary you sure you want to leave ?'
      );
      // Gecko + IE
      (e || window.event).returnValue = confirmationMessage;
      // Safari, Chrome, and other WebKit-derived browsers
      return confirmationMessage;
    };
    if (isDataChanged) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDataChanged]);

  return (
    <>
      <Button disabled={!isDataChanged} onClick={openSaveModal} size="sm">
        {t('Save')}
      </Button>
      <Prompt
        when={isDataChanged}
        message={repoT(
          'Changes you made may not be saved. Ary you sure you want to leave ?'
        )}
      />
    </>
  );
};

export default memo(SaveButton);
