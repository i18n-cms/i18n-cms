import {
  Modal,
  ModalContent,
  ModalBody,
  ModalOverlay,
  ModalHeader,
  ModalCloseButton,
  Stack,
  FormLabel,
  Text,
  RadioGroup,
  Radio,
  Divider,
  Input,
  Button,
  useToast,
  Flex,
  Alert,
  AlertIcon,
  Link
} from '@chakra-ui/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import LoadingModal from '../../../component/LoadingModal';

import { CONFIG_PATH, RECENT_BRANCHES_SIZE } from '../../../constants';
import useGetLanguagesAndNamespaces from '../hooks/useGetLanguagesAndNamespaces';
import useGetCustomPathHandler from '../hooks/useGetCustomPathHandler';
import {
  closeEditingRepo,
  Repo,
  RepoConfig,
  setEditingRepo,
  setInitialRepoData
} from '../../../redux/editingRepoSlice';
import { useUpdateExistingRepoMutation } from '../../../redux/services/firestoreApi';
import {
  useCreateGithubRefMutation,
  useLazyGetGithubBranchQuery,
  useLazyGetGithubContentQuery
} from '../../../redux/services/octokitApi';
import { useAppDispatch } from '../../../redux/store';
import { decodeConfigFile } from '../../../utils/fileHelper';
import SetupRepoAlert from '../../../component/SetupRepoAlert';
import { getGithubUrl } from '../../../utils';

interface IProps {
  repo: Repo;
}

interface FormValues {
  action: 'existing' | 'create';
  baseOn: string;
  newBranchName: string;
  existingBranchName: string;
  isRecentBranch: boolean;
}

const CONFIG_NOT_FOUND_ERROR_TYPE = 'config_not_found';

