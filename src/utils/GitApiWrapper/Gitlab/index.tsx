import { Gitlab } from '@gitbeaker/browser';
import multimatch from 'multimatch';
import { FILE_TYPE_MAP_DATA } from '../../../constants';
import { getSessionStorage, setSessionStorage } from '../../storage';
import { ERROR_MSG } from '../constants';
import GitApi from '../interface';

const TREE_PAGE_SIZE = 100;

let isRefreshing = false;
let refreshQueue: (() => void)[] = [];
const refreshAccessToken = async () => {
  try {
    const refreshToken = getSessionStorage('refresh_token');
    const data = await fetch(
      `${process.env.REACT_APP_FUNCTIONS_URL}gitlab/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      }
    ).then((res) => res.json());
    const { access_token, expires_in, refresh_token } = data;

    setSessionStorage('access_token', access_token);
    setSessionStorage(
      'expire_in',
      (Date.now() + 1000 * parseInt(expires_in)).toString()
    );
    setSessionStorage('refresh_token', refresh_token);
  } finally {
    isRefreshing = false;
    refreshQueue.forEach((res) => res());
    refreshQueue = [];
  }
};

let gitlab = new Gitlab({});
let prevToken: string | undefined = undefined;
const setupGitlabClient = async () => {
  if (getSessionStorage('git_provider') !== 'gitlab') return;
  const expireIn = getSessionStorage('expire_in');
  if (expireIn && parseInt(expireIn) < Date.now()) {
    if (!isRefreshing) {
      refreshAccessToken();
      isRefreshing = true;
    }
    await new Promise<void>((res) => {
      refreshQueue.push(res);
    });
  }

  const token = (getSessionStorage('git_provider') === 'gitlab' &&
    getSessionStorage('access_token')) as string;
  if (prevToken !== token) {
    prevToken = token;
    gitlab = new Gitlab(
      window.Cypress
        ? { token }
        : {
            oauthToken: token
          }
    );
  }
};
setupGitlabClient();

const GitlabApi: GitApi = {
  getCurrentUser: async () => {
    await setupGitlabClient();
    const result = await gitlab.Users.current();
    return { name: result.username, id: result.id };
  },
  getOrganization: async () => {
    await setupGitlabClient();
    const result = await gitlab.Groups.all();
    return result.map((org) => ({ name: org.full_path, id: org.id }));
  },
  getRepo: async ({ repo, owner }) => {
    await setupGitlabClient();
    const data = await gitlab.Projects.show(
      `${owner}/${repo}`.toString()
    ).catch((err) => {
      if (err.description === '404 Project Not Found')
        throw new Error(ERROR_MSG.REPO_NOT_FOUND);
      throw err;
    });

    const accessLevel = Math.max(
      data.permissions.project_access?.access_level || 0,
      data.permissions.group_access?.access_level || 0
    );

    const permission = accessLevel >= 30 ? 'write' : 'read';

    return {
      owner: data.namespace.full_path,
      full_name: data.path_with_namespace,
      repo: data.path,
      permission
    };
  },
  createRepo: async ({ name, visibility, owner }) => {
    await setupGitlabClient();
    const data = await gitlab.Projects.create({
      path: name,
      namespace_id: owner.type === 'org' ? owner.id : undefined,
      visibility
    }).catch((err) => {
      if (err?.description?.name?.includes('has already been taken')) {
        throw new Error(ERROR_MSG.REPO_ALREADY_EXIST);
      }
      throw err;
    });
    return {
      owner: data.namespace.full_path,
      repo: data.name,
      default_branch: data.default_branch || 'main',
      full_name: data.path_with_namespace
    };
  },
  getContent: async ({ repo, owner, path, branch }) => {
    await setupGitlabClient();
    const result = await gitlab.RepositoryFiles.showRaw(
      `${owner}/${repo}`,
      path,
      { ref: branch }
    );
    return result;
  },
  createBranch: async ({ repo, owner, branch, hash }) => {
    await setupGitlabClient();

    const protectedBranchs = await gitlab.ProtectedBranches.all(
      `${owner}/${repo}`
    );
    if (
      protectedBranchs.some(
        (rule) =>
          multimatch([branch], rule.name).length > 0 &&
          rule.push_access_levels?.every((level) => level.access_level !== 30)
      )
    ) {
      throw new Error(ERROR_MSG.BRANCH_PERMISSION_VIOLATED);
    }

    const result = await gitlab.Branches.create(
      `${owner}/${repo}`,
      branch,
      hash
    ).catch((err) => {
      if (err.description === 'Branch already exists')
        throw new Error(ERROR_MSG.BRANCH_ALREADY_EXIST);

      throw err;
    });
    return result.data;
  },
  getTree: async ({ repo, owner, branch, repoConfig }) => {
    await setupGitlabClient();
    let data: {
      path?: string | undefined;
    }[] = [];

    const pathQuery = `${repoConfig.pattern}.${
      FILE_TYPE_MAP_DATA[repoConfig.fileType].ext
    }`
      .replace(':lng', repoConfig.defaultLanguage)
      .split(':ns')
      .filter((path) => !!path);

    const tree = await gitlab.Repositories.tree(`${owner}/${repo}`, {
      path: pathQuery[0] || undefined,
      per_page: TREE_PAGE_SIZE,
      recursive: true,
      ref: branch,
      pagination: 'keyset',
      order_by: 'id',
      sort: 'acs'
    });
    data = tree?.map((file) => ({ path: file.path })) || [];

    return data;
  },
  getBranch: async ({ repo, owner, branch }) => {
    await setupGitlabClient();
    const data = await gitlab.Branches.show(`${owner}/${repo}`, branch).catch(
      (err) => {
        if (err.description === '404 Branch Not Found') {
          throw new Error(ERROR_MSG.BRANCH_NOT_FOUND);
        }
        throw err;
      }
    );
    return {
      commitHash: data.commit.id as string,
      treeHash: '',
      name: data.name,
      isProtected: !data.can_push
    };
  },
  commitFiles: async ({
    repo,
    owner,
    branch,
    message,
    filesToDelete = [],
    files
  }) => {
    await setupGitlabClient();

    const fileExistToDelete = (
      await Promise.all(
        filesToDelete.map((path) =>
          gitlab.RepositoryFiles.showRaw(`${owner}/${repo}`, path, {
            ref: branch
          })
            .then(() => path)
            .catch(() => null)
        )
      )
    ).filter((path) => !!path);

    const actions = [
      ...fileExistToDelete.map((path) => ({
        action: 'delete',
        filePath: path
      })),
      ...Object.keys(files).map((path) => ({
        ...files[path],
        filePath: path
      }))
    ];

    const commit = await gitlab.Commits.create(
      `${owner}/${repo}`,
      branch,
      message,
      actions as Parameters<typeof gitlab.Commits.create>[3]
    );

    return {
      url: commit.web_url,
      hash: commit.id
    };
  }
};

export default GitlabApi;
