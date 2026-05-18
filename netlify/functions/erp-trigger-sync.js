const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed', message: 'POST만 지원합니다.' });
  }

  const token = process.env.GITHUB_ACTIONS_TOKEN || process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_ACTIONS_REPO || 'kjs88/membership-dashboard';
  const workflow = process.env.AMARANS_SYNC_WORKFLOW || 'amarans-sync.yml';
  const ref = process.env.AMARANS_SYNC_REF || 'main';

  if (!token) {
    return json(501, {
      error: 'github_actions_token_missing',
      message: 'Netlify 환경변수 GITHUB_ACTIONS_TOKEN이 필요합니다. repo/workflow 권한이 있는 GitHub token을 설정하세요.',
      requiredEnv: ['GITHUB_ACTIONS_TOKEN'],
      optionalEnv: ['GITHUB_ACTIONS_REPO', 'AMARANS_SYNC_WORKFLOW', 'AMARANS_SYNC_REF'],
    });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'membership-dashboard-netlify',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref }),
    });

    if (!response.ok) {
      const text = await response.text();
      return json(response.status, {
        error: 'github_workflow_dispatch_failed',
        message: `GitHub Actions 실행 요청 실패 (${response.status})`,
        detail: text.slice(0, 500),
      });
    }

    return json(202, {
      ok: true,
      source: 'github-actions',
      repo,
      workflow,
      ref,
      requestedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(502, {
      error: 'github_workflow_dispatch_error',
      message: err.message,
    });
  }
};
