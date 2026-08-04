import json
import socket
import urllib.error
import urllib.parse
import urllib.request


class NolaneAgentError(RuntimeError):
    def __init__(self, message, status=None, code=None):
        super().__init__(message)
        self.status = status
        self.code = code


def _base_url(value):
    parsed = urllib.parse.urlparse(str(value))
    loopback = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
    if parsed.scheme != "https" and not (parsed.scheme == "http" and loopback):
        raise ValueError("Nolane Agent requires HTTPS except for loopback endpoints")
    if not parsed.netloc:
        raise ValueError("Nolane Agent base URL is invalid")
    return str(value).rstrip("/") + "/"


class NolaneAgentClient:
    def __init__(self, base_url, token="", *, organization_id="", workspace_id="", timeout=60.0):
        self.base_url = _base_url(base_url)
        self._token = str(token or "")
        self.organization_id = str(organization_id or "")
        self.workspace_id = str(workspace_id or "")
        self.timeout = float(timeout)
        if self.timeout <= 0 or self.timeout > 3600:
            raise ValueError("timeout must be between 0 and 3600 seconds")

    def request(self, route, *, method="GET", query=None, body=None, auth=True):
        if auth and not self._token:
            raise NolaneAgentError("Nolane Agent token is not configured", code="TOKEN_REQUIRED")
        url = urllib.parse.urljoin(self.base_url, str(route).lstrip("/"))
        if query:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
        data = None if body is None else json.dumps(body).encode("utf-8")
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if auth:
            headers["Authorization"] = f"Bearer {self._token}"
        if self.organization_id:
            headers["X-Nolane-Organization"] = self.organization_id
        if self.workspace_id:
            headers["X-Nolane-Workspace"] = self.workspace_id
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                return None if not raw else json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as error:
            raw = error.read()
            detail = ""
            code = None
            try:
                payload = json.loads(raw.decode("utf-8")) if raw else {}
                detail = str(payload.get("error") or payload.get("message") or "")[:500]
                code = payload.get("code")
            except (UnicodeDecodeError, json.JSONDecodeError):
                detail = ""
            raise NolaneAgentError(f"Nolane Agent request failed ({error.code})" + (f": {detail}" if detail else ""), status=error.code, code=code) from None
        except (urllib.error.URLError, socket.timeout, TimeoutError) as error:
            raise NolaneAgentError(f"Nolane Agent network request failed: {type(error).__name__}", code="NETWORK_ERROR") from None

    def health(self):
        return self.request("/health", auth=False)

    def list_projects(self):
        return self.request("/api/projects")

    def create_run(self, project_id, objective, *, autonomy_profile="guided", **options):
        return self.request("/api/agent/runs", method="POST", body={"projectId": project_id, "objective": objective, "autonomyProfile": autonomy_profile, **options})

    def list_runs(self, project_id, *, limit=30):
        return self.request("/api/agent/runs", query={"projectId": project_id, "limit": limit})

    def get_run(self, run_id):
        return self.request(f"/api/agent/runs/{urllib.parse.quote(str(run_id), safe='')}")

    def control_run(self, run_id, action):
        if action not in {"pause", "resume", "stop", "retry"}:
            raise ValueError(f"Unsupported run action: {action}")
        return self.request(f"/api/agent/runs/{urllib.parse.quote(str(run_id), safe='')}/{action}", method="POST", body={})

    def send_message(self, run_id, content):
        return self.request(f"/api/agent/runs/{urllib.parse.quote(str(run_id), safe='')}/messages", method="POST", body={"content": str(content)})

    def review_run(self, run_id):
        return self.request(f"/api/agent/runs/{urllib.parse.quote(str(run_id), safe='')}/review")

    def list_activities(self, run_id):
        return self.request(f"/api/agent/runs/{urllib.parse.quote(str(run_id), safe='')}/activities")
