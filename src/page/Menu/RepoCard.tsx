import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, IconButton, Text, useToast } from '@chakra-ui/react';
import { isEqual } from 'lodash-es';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { DeleteIcon } from '@chakra-ui/icons';

import useCheckRepoPermissions from './AddRepoButton/useCheckRepoPermissions';
import { Repo, setEditingRepo } from '../../redux/editingRepoSlice';
import {
  useUpdateExistingRepoMutation,
  useRemoveExistingRepoMutation
} from '../../redux/services/firestoreApi';

import LoadingModal from '../../component/LoadingModal';
import PopoverDeleteBtn from '../../component/PopoverDeleteBtn';

interface IProps {
  repo: Repo;
  refetch: () => void;
}

const RepoCard = ({ repo, refetch }: IProps) => {
  const { t } = useTranslation('menu');
  const dispatch = useDispatch();
  const history = useHistory();
  const toast = useToast();
  const [isLoading, setLoading] = useState(false);

  const checkRepoPermissions = useCheckRepoPermissions();
  const [removeExistingRepo] = useRemoveExistingRepoMutation();
  const [updateExistingRepo] = useUpdateExistingRepoMutation();

  const onRepoClick = useCallback(async () => {
    try {
      setLoading(true);
      const result = await checkRepoPermissions({
        repoName: repo.repo,
        owner: repo.owner
      });
      if (result.error) {
        await removeExistingRepo(repo);
        refetch();
        toast({ title: t('Please import repo again'), status: 'error' });
      } else if (result.data) {
        const { repo: validRepo } = result.data;
        const updatedRepo = { ...repo, ...validRepo };
        if (!isEqual(validRepo, repo)) {
          await removeExistingRepo(repo);
        }
        await updateExistingRepo(updatedRepo);
        await dispatch(setEditingRepo(updatedRepo));
        history.push('/repo');
      }
    } finally {
      setLoading(false);
    }
  }, [repo, refetch]);

  const onDeleteClicked = useCallback(async () => {
    await removeExistingRepo(repo);
    await refetch();
  }, [repo, refetch]);

  return (
    <Flex
      data-e2e-id="menu_repo_card"
      key={repo.fullName}
      onClick={onRepoClick}
      cursor="pointer"
      borderWidth={1}
      borderRadius={5}
      p={3}
      alignItems="center"
      justifyContent="space-between"
      gap={2}>
      <Text>{repo.fullName}</Text>
      <PopoverDeleteBtn
        onConfirm={onDeleteClicked}
        title={t(`Remove existing repository`)}
        content={
          <Text
            dangerouslySetInnerHTML={{
              __html: t(`Remove existing repository confirmation`, {
                repo: repo.fullName
              })
            }}
          />
        }>
        <IconButton
          icon={<DeleteIcon />}
          variant="ghost"
          colorScheme="red"
          aria-label="repo remove btn"
          onClick={(e) => e.stopPropagation()}
        />
      </PopoverDeleteBtn>
      {isLoading && <LoadingModal title={t('Fetching repo')} />}
    </Flex>
  );
};

export default RepoCard;