const BranchFormModal = ({ repo }: IProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('repo');

  const { t: commonT } = useTranslation();
  const toast = useToast();

  const [isLoading, setLoading] = useState(false);

  const [getGithubBranch, { isLoading: isFetchBranchLoading }] =
    useLazyGetGithubBranchQuery();
  const [getGithubContent, { isLoading: isFetchConfigLoading }] =
    useLazyGetGithubContentQuery();
  const [createGithubRef, { isLoading: isCreateRefLoading }] =
    useCreateGithubRefMutation();
  const [updateExistingRepo, { isLoading: isUpdateRepoLoading }] =
    useUpdateExistingRepoMutation();
  const [getLanguagesAndNamespaces, { isLoading: isFetchingLngAndNsLoading }] =
    useGetLanguagesAndNamespaces();
  const [getCustomPathHandler, { isLoading: isFetchingCustomPathHandler }] =
    useGetCustomPathHandler();

  const getLoadingTitle = () => {
    if (isFetchBranchLoading) return t('Fetching branch');
    if (isFetchConfigLoading) return t('Fetching config');
    if (isCreateRefLoading) return t('Creating branch');
    if (isUpdateRepoLoading) return t('Updating config');
    if (isFetchingLngAndNsLoading || isFetchingCustomPathHandler)
      return t('Fetching namespaces and languages');
    return undefined;
  };

  const {
    register,
    watch,
    handleSubmit,
    setError,
    formState: { errors }
  } = useForm<FormValues>();

  const action = watch('action');

  const onSubmit = async (values: FormValues & { isRecentBranch: boolean }) => {
    const {
      action,
      baseOn,
      newBranchName,
      existingBranchName,
      isRecentBranch = false
    } = values;
    try {
      setLoading(true);
      const branch = await getGithubBranch({
        repo: repo.repo,
        owner: repo.owner,
        branch: action === 'create' ? baseOn : existingBranchName
      }).unwrap();

      if (action === 'existing' && branch.protection.enabled) {
        throw new Error('Protected branch');
      }

      const repoContent = await getGithubContent({
        repo: repo.repo,
        owner: repo.owner,
        path: CONFIG_PATH,
        ref: branch.name
      }).unwrap();

      const repoConfig: RepoConfig = decodeConfigFile(repoContent);
      if (!repoConfig) throw new Error('Repo config error');

      if (action === 'create') {
        await createGithubRef({
          repo: repo.repo,
          owner: repo.owner,
          ref: `refs/heads/${newBranchName}`,
          sha: branch.commit.sha
        }).unwrap();
      }
      const branchName =
        action === 'create' ? newBranchName : existingBranchName;
      if (repo.recentBranches?.[0] !== branchName) {
        const updatedRepo = await updateExistingRepo({
          ...repo,
          recentBranches: Array.from(
            new Set([branchName, ...(repo.recentBranches || [])])
          ).slice(0, RECENT_BRANCHES_SIZE)
        }).unwrap();
        dispatch(setEditingRepo(updatedRepo));
      }
      const initRepoData = {
        namespaces: [''],
        languages: [''],
        repoConfig,
        branch: branchName
      };

      if (
        repoConfig.useCustomPath &&
        repoConfig.namespaces !== undefined &&
        repoConfig.languages !== undefined
      ) {
        const { namespaces, languages } = repoConfig;
        initRepoData.namespaces = namespaces;
        initRepoData.languages = languages;
        await getCustomPathHandler({ repo, branch: branchName });
      } else {
        const { namespaces, languages } = await getLanguagesAndNamespaces({
          repo,
          repoConfig: repoConfig,
          branch: branchName,
          rootSha: branch.commit.commit.tree.sha
        });
        initRepoData.namespaces = namespaces;
        initRepoData.languages = languages;
      }
      dispatch(setInitialRepoData(initRepoData));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.message === 'Protected branch') {
        if (isRecentBranch) {
          toast({
            title: t('Protected branch not supported'),
            status: 'error'
          });
          const updatedRepo = await updateExistingRepo({
            ...repo,
            recentBranches: repo.recentBranches?.filter(
              (branchName) => branchName !== existingBranchName
            )
          }).unwrap();
          dispatch(setEditingRepo(updatedRepo));
        } else {
          setError('existingBranchName', {
            message: t('Protected branch not supported')
          });
        }
      } else if (e?.message === 'Branch not found') {
        if (isRecentBranch) {
          const updatedRepo = await updateExistingRepo({
            ...repo,
            recentBranches: repo.recentBranches?.filter(
              (branchName) => branchName !== existingBranchName
            )
          }).unwrap();
          dispatch(setEditingRepo(updatedRepo));
          toast({ title: t('Branch not found'), status: 'error' });
        } else {
          setError(action === 'create' ? 'baseOn' : 'existingBranchName', {
            message: t('Branch not found')
          });
        }
      } else if (e?.message === 'Not Found') {
        setError(action === 'create' ? 'baseOn' : 'existingBranchName', {
          message: t('Config file not found in this branch'),
          type: CONFIG_NOT_FOUND_ERROR_TYPE
        });
      } else if (
        action === 'create' &&
        e?.message === 'Reference already exists'
      ) {
        setError('newBranchName', {
          message: t('Branch already exists')
        });
      } else {
        toast({ title: commonT('Something went wrong'), status: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!repo) return null;

  return (
    <>
      <Modal
        isOpen
        onClose={() => {
          dispatch(closeEditingRepo());
        }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Text>{t('Choose branch')}</Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack>
              <Alert>
                <AlertIcon />
                <Text>{t('Branch alert')}</Text>
              </Alert>
              <form onSubmit={handleSubmit(onSubmit)}>
                <Stack>
                  <Text fontWeight="semibold">{commonT('Repository')}</Text>
                  <Link isExternal href={getGithubUrl(repo)}>
                    <ExternalLinkIcon marginBottom={1} /> {repo?.fullName}
                  </Link>
                  <Divider />

                  {repo.recentBranches?.length && (
                    <>
                      <Text fontWeight="semibold">{t('Recent branches')}</Text>
                      {repo.recentBranches?.map((branchName) => (
                        <Flex
                          key={branchName}
                          cursor="pointer"
                          onClick={() => {
                            onSubmit({
                              action: 'existing',
                              baseOn: '',
                              newBranchName: '',
                              existingBranchName: branchName,
                              isRecentBranch: true
                            });
                          }}
                          opacity={0.7}
                          _hover={{ opacity: 1 }}>
                          <Text>{branchName}</Text>
                        </Flex>
                      ))}
                      <Divider />
                    </>
                  )}
                  <RadioGroup defaultValue="existing">
                    <Stack>
                      <Radio {...register('action')} value="existing">
                        {t('Use existing branch')}
                      </Radio>
                      <Radio {...register('action')} value="create">
                        {t('Create new branch')}
                      </Radio>
                    </Stack>
                  </RadioGroup>
                  <Divider />
                  {action === 'create' ? (
                    <>
                      <FormLabel>{t('Base on')}</FormLabel>
                      <Input
                        {...register('baseOn')}
                        placeholder="master"
                        borderColor={errors.baseOn ? 'error' : undefined}
                        focusBorderColor={errors.baseOn ? 'error' : undefined}
                        required
                      />
                      {errors.baseOn && (
                        <>
                          <Text color="error">{errors.baseOn.message}</Text>
                          {errors.baseOn.type ===
                            CONFIG_NOT_FOUND_ERROR_TYPE && <SetupRepoAlert />}
                        </>
                      )}
                      <FormLabel>{t('New branch name')}</FormLabel>
                      <Input
                        {...register('newBranchName')}
                        placeholder="feature/add-xxx-locales"
                        borderColor={errors.newBranchName ? 'error' : undefined}
                        focusBorderColor={
                          errors.newBranchName ? 'error' : undefined
                        }
                        required
                      />
                      {errors.newBranchName && (
                        <Text color="error">
                          {errors.newBranchName.message}
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <FormLabel>{t('Existing branch name')}</FormLabel>
                      <Input
                        {...register('existingBranchName')}
                        placeholder="feature/add-xxx-locales"
                        borderColor={
                          errors.existingBranchName ? 'error' : undefined
                        }
                        focusBorderColor={
                          errors.existingBranchName ? 'error' : undefined
                        }
                        required
                      />
                      {errors.existingBranchName && (
                        <>
                          <Text color="error">
                            {errors.existingBranchName.message}
                          </Text>
                          {errors.existingBranchName.type ===
                            CONFIG_NOT_FOUND_ERROR_TYPE && <SetupRepoAlert />}
                        </>
                      )}
                    </>
                  )}
                  <Button isLoading={isLoading} type="submit">
                    {commonT('Submit')}
                  </Button>
                </Stack>
              </form>
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
      {isLoading && <LoadingModal title={getLoadingTitle()} />}
    </>
  );
};

export default BranchFormModal;
