import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from nolane_agent import NolaneAgentClient, NolaneAgentError
from forge_studio import ForgeStudioClient as LegacyForgeStudioClient


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"status": "ok", "version": "1.0.0"})
        if self.headers.get("Authorization") != "Bearer python-token":
            return self.send_json(401, {"error": "unauthorized"})
        if self.path == "/api/projects":
            return self.send_json(200, [{"id": "p1"}])
        return self.send_json(404, {"error": "not-found"})

    def send_json(self, status, value):
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_secure_endpoint_and_authenticated_request(self):
        with self.assertRaises(ValueError):
            NolaneAgentClient("http://example.com", "token")
        client = NolaneAgentClient(self.base_url, "python-token", organization_id="org", workspace_id="ws")
        self.assertEqual(client.health()["status"], "ok")
        self.assertEqual(client.list_projects(), [{"id": "p1"}])

    def test_legacy_import_aliases_canonical_client(self):
        self.assertIs(LegacyForgeStudioClient, NolaneAgentClient)

    def test_errors_do_not_expose_token(self):
        client = NolaneAgentClient(self.base_url, "wrong-python-secret")
        with self.assertRaises(NolaneAgentError) as caught:
            client.list_projects()
        self.assertEqual(caught.exception.status, 401)
        self.assertNotIn("wrong-python-secret", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
